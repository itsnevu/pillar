#!/usr/bin/env node
/**
 * One-shot deploy of PyrisPact to Robinhood Chain (chain 4663), ERC-20 mode against the
 * chain's dollar stablecoin.
 *
 *   npm run deploy:robinhood              deploy
 *   npm run deploy:robinhood -- --dry-run check RPC, gas and token; deploy nothing
 *
 * Only PRIVATE_KEY is required (in .env or the environment): a wallet holding a little ETH on
 * Robinhood Chain. A deploy costs about 0.00015 ETH.
 *
 * Foundry is not needed: the bytecode comes from contracts/out/PyrisPact.sol/PyrisPact.json
 * (solc 0.8.28, evm prague; Robinhood Chain runs ArbOS 61 which supports it). The script
 *   1. picks a working RPC (the public one, or a local forwarder that reaches Cloudflare by IP
 *      with the right SNI when an ISP filter answers instead of the chain)
 *   2. checks the deployer has ETH
 *   3. probes the escrow token on chain (USDC_ADDRESS_ROBINHOOD from .env wins; default USDG)
 *   4. deploys `new PyrisPact(token)` and waits for the receipt
 *   5. writes contracts/deployments/4663.json (with deployBlock) and runs abi:sync
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http as viemHttp, defineChain, encodeAbiParameters, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

const CHAIN_ID = 4663;
const RPC_HOST = "rpc.mainnet.chain.robinhood.com";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const CF_IP = process.env.RPC_PROXY_UPSTREAM_IP || "104.20.46.209";
// USDG (Global Dollar, 6 decimals): the dollar stablecoin on Robinhood Chain.
const DEFAULT_TOKEN = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

// ── .env ────────────────────────────────────────────────────────────────────
for (const line of existsSync(path.join(ROOT, ".env")) ? readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const log = (...a) => console.log("[robinhood]", ...a);
const die = (m) => { console.error("\n[robinhood] ✗", m, "\n"); process.exit(1); };

const PK = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || "";
if (!/^0x[0-9a-fA-F]{64}$/.test(PK)) die("PRIVATE_KEY is missing. Put the 0x… key of a wallet holding a little ETH on Robinhood Chain in .env (PRIVATE_KEY=). Nothing else is required.");

// ── RPC: direct, else forwarder ──────────────────────────────────────────────
function rawRpc(url, method, params = []) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const mod = u.protocol === "https:" ? https : http;
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const req = mod.request({ host: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: u.pathname, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }, timeout: 15000 }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { const j = JSON.parse(d); j.error ? reject(new Error(j.error.message)) : resolve(j.result); } catch { reject(new Error("non-JSON answer: ISP filter page?")); } });
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout"))); req.end(body);
  });
}
function startForwarder(host) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = []; req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        const up = https.request({ host: CF_IP, servername: host, port: 443, method: "POST", path: "/",
          headers: { host, "content-type": "application/json", accept: "application/json", "content-length": body.length }, timeout: 30000 },
          (r) => { res.writeHead(r.statusCode || 502, { "content-type": "application/json" }); r.pipe(res); });
        up.on("error", (e) => { res.writeHead(502, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: e.message } })); });
        up.end(body);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
const chainIdOf = async (url) => { try { return Number(await rawRpc(url, "eth_chainId")); } catch { return null; } };

let forwarder = null;
async function pickRpc() {
  for (const url of [process.env.ROBINHOOD_RPC_URL, `https://${RPC_HOST}`].filter(Boolean)) {
    if ((await chainIdOf(url)) === CHAIN_ID) return url;
  }
  log("public RPC is not reachable as the chain (ISP filter?), starting a local forwarder …");
  forwarder = await startForwarder(RPC_HOST);
  if ((await chainIdOf(forwarder.url)) === CHAIN_ID) return forwarder.url;
  die(`no RPC answers as chain ${CHAIN_ID}. Set ROBINHOOD_RPC_URL in .env to a provider that works from this network.`);
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const rpc = await pickRpc();
  log(`rpc: ${rpc}`);
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
  const pub = createPublicClient({ chain, transport: viemHttp(rpc) });
  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ account, chain, transport: viemHttp(rpc) });

  const bal = await pub.getBalance({ address: account.address });
  log(`deployer: ${account.address}  balance: ${formatEther(bal)} ETH`);
  if (bal === 0n && !DRY) die("deployer has 0 ETH on Robinhood Chain; bridge a little ETH for gas first.");

  // token
  const erc20 = [
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  ];
  const token = process.env.USDC_ADDRESS_ROBINHOOD || DEFAULT_TOKEN;
  if (!/^0x[0-9a-fA-F]{40}$/.test(token)) die("USDC_ADDRESS_ROBINHOOD is not an address");
  const code = await pub.getCode({ address: token });
  if (!code || code === "0x") die(`no contract at token ${token}`);
  const [symbol, decimals] = await Promise.all([
    pub.readContract({ address: token, abi: erc20, functionName: "symbol" }),
    pub.readContract({ address: token, abi: erc20, functionName: "decimals" }),
  ]);
  log(`escrow token ${token}: ${symbol}, ${decimals} decimals ${decimals === 6 ? "✓" : "(expected 6)"}`);
  if (decimals !== 6) die("PyrisPact on Robinhood Chain expects a 6-decimal dollar token.");

  // artifact
  const artPath = path.join(ROOT, "contracts/out/PyrisPact.sol/PyrisPact.json");
  if (!existsSync(artPath)) die("contracts/out/PyrisPact.sol/PyrisPact.json is missing; run `forge build` in contracts/ on a machine with Foundry.");
  const art = JSON.parse(readFileSync(artPath, "utf8"));
  const bytecode = art.bytecode.object;
  const data = bytecode + encodeAbiParameters([{ type: "address" }], [token]).slice(2);

  const gas = await pub.estimateGas({ account: account.address, data });
  const gasPrice = await pub.getGasPrice();
  log(`deploy gas ≈ ${gas}  @ ${Number(gasPrice) / 1e9} gwei  ≈ ${formatEther(gas * gasPrice)} ETH`);
  if (DRY) { log("dry run: nothing sent."); forwarder?.server.close(); process.exit(bal === 0n ? 2 : 0); }

  log("deploying PyrisPact(token) …");
  const hash = await wallet.deployContract({ abi: art.abi, bytecode, args: [token] });
  log(`tx ${hash}, waiting for receipt …`);
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) die(`deploy reverted: ${hash}`);
  const address = receipt.contractAddress;
  log(`PyrisPact: ${address}  block ${receipt.blockNumber}`);

  // sanity: usdcToken() must return the token
  const usdcToken = await pub.readContract({ address, abi: art.abi, functionName: "usdcToken" });
  if (usdcToken.toLowerCase() !== token.toLowerCase()) die(`usdcToken() = ${usdcToken}, expected ${token}`);

  const record = { chainId: CHAIN_ID, deployer: account.address, usdc: token, pyrisPact: address, deployBlock: Number(receipt.blockNumber), token: { symbol, decimals }, deployedAt: new Date().toISOString() };
  mkdirSync(path.join(ROOT, "contracts/deployments"), { recursive: true });
  writeFileSync(path.join(ROOT, `contracts/deployments/${CHAIN_ID}.json`), JSON.stringify(record, null, 2) + "\n");
  const sync = spawnSync(process.execPath, [path.join(ROOT, "scripts/sync-abi.mjs")], { stdio: "inherit" });
  if (sync.status !== 0) log("abi:sync failed; run `npm run abi:sync` by hand.");

  console.log(`
────────────────────────────────────────────────────────────
  Deployed on Robinhood Chain (chain ${CHAIN_ID})
  PyrisPact   ${address}
  Token       ${token} (${symbol}, ${decimals} decimals, ERC-20 mode)
  Explorer    ${EXPLORER}/address/${address}

  Written: contracts/deployments/${CHAIN_ID}.json (commit it)
           src/lib/generated/deployments.ts

  Next: npm run build, then redeploy pyris.tech. Verify source on Blockscout when
  convenient (standard-json from contracts/out, compiler 0.8.28, evm prague).
────────────────────────────────────────────────────────────`);
  forwarder?.server.close();
  process.exit(0);
})().catch((e) => die(e.shortMessage || e.message || String(e)));
