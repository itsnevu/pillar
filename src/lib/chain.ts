import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAINS, DEFAULT_CHAIN } from "./chains";

/**
 * wagmi config over every enabled network (Arc and Robinhood Chain in production, Anvil
 * locally). The transport for each chain is its browser RPC from chains.ts: the public
 * endpoint for Arc, the same-origin /api/rpc relay for Robinhood Chain whose public RPC
 * is filtered by some ISPs.
 *
 * "Which chain am I on" is not decided here: see network.tsx.
 */
const chains = CHAINS.map((c) => c.chain) as [(typeof CHAINS)[number]["chain"], ...(typeof CHAINS)[number]["chain"][]];

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: Object.fromEntries(CHAINS.map((c) => [c.id, http(c.rpcUrl)])),
  ssr: true,
});

/** The default network's viem chain. Kept for code that needs a single chain object. */
export const pyrisChain = DEFAULT_CHAIN.chain;
/** Default network's explorer. Prefer useNetwork().explorerUrl in components. */
export const explorerUrl = DEFAULT_CHAIN.explorerUrl;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
