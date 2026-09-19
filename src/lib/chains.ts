import { defineChain, type Address, type Chain } from "viem";
import { deployments } from "./generated/deployments";

/**
 * Every network Pyris Pact runs on, in one place.
 *
 * Pyris is dual chain: Arc (Circle's L1, native USDC gas) and Robinhood Chain (an
 * Arbitrum Orbit L2, ETH gas). The same PyrisPact.sol is deployed on each, but in a
 * different mode fixed at deployment:
 *
 *   - Arc:       native mode. usdcToken == address(0); the escrowed amount travels as
 *                msg.value in native USDC, which the EVM exposes with 18 decimals.
 *   - Robinhood: ERC-20 mode. The escrowed amount is pulled with transferFrom from the
 *                chain's dollar stablecoin (USDG, 6 decimals), so createPact needs an
 *                approve first.
 *
 * A pact lives on exactly one chain: ids, events and balances are per deployment. The
 * app therefore has one "selected network" at a time (see network.tsx) and every read
 * and write is addressed to it explicitly.
 *
 * Which chains are enabled: those with a PyrisPact address in generated/deployments.ts
 * (written by scripts/sync-abi.mjs), narrowed by NEXT_PUBLIC_CHAINS when set.
 */

export type EscrowMode = "native" | "erc20";

export type ChainConfig = {
  id: number;
  key: "arc" | "robinhood" | "anvil";
  name: string;
  /** Short label for pills and badges. */
  short: string;
  chain: Chain;
  /** What the backend-less browser talks to (wagmi + wallet). */
  rpcUrl: string;
  /** Upstream endpoint the /api/rpc relay forwards to. */
  serverRpc: string;
  explorerUrl?: string;
  /** Explorer link to the verified source, when one exists. */
  sourceUrl?: (address: Address) => string;
  mode: EscrowMode;
  /** Symbol and decimals of the escrowed asset (not the gas asset). */
  token: { symbol: string; decimals: number; address?: Address };
  gasSymbol: string;
  pyrisPact?: Address;
  deployBlock: bigint;
  testnet: boolean;
  /** Public RPC is filtered by some ISPs; route the browser through /api/rpc/<id>. */
  relayByDefault: boolean;
};

type Deployment = { chainId: number; deployer?: string; usdc?: string; pyrisPact?: string; deployBlock?: number };
const DEPLOYMENTS = deployments as unknown as Record<string, Deployment | undefined>;

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function relayUrl(chainId: number) {
  const origin = typeof window !== "undefined" ? window.location.origin : APP_URL;
  return `${origin.replace(/\/$/, "")}/api/rpc/${chainId}`;
}

const isAddr = (v: string | undefined): v is Address => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);
const zero = "0x0000000000000000000000000000000000000000";

// Next.js only inlines NEXT_PUBLIC_* that are referenced literally, hence the spelled-out map.
const ENV = {
  5042: { rpc: process.env.NEXT_PUBLIC_RPC_URL_5042, explorer: process.env.NEXT_PUBLIC_EXPLORER_URL_5042 },
  4663: { rpc: process.env.NEXT_PUBLIC_RPC_URL_4663, explorer: process.env.NEXT_PUBLIC_EXPLORER_URL_4663 },
  31337: { rpc: process.env.NEXT_PUBLIC_RPC_URL_31337, explorer: process.env.NEXT_PUBLIC_EXPLORER_URL_31337 },
} as const;

type Base = Omit<ChainConfig, "chain" | "rpcUrl" | "serverRpc" | "pyrisPact" | "deployBlock" | "explorerUrl" | "token"> & {
  publicRpc: string;
  explorerUrl?: string;
  nativeCurrency: Chain["nativeCurrency"];
  token: { symbol: string; decimals: number };
};

