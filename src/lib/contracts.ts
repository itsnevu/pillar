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
}

export type Pact = {
  id: bigint;
  client: Address;
  vendor: Address;
  amount: bigint;
  deadline: bigint;
  status: PactStatus;
  title: string;
  description: string;
  submissionNote: string;
  createdAt: bigint;
  submittedAt: bigint;
};

type Deployment = {
  chainId: number;
  deployer: Address;
  usdc?: Address;
  pyrisPact?: Address;
} | null;

export const DEPLOYMENT = deployment as unknown as Deployment;
export const hasDeployment = DEPLOYMENT !== null;

export const addresses = {
  pyrisPact: DEPLOYMENT?.pyrisPact ?? ("0x6Ff91FCe342a7B62A1A0d450dA73f7f25d6DB801" as Address),
  usdc: DEPLOYMENT?.usdc ?? ("0x0000000000000000000000000000000000000000" as Address),
} as const;

export const USDC_DECIMALS = 6;

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
        desc: "Flagged for arbitration or mediation.",
      };
    default:
      return { label: "Unknown", badgeClass: "", desc: "" };
  }
}
