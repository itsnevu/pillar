"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { MARKETS, PillarCoreAbi, ChainlinkOracleAbi, addresses, hasDeployment, type MarketMeta } from "./contracts";

export type MarketLive = MarketMeta & {
  /** Oracle price, USD per token, 1e18. */
  price?: bigint;
  priceUpdatedAt?: bigint;
  priceFresh: boolean;
  liqThresholdBps: number;
  liqBonusBps: number;
  totalCollateral?: bigint;
  totalDebt?: bigint;
  hasDeployment: boolean;
};

export type UserPosition = {
  market: MarketLive;
  collateral: bigint;
  debt: bigint;
  yieldAccruedToDebt: bigint;
  collateralValue: bigint;
  ltvBps: bigint;
  healthFactor: bigint;
  maxBorrowable: bigint;
  pendingYield: bigint;
  /** USDG (6 dec) per second flowing to debt after protocol cut. */
  yieldRateToDebt: bigint;
  /** Seconds until debt hits zero at the current yield rate; undefined if rate is 0 or debt is 0. */
  secondsToZero?: number;
};

const noop = () => () => {};
/** true after hydration, false during SSR — without a setState-in-effect. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

const core = addresses.pillarCore as Address | undefined;
const oracle = addresses.oracle as Address | undefined;

/**
 * Live view of every listed market: open flag, LTV/threshold, oracle price + freshness.
 * Falls back to the static deployment metadata (and `hasDeployment: false`) when no
 * deployment file exists or the chain is unreachable.
 */
export function useMarkets() {
  const contracts = useMemo(
    () =>
      hasDeployment && core && oracle
        ? MARKETS.flatMap((m) => [
            { address: core, abi: PillarCoreAbi, functionName: "markets", args: [m.asset] } as const,
            { address: oracle, abi: ChainlinkOracleAbi, functionName: "getPrice", args: [m.asset] } as const,
            { address: core, abi: PillarCoreAbi, functionName: "isPriceFresh", args: [m.asset] } as const,
          ])
        : [],
    [],
  );

  const q = useReadContracts({ contracts, query: { enabled: contracts.length > 0 } });

  const markets: MarketLive[] = useMemo(
    () =>
      MARKETS.map((m, i) => {
        const mk = q.data?.[i * 3]?.result as
          | readonly [boolean, boolean, number, number, number, number, bigint, bigint, bigint, bigint, Address]
          | undefined;
        const pr = q.data?.[i * 3 + 1]?.result as readonly [bigint, bigint] | undefined;
        const fresh = q.data?.[i * 3 + 2]?.result as boolean | undefined;
        return {
          ...m,
          open: mk ? mk[1] : m.open,
          maxLtvBps: mk ? Number(mk[3]) : m.maxLtvBps,
          liqThresholdBps: mk ? Number(mk[4]) : m.maxLtvBps + 1000,
          liqBonusBps: mk ? Number(mk[5]) : 500,
          totalCollateral: mk?.[7],
          totalDebt: mk?.[8],
          price: pr?.[0],
          priceUpdatedAt: pr?.[1],
          priceFresh: fresh ?? false,
          hasDeployment: hasDeployment && q.isSuccess,
        };
      }),
    [q.data, q.isSuccess],
  );

  return { markets, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, hasDeployment };
}

/** Positions for `address` across all markets, with derived risk numbers. */
export function useUserPositions(address?: Address) {
  const { markets, ...rest } = useMarkets();
  const contracts = useMemo(
    () =>
      address && core
        ? MARKETS.flatMap((m) => {
            const args = [address, m.asset] as const;
            return [
              { address: core, abi: PillarCoreAbi, functionName: "getPosition", args } as const,
              { address: core, abi: PillarCoreAbi, functionName: "collateralValue", args } as const,
              { address: core, abi: PillarCoreAbi, functionName: "ltv", args } as const,
              { address: core, abi: PillarCoreAbi, functionName: "healthFactor", args } as const,
              { address: core, abi: PillarCoreAbi, functionName: "maxBorrowable", args } as const,
              { address: core, abi: PillarCoreAbi, functionName: "pendingYield", args } as const,
              { address: core, abi: PillarCoreAbi, functionName: "yieldRateToDebt", args } as const,
            ];
          })
        : [],
    [address],
  );
  const q = useReadContracts({ contracts, query: { enabled: contracts.length > 0 } });

  const credit = useReadContracts({
    contracts: address && core ? [{ address: core, abi: PillarCoreAbi, functionName: "usdgCredit", args: [address] } as const] : [],
    query: { enabled: !!address && !!core },
  });

  const positions: UserPosition[] = useMemo(() => {
    if (!q.data) return [];
    const N = 7;
    return markets.map((market, i) => {
      const pos = q.data[i * N]?.result as
        | { collateral: bigint; debt: bigint; yieldAccruedToDebt: bigint; yieldIndexSnapshot: bigint }
        | undefined;
      const g = (k: number) => (q.data?.[i * N + k]?.result as bigint | undefined) ?? 0n;
      const debt = pos?.debt ?? 0n;
      const rate = g(6);
      return {
        market,
        collateral: pos?.collateral ?? 0n,
        debt,
        yieldAccruedToDebt: pos?.yieldAccruedToDebt ?? 0n,
        collateralValue: g(1),
        ltvBps: g(2),
        healthFactor: (q.data?.[i * N + 3]?.result as bigint | undefined) ?? 2n ** 256n - 1n,
        maxBorrowable: g(4),
        pendingYield: g(5),
        yieldRateToDebt: rate,
        secondsToZero: debt > 0n && rate > 0n ? Number(debt) / Number(rate) : undefined,
      };
    });
  }, [q.data, markets]);

  const active = positions.filter((p) => p.collateral > 0n || p.debt > 0n);
  const totals = active.reduce(
    (a, p) => ({
      collateralValue: a.collateralValue + p.collateralValue,
      debt: a.debt + p.debt,
      yieldAccruedToDebt: a.yieldAccruedToDebt + p.yieldAccruedToDebt,
      yieldRateToDebt: a.yieldRateToDebt + p.yieldRateToDebt,
    }),
    { collateralValue: 0n, debt: 0n, yieldAccruedToDebt: 0n, yieldRateToDebt: 0n },
  );

  return {
    positions,
    active,
    totals,
    usdgCredit: (credit.data?.[0]?.result as bigint | undefined) ?? 0n,
    isLoading: q.isLoading || rest.isLoading,
    isError: q.isError,
    refetch: () => {
      q.refetch();
      credit.refetch();
      rest.refetch();
    },
    hasDeployment,
  };
}
