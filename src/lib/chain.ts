import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Swappable target: set NEXT_PUBLIC_CHAIN_ID / NEXT_PUBLIC_RPC_URL / NEXT_PUBLIC_CHAIN_NAME
const isProd = process.env.NODE_ENV === "production";
const defaultChainId = isProd ? 5042 : 31337;
const defaultRpc = isProd ? "https://rpc.mainnet.arc.io" : "http://127.0.0.1:8545";
const defaultName = isProd ? "Arc Mainnet" : "Anvil (local)";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? defaultChainId);
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? defaultRpc;
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME ?? (chainId === 31337 ? "Anvil (local)" : defaultName);
/** Block explorer origin, when the chain has one. Anvil does not. */
export const explorerUrl =
  process.env.NEXT_PUBLIC_EXPLORER_URL?.trim() || (chainId === 5042 ? "https://explorer.arc.io" : undefined);

export const pyrisChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency:
    chainId === 31337
      ? { name: "Ether", symbol: "ETH", decimals: 18 }
      : { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  ...(explorerUrl ? { blockExplorers: { default: { name: "Explorer", url: explorerUrl } } } : {}),
  testnet: chainId === 31337,
});

export const wagmiConfig = createConfig({
  chains: [pyrisChain],
  connectors: [injected()],
  transports: { [pyrisChain.id]: http(rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