const BASES: Base[] = [
  {
    id: 5042,
    key: "arc",
    name: "Arc",
    short: "Arc",
    publicRpc: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    sourceUrl: (a) => `https://sourcify.dev/server/v2/contract/5042/${a}`,
    nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
    mode: "native",
    token: { symbol: "USDC", decimals: 18 },
    gasSymbol: "USDC",
    testnet: false,
    relayByDefault: false,
  },
  {
    id: 4663,
    key: "robinhood",
    name: "Robinhood Chain",
    short: "Robinhood",
    publicRpc: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    sourceUrl: (a) => `https://robinhoodchain.blockscout.com/address/${a}?tab=contract`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    mode: "erc20",
    token: { symbol: "USDG", decimals: 6 },
    gasSymbol: "ETH",
    testnet: false,
    relayByDefault: true,
  },
  {
    id: 31337,
    key: "anvil",
    name: "Anvil (local)",
    short: "Local",
    publicRpc: "http://127.0.0.1:8545",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    mode: "erc20",
    token: { symbol: "USDC", decimals: 6 },
    gasSymbol: "ETH",
    testnet: true,
    relayByDefault: false,
  },
];

function build(b: Base): ChainConfig {
  const env = ENV[b.id as keyof typeof ENV];
  const dep = DEPLOYMENTS[String(b.id)];
  const serverRpc = b.publicRpc;
  const rpcUrl = env?.rpc || (b.relayByDefault ? relayUrl(b.id) : serverRpc);
  const explorerUrl = (env?.explorer ?? b.explorerUrl)?.replace(/\/$/, "");
  const chain = defineChain({
    id: b.id,
    name: b.name,
    nativeCurrency: b.nativeCurrency,
    rpcUrls: { default: { http: b.relayByDefault && rpcUrl !== b.publicRpc ? [rpcUrl, b.publicRpc] : [rpcUrl] } },
    ...(explorerUrl ? { blockExplorers: { default: { name: "Explorer", url: explorerUrl } } } : {}),
    testnet: b.testnet,
  });
  const tokenAddress = dep?.usdc && dep.usdc !== zero && isAddr(dep.usdc) ? dep.usdc : undefined;
  return {
    ...b,
    chain,
    rpcUrl,
    serverRpc,
    explorerUrl,
    token: { ...b.token, address: tokenAddress },
    // A deployment record with a real token address means ERC-20 mode, whatever the base says.
    mode: dep ? (tokenAddress ? "erc20" : "native") : b.mode,
    pyrisPact: isAddr(dep?.pyrisPact) ? dep!.pyrisPact : undefined,
    deployBlock: BigInt(dep?.deployBlock ?? 0),
  };
}

export const ALL_CHAINS: Record<number, ChainConfig> = Object.fromEntries(BASES.map((b) => [b.id, build(b)]));

function enabledIds(): number[] {
  const raw = process.env.NEXT_PUBLIC_CHAINS;
  if (raw && raw.trim()) {
    const ids = raw.split(",").map((s) => Number(s.trim())).filter((id) => ALL_CHAINS[id]);
    if (ids.length) return ids;
  }
  const deployed = Object.values(ALL_CHAINS).filter((c) => c.pyrisPact && !c.testnet).map((c) => c.id);
  if (deployed.length) return deployed;
  // Nothing deployed on a real chain: local development.
  return [31337];
}

/** Networks the app offers, in display order. */
export const CHAINS: ChainConfig[] = enabledIds().map((id) => ALL_CHAINS[id]);
export const CHAIN_IDS = CHAINS.map((c) => c.id);

export const DEFAULT_CHAIN_ID: number = (() => {
  const want = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID);
  return CHAIN_IDS.includes(want) ? want : CHAIN_IDS[0];
})();
export const DEFAULT_CHAIN = ALL_CHAINS[DEFAULT_CHAIN_ID];

export function getChain(chainId: number | undefined | null): ChainConfig | undefined {
  return chainId != null && CHAIN_IDS.includes(chainId) ? ALL_CHAINS[chainId] : undefined;
}

export function chainName(chainId: number | undefined | null): string {
  return (chainId != null && ALL_CHAINS[chainId]?.name) || `chain ${chainId ?? "?"}`;
}

/** "Arc and Robinhood Chain" for copy that lists the live networks. */
export const CHAIN_LIST_TEXT = CHAINS.map((c) => c.name).join(CHAINS.length === 2 ? " and " : ", ");
