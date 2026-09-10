"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { AppShell, Badge, Stat } from "@/components/app/AppShell";
import { HealthGauge } from "@/components/app/HealthGauge";
import { ActionPanel } from "@/components/app/ActionPanel";
import { useUserPositions, useMounted } from "@/lib/hooks";
import { fmtDuration, fmtPrice, fmtStock, fmtUsdg, marketBySymbol, truncateAddress } from "@/lib/contracts";

export function MarketView({ symbol }: { symbol: string }) {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <Inner symbol={symbol} />
      </Suspense>
    </AppShell>
  );
}

function Inner({ symbol }: { symbol: string }) {
  const meta = marketBySymbol(symbol);
  const { address: connected } = useAccount();
  const sp = useSearchParams();
  const viewParam = sp.get("address");
  const viewing = (viewParam && isAddress(viewParam) ? (viewParam as Address) : undefined) ?? connected;
  const mounted = useMounted();

  const { positions, refetch } = useUserPositions(mounted ? viewing : undefined);
  const pos = positions.find((p) => p.market.symbol === symbol);

  if (!meta) {
    return (
      <section className="pt-[44px]">
        <h1 className="font-serif text-[40px] text-ink">Unknown market</h1>
        <p className="mt-3 text-muted">
          No market <span className="font-mono">{symbol}</span> in the current deployment.{" "}
          <Link href="/" className="underline underline-offset-2 text-ink">Back to markets</Link>
        </p>
      </section>
    );
  }

  const market = pos?.market ?? { ...meta, priceFresh: undefined, liqThresholdBps: meta.maxLtvBps + 1000, liqBonusBps: 500, hasDeployment: false, price: undefined };
  // Three states, not two: fresh, stale, and not yet known. Reporting the third as
  // "stale" tells the reader the protocol has paused borrowing when in fact the
  // page simply has not heard back.
  const priceKnown = market.priceFresh !== undefined;
  const isOwn = viewing && connected && viewing.toLowerCase() === connected.toLowerCase();

  return (
    <>
      <section className="pt-[44px]">
        <Link href="/app" className="text-[12.5px] text-muted hover:text-ink">← Portfolio</Link>
        <div className="mt-3 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-[40px] leading-[1.05] text-ink">{meta.symbol}</h1>
              <Badge tone={market.open ? "ok" : "muted"}>{market.open ? "Open" : "Closed for new borrows"}</Badge>
              {priceKnown && (
                <Badge tone={market.priceFresh ? "ok" : "warn"}>
                  {market.priceFresh ? "Price fresh" : "Price stale"}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-[14px] text-muted">{meta.name} · tokenized stock collateral · borrow USDG</p>
          </div>
          {viewing && !isOwn && (
            <div className="text-[12.5px] text-muted">Viewing <span className="font-mono text-ink">{truncateAddress(viewing)}</span> (read-only)</div>
          )}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Oracle price"
          value={market.price === undefined ? "—" : `$${fmtPrice(market.price)}`}
          sub={!priceKnown ? "not read yet" : market.priceFresh ? "fresh" : "stale — new borrows paused"}
        />
        <Stat label="Max LTV" value={`${market.maxLtvBps / 100}%`} sub={`liquidation at ${market.liqThresholdBps / 100}% · bonus ${market.liqBonusBps / 100}%`} />
        <Stat label="Market collateral" value={fmtStock(market.totalCollateral, 2)} sub={`${meta.symbol} deposited`} />
        <Stat label="Market debt" value={fmtUsdg(market.totalDebt, 0)} sub="USDG borrowed" />
      </section>

      <section className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        <div className="space-y-6">
          <div className="rounded-[12px] border border-line bg-surface p-6">
            <div className="text-[11px] tracking-[0.12em] uppercase text-muted mb-4">
              {viewing ? "Position health" : "Connect to see your position"}
            </div>
            <HealthGauge hf={pos?.healthFactor} ltvBps={pos?.ltvBps} maxLtvBps={market.maxLtvBps} liqThresholdBps={market.liqThresholdBps} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* With no position read, a sub-line reads as a broken sentence
                ("can still borrow —"), so it falls back to the bare unit. */}
            <Stat
              label="Your collateral"
              value={fmtStock(pos?.collateral, 4)}
              sub={pos ? `${meta.symbol} · ${fmtUsdg(pos.collateralValue, 0)} USDG` : meta.symbol}
            />
            <Stat
              label="Your debt"
              value={fmtUsdg(pos?.debt)}
              sub={pos ? `USDG · can still borrow ${fmtUsdg(pos.maxBorrowable, 0)}` : "USDG"}
            />
            <Stat
              label="Repaid by yield"
              value={fmtUsdg(pos?.yieldAccruedToDebt)}
              sub={pos ? `USDG · +${fmtUsdg(pos.yieldRateToDebt * 86_400n)} / day` : "USDG"}
              accent
            />
            <Stat
              label="Est. time to zero"
              value={!pos || pos.debt === 0n ? (pos?.collateral ? "Paid" : "—") : fmtDuration(pos.secondsToZero)}
              sub={
                !pos
                  ? "no open position"
                  : pos.debt > 0n && !pos.secondsToZero
                    ? "yield is zero — debt holds, never grows"
                    : "at current yield rate"
              }
            />
          </div>

          <div className="rounded-[12px] border border-line bg-soft p-5 text-[12.5px] leading-[1.65] text-muted">
            <span className="font-semibold text-ink">How liquidation works here.</span> If health drops below 1.0×, a liquidator may repay
            at most the amount that brings it back to exactly 1.0× and receives collateral worth that amount plus a {market.liqBonusBps / 100}%
            bonus. Anything larger reverts. Pending yield is applied first, so a position that yield already rescued cannot be liquidated.
          </div>
        </div>

        <ActionPanel market={market} position={pos} onDone={refetch} />
      </section>
    </>
  );
}
