import type { Address } from "viem";
import { PyrisPactAbi, IERC20MetadataAbi } from "./generated/abis";
import { ALL_CHAINS, DEFAULT_CHAIN, DEFAULT_CHAIN_ID, type ChainConfig } from "./chains";

export { PyrisPactAbi, IERC20MetadataAbi as Erc20Abi };

export enum PactStatus {
  FUNDED = 0,
  SUBMITTED = 1,
  RELEASED = 2,
  REFUNDED = 3,
  DISPUTED = 4,
  RESOLVED = 5,
}

/** Terminal states: no further transition is possible. */
export const isTerminal = (s: PactStatus) =>
  s === PactStatus.RELEASED || s === PactStatus.REFUNDED || s === PactStatus.RESOLVED;
/** States from which release / cancel / dispute are still possible. */
export const isActive = (s: PactStatus) => s === PactStatus.FUNDED || s === PactStatus.SUBMITTED;

export type Pact = {
  id: bigint;
  client: Address;
  vendor: Address;
  arbiter: Address;
  amount: bigint;
  deadline: bigint;
  status: PactStatus;
  title: string;
  description: string;
  submissionNote: string;
  createdAt: bigint;
  submittedAt: bigint;
  disputedAt: bigint;
  vendorShareBps: number;
};

/**
 * Per-chain contract addresses. Pyris is dual chain (Arc + Robinhood Chain); a pact
 * exists on exactly one of them. Use `useNetwork()` in components; these helpers are
 * for code that already knows the chain id.
 */
export function addressesFor(chainId: number): { pyrisPact: Address; usdc: Address } {
  const c: ChainConfig | undefined = ALL_CHAINS[chainId];
  return {
    pyrisPact: c?.pyrisPact ?? ("0x0000000000000000000000000000000000000000" as Address),
    usdc: c?.token.address ?? ("0x0000000000000000000000000000000000000000" as Address),
  };
}

/** Default network's addresses (Arc in production). Prefer addressesFor / useNetwork. */
export const addresses = addressesFor(DEFAULT_CHAIN_ID);
export const hasDeployment = DEFAULT_CHAIN.pyrisPact !== undefined;
/** First block to scan for PyrisPact events on the default network. */
export const DEPLOY_BLOCK = DEFAULT_CHAIN.deployBlock;

/**
 * Amount decimals follow the deployment mode: 18 for native value (Arc, where USDC is the
 * gas asset), the token's own decimals in ERC-20 mode (Robinhood Chain, USDG = 6).
 * Use `useNetwork().decimals` in components; this constant is the default network's.
 */
export const USDC_DECIMALS = DEFAULT_CHAIN.token.decimals;

// ------------------------------------------------------------- formatting

export function fmtUnits(v: bigint | undefined, decimals: number, digits = 2): string {
  if (v === undefined) return "—";
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, digits);
  const wholeStr = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${wholeStr}${digits > 0 ? "." + fracStr : ""}`;
}

/** Format an escrow amount for a given chain (decimals differ between Arc and Robinhood). */
export const fmtAmount = (v: bigint | undefined, decimals: number, d = 2) => fmtUnits(v, decimals, d);
/** Default-network formatter. Prefer `useNetwork().fmt` in components. */
export const fmtUsdc = (v?: bigint, d = 2) => fmtUnits(v, USDC_DECIMALS, d);

export function truncateAddress(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function fmtDate(timestamp?: bigint | number): string {
  if (!timestamp) return "—";
  const ms = typeof timestamp === "bigint" ? Number(timestamp) * 1000 : timestamp * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function pactStatusMeta(status: PactStatus): { label: string; badgeClass: string; desc: string } {
  switch (status) {
    case PactStatus.FUNDED:
      return {
        label: "In Escrow",
        badgeClass: "badge-funded",
        desc: "Funds are locked in contract. Work in progress.",
      };
    case PactStatus.SUBMITTED:
      return {
        label: "Deliverable Submitted",
        badgeClass: "badge-submitted",
        desc: "Contractor submitted proof. Awaiting client review.",
      };
    case PactStatus.RELEASED:
      return {
        label: "Completed & Paid",
        badgeClass: "badge-released",
        desc: "Client approved work. Funds disbursed to contractor.",
      };
    case PactStatus.REFUNDED:
      return {
        label: "Refunded",
        badgeClass: "badge-refunded",
        desc: "Pact cancelled or expired. Funds returned to client.",
      };
    case PactStatus.DISPUTED:
      return {
        label: "Disputed",
        badgeClass: "badge-disputed",
        desc: "Frozen until both parties agree on a split, or the arbiter rules.",
      };
    case PactStatus.RESOLVED:
      return {
        label: "Resolved",
        badgeClass: "badge-resolved",
        desc: "Dispute settled. Funds split per the agreed share.",
      };
    default:
      return { label: "Unknown", badgeClass: "", desc: "" };
  }
}
