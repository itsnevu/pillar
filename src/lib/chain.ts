import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Swappable target: set NEXT_PUBLIC_CHAIN_ID / NEXT_PUBLIC_RPC_URL / NEXT_PUBLIC_CHAIN_NAME
// to point at Robinhood Chain (or any EVM) later. Defaults to a local Anvil node.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME ?? (chainId === 31337 ? "Anvil (local)" : "Robinhood Chain");
/** Block explorer origin, when the chain has one. Anvil does not. */
export const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL?.trim() || undefined;

export const pillarChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  ...(explorerUrl ? { blockExplorers: { default: { name: "Explorer", url: explorerUrl } } } : {}),
  testnet: chainId === 31337,
});

export const wagmiConfig = createConfig({
  chains: [pillarChain],
  connectors: [injected()],
  transports: { [pillarChain.id]: http(rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
