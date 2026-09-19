import { NextResponse, type NextRequest } from "next/server";
import { getChain } from "@/lib/chains";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Same-origin JSON-RPC relay: POST /api/rpc/<chainId>.
 *
 * Robinhood Chain's public RPC (rpc.mainnet.chain.robinhood.com) is content-filtered by
 * Indonesian ISPs, so a browser or wallet on such a network cannot read a pact or fund
 * one. `chains.ts` hands the browser this route for that chain instead; the server, which
 * sits outside the filter, forwards to the real endpoint. Arc talks to its public RPC
 * directly and does not use this.
 *
 * A relay, not an open proxy: only the methods a wallet dapp needs are forwarded, bodies
 * and batches are capped, and each IP gets a small token bucket. Responses pass through
 * untouched so viem sees exactly what the chain said.
 */
const ALLOWED_METHODS = new Set([
  "eth_chainId", "net_version", "web3_clientVersion",
  "eth_blockNumber", "eth_getBlockByNumber", "eth_getBlockByHash",
  "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory", "eth_estimateGas",
  "eth_call", "eth_getBalance", "eth_getCode", "eth_getStorageAt", "eth_getTransactionCount",
  "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getLogs",
  "eth_sendRawTransaction",
]);

const MAX_BODY_BYTES = 256 * 1024;
const MAX_BATCH = 50;
const UPSTREAM_TIMEOUT_MS = 25_000;

const RATE = Number(process.env.RPC_RELAY_RATE || 20);
const BURST = Number(process.env.RPC_RELAY_BURST || 60);
const buckets = new Map<string, { tokens: number; at: number }>();
function allow(ip: string, cost: number) {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: BURST, at: now };
  b.tokens = Math.min(BURST, b.tokens + ((now - b.at) / 1000) * RATE);
  b.at = now;
  const ok = b.tokens >= cost;
  if (ok) b.tokens -= cost;
  buckets.set(ip, b);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (now - v.at > 60_000) buckets.delete(k);
  return ok;
}

type RpcId = number | string | null;
const rpcError = (id: RpcId, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const respond = (payload: unknown, status = 200) =>
  NextResponse.json(payload, { status, headers: { "cache-control": "no-store" } });

function reject(req: unknown): { id: RpcId; code: number; message: string } | null {
  if (!req || typeof req !== "object") return { id: null, code: -32600, message: "Invalid request" };
  const { id = null, method } = req as { id?: RpcId; method?: string };
  const safeId = typeof id === "number" || typeof id === "string" ? id : null;
  if (typeof method !== "string") return { id: safeId, code: -32600, message: "Invalid request" };
  if (!ALLOWED_METHODS.has(method)) return { id: safeId, code: -32601, message: `Method not relayed: ${method}` };
  return null;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await ctx.params;
  const chain = getChain(Number(chainId));
  if (!chain) return respond(rpcError(null, -32000, `chain ${chainId} is not enabled`), 404);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return respond(rpcError(null, -32600, "Request too large"), 413);

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return respond(rpcError(null, -32700, "Parse error"), 400); }

  const batch = Array.isArray(body);
  const requests = batch ? (body as unknown[]) : [body];
  if (requests.length === 0 || requests.length > MAX_BATCH) {
    return respond(rpcError(null, -32600, batch ? `Batch of at most ${MAX_BATCH}` : "Invalid request"), 400);
  }
  if (!allow(ip, requests.length)) return respond(rpcError(null, -32005, "Too many requests, slow down"), 429);

  const refused = requests.map(reject);
  if (refused.some(Boolean)) {
    const answers = refused.map((r) => (r ? rpcError(r.id, r.code, r.message) : null));
    if (!batch) return respond(answers[0]);
    if (answers.every(Boolean)) return respond(answers);
    const allowed = requests.filter((_, i) => !refused[i]);
    const fwd = await forward(chain.serverRpc, JSON.stringify(allowed));
    if (!fwd.ok) return fwd.response;
    const upstream = Array.isArray(fwd.json) ? fwd.json : [];
    let cursor = 0;
    return respond(answers.map((a) => a ?? upstream[cursor++] ?? rpcError(null, -32603, "Missing upstream answer")));
  }

  return (await forward(chain.serverRpc, raw)).response;
}

async function forward(
  url: string,
  body: string
): Promise<{ ok: true; json: unknown; response: NextResponse } | { ok: false; response: NextResponse }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await upstream.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch {
      return { ok: false, response: respond(rpcError(null, -32603, `Upstream returned ${upstream.status}`), 502) };
    }
    return {
      ok: true, json,
      response: new NextResponse(text, {
        status: upstream.status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      }),
    };
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      response: respond(
        rpcError(null, -32603, aborted ? "Upstream timeout" : `Upstream unreachable: ${(e as Error)?.message ?? "unknown"}`),
        aborted ? 504 : 502
      ),
    };
  } finally { clearTimeout(timer); }
}

export function GET() { return respond({ error: "POST JSON-RPC only" }, 405); }
