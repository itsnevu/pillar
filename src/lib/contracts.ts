import type { Address } from "viem";
import { PyrisPactAbi, IERC20MetadataAbi } from "./generated/abis";
import { deployment } from "./generated/deployment";

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

type Deployment = {
  chainId: number;
  deployer: Address;
  usdc?: Address;
  pyrisPact?: Address;
  deployBlock?: number;
} | null;

export const DEPLOYMENT = deployment as unknown as Deployment;
export const hasDeployment = DEPLOYMENT !== null;

export const addresses = {
  pyrisPact: DEPLOYMENT?.pyrisPact ?? ("0xb5f905f48321F44e379d8680e947dDd05830AF62" as Address),
  usdc: DEPLOYMENT?.usdc ?? ("0x0000000000000000000000000000000000000000" as Address),
} as const;

/** First block to scan for PyrisPact events; nothing exists before deployment. */
export const DEPLOY_BLOCK = BigInt(DEPLOYMENT?.deployBlock ?? 0);

/**
 * The contract is deployed in native mode (usdcToken = address(0)), so amounts
 * are msg.value in Arc's native USDC, which the EVM exposes with 18 decimals.
 * Switch to 6 only if redeployed against the ERC-20 USDC token.
 */
export const USDC_DECIMALS = 18;

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
        desc: "USDC is locked in contract. Work in progress.",
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
        desc: "Client approved work. USDC disbursed to contractor.",
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
