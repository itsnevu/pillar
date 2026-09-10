import type { Address } from "viem";
import {
  PillarCoreAbi,
  ChainlinkOracleAbi,
  ERC4626YieldSourceAbi,
  IERC20MetadataAbi,
} from "./generated/abis";
import { deployment } from "./generated/deployment";

/** `Erc20Abi` is the standard interface, not any particular token's implementation:
 *  USDG and the collateral tokens are issued by other people. */
export { PillarCoreAbi, ChainlinkOracleAbi, ERC4626YieldSourceAbi, IERC20MetadataAbi as Erc20Abi };

export type MarketMeta = {
  symbol: string;
  name: string;
  asset: Address;
  maxLtvBps: number;
  open: boolean;
};

type Deployment = {
  chainId: number;
  deployer: Address;
  usdg: Address;
  oracle: Address;
  yieldSource: Address;
  pillarCore: Address;
  markets: Record<string, MarketMeta>;
} | null;

export const DEPLOYMENT = deployment as unknown as Deployment;
export const hasDeployment = DEPLOYMENT !== null;

export const addresses = {
  pillarCore: DEPLOYMENT?.pillarCore,
  usdg: DEPLOYMENT?.usdg,
  oracle: DEPLOYMENT?.oracle,
  yieldSource: DEPLOYMENT?.yieldSource,
} as const;

/** Static market list from the deployment (ticker-keyed). */
export const MARKETS: MarketMeta[] = DEPLOYMENT
  ? Object.values(DEPLOYMENT.markets).map((m) => ({ ...m, asset: m.asset as Address }))
  : [];

export function marketBySymbol(symbol: string): MarketMeta | undefined {
  return MARKETS.find((m) => m.symbol.toUpperCase() === symbol.toUpperCase());
}

export const USDG_DECIMALS = 6;
export const STOCK_DECIMALS = 18;
export const WAD = 10n ** 18n;
export const BPS = 10_000n;

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

export const fmtUsdg = (v?: bigint, d = 2) => fmtUnits(v, USDG_DECIMALS, d);
export const fmtStock = (v?: bigint, d = 4) => fmtUnits(v, STOCK_DECIMALS, d);
export const fmtPrice = (p?: bigint) => fmtUnits(p, 18, 2);

export function fmtBps(bps?: bigint | number): string {
  if (bps === undefined) return "—";
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  if (!Number.isFinite(n) || n > 1e9) return "∞";
  return `${(n / 100).toFixed(1)}%`;
}

/** Health factor 1e18 → "1.25×" (or "∞"). */
export function fmtHealth(hf?: bigint): string {
  if (hf === undefined) return "—";
  if (hf >= 2n ** 200n) return "∞";
  return `${(Number(hf) / 1e18).toFixed(2)}×`;
}

/** Seconds → "5.6 years" / "43 days" / "—". */
export function fmtDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "—";
  if (seconds <= 0) return "0";
  const d = seconds / 86400;
  if (d >= 365) return `${(d / 365).toFixed(1)} years`;
  if (d >= 1) return `${Math.ceil(d)} days`;
  return `${Math.ceil(seconds / 3600)} hours`;
}

export function truncateAddress(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/** Distance to liquidation in % of price drop: 1 - debt / (collValue * liqThreshold). */
export function distanceToLiquidationPct(hf?: bigint): number | undefined {
  if (hf === undefined || hf >= 2n ** 200n) return undefined;
  const h = Number(hf) / 1e18;
  if (h <= 1) return 0;
  return (1 - 1 / h) * 100;
}
