"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { AppShell, Badge, Stat } from "@/components/app/AppShell";
import { useUserPositions, useMounted } from "@/lib/hooks";
import { distanceToLiquidationPct, fmtBps, fmtDuration, fmtHealth, fmtStock, fmtUsdg, truncateAddress } from "@/lib/contracts";

export default function PortfolioPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <Portfolio />
      </Suspense>
    </AppShell>
  );
}

function Portfolio() {
  const { address: connected } = useAccount();
  const sp = useSearchParams();
  const viewParam = sp.get("address");
  const viewing = (viewParam && isAddress(viewParam) ? (viewParam as Address) : undefined) ?? connected;
  const mounted = useMounted();

  const { active, totals, usdgCredit, isLoading, hasDeployment } = useUserPositions(mounted ? viewing : undefined);

  const secondsToZero = totals.debt > 0n && totals.yieldRateToDebt > 0n ? Number(totals.debt) / Number(totals.yieldRateToDebt) : undefined;
  const aggLtv = totals.collateralValue > 0n ? (totals.debt * 10_000n) / totals.collateralValue : 0n;

  return (
    <>
      <section className="pt-[44px]">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Portfolio</h1>
            <p className="mt-3 max-w-[620px] text-[14px] leading-[1.65] text-muted">
              Every position, live. Debt only moves in one direction on its own: down. If yield goes to zero it stops
              shrinking, but it never grows — Pillar charges no interest.
            </p>
          </div>
          {viewing && (
            <div className="text-[12.5px] text-muted">
              Viewing <span className="font-mono text-ink">{truncateAddress(viewing)}</span>
              {viewParam && connected !== viewing && <span className="ml-2">(read-only)</span>}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Collateral value" value={`${fmtUsdg(totals.collateralValue, 0)}`} sub="USDG, at last oracle price" />
        <Stat label="Remaining debt" value={`${fmtUsdg(totals.debt)}`} sub={`USDG · aggregate LTV ${fmtBps(aggLtv)}`} />
        <Stat
          label="Yield → debt so far"
          value={`${fmtUsdg(totals.yieldAccruedToDebt)}`}
          sub={`USDG · flowing at ${fmtUsdg(totals.yieldRateToDebt * 86_400n)} / day`}
          accent
        />
        <Stat
          label="Est. time to zero"
          value={totals.debt === 0n ? "Paid" : fmtDuration(secondsToZero)}
          sub={totals.debt > 0n && !secondsToZero ? "Yield is currently zero" : "at current yield rate"}
        />
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[26px] leading-tight text-ink">Your positions</h2>
          {usdgCredit > 0n && (
            <span className="text-[12.5px] text-muted">
              Claimable yield credit: <span className="text-ink">{fmtUsdg(usdgCredit)} USDG</span>
            </span>
          )}
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          Health factor below 1.0× makes a position eligible for partial liquidation — the smallest slice that restores health, never the whole position.
        </p>

        <div className="mt-6 border-t border-line">
          <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_1fr_1fr_0.8fr_0.9fr_1fr_120px] items-center h-[42px] text-[11px] tracking-[0.12em] uppercase text-muted border-b border-line">
            <div>Market</div><div>Collateral</div><div>Debt</div><div>LTV</div><div>Health</div><div>Time to zero</div><div className="text-right">Action</div>
          </div>

          {!mounted || (!hasDeployment && !isLoading) ? (
            <Empty>{hasDeployment ? "Loading…" : "No deployment found. Start a chain and deploy first."}</Empty>
          ) : !viewing ? (
            <Empty>Connect a wallet to see your positions, or append <span className="font-mono">?address=0x…</span> to view any account read-only.</Empty>
          ) : isLoading ? (
            <Empty>Loading positions…</Empty>
          ) : active.length === 0 ? (
            <Empty>
              No positions yet. Pick a market on the <Link href="/" className="underline underline-offset-2 text-ink">landing page</Link> to deposit collateral.
            </Empty>
          ) : (
            active.map((p) => {
              const dist = distanceToLiquidationPct(p.healthFactor);
              const risky = p.debt > 0n && p.healthFactor < 12n * 10n ** 17n;
              return (
                <div
                  key={p.market.symbol}
                  className="grid grid-cols-2 md:grid-cols-[minmax(0,1.2fr)_1fr_1fr_0.8fr_0.9fr_1fr_120px] gap-y-3 items-center border-b border-line py-6"
                >
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-[14px] font-bold text-ink leading-tight">{p.market.symbol}</div>
                    <div className="text-[13px] text-ink mt-1">{p.market.name}</div>
                    <div className="mt-2 flex gap-1.5">
                      <Badge tone={p.market.open ? "ok" : "muted"}>{p.market.open ? "Open" : "Closed"}</Badge>
                      {!p.market.priceFresh && <Badge tone="warn">Stale price</Badge>}
                    </div>
                  </div>
                  <Cell label="Collateral">
                    {fmtStock(p.collateral)} {p.market.symbol}
                    <div className="text-[11.5px] text-muted">{fmtUsdg(p.collateralValue, 0)} USDG</div>
                  </Cell>
                  <Cell label="Debt">
                    {fmtUsdg(p.debt)} USDG
                    <div className="text-[11.5px] text-accent-dark">−{fmtUsdg(p.yieldAccruedToDebt)} repaid by yield</div>
                  </Cell>
                  <Cell label="LTV">{p.debt === 0n ? "—" : fmtBps(p.ltvBps)}<div className="text-[11.5px] text-muted">max {p.market.maxLtvBps / 100}%</div></Cell>
                  <Cell label="Health">
                    <span className={risky ? "text-accent-dark" : ""}>{fmtHealth(p.healthFactor)}</span>
                    <div className="text-[11.5px] text-muted">{dist === undefined ? "no debt" : `${dist.toFixed(1)}% to liq.`}</div>
                  </Cell>
                  <Cell label="Time to zero">
                    {p.debt === 0n ? "Paid" : fmtDuration(p.secondsToZero)}
                    <div className="text-[11.5px] text-muted">{fmtUsdg(p.yieldRateToDebt * 86_400n)} USDG/day</div>
                  </Cell>
                  <div className="col-span-2 md:col-span-1 md:text-right">
                    <Link
                      href={`/app/${p.market.symbol}${viewParam ? `?address=${viewParam}` : ""}`}
                      className="inline-flex items-center justify-center rounded-pill bg-ink text-surface text-[13px] font-medium px-5 h-11 hover:bg-black transition-colors"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-[13px] text-ink">
      <div className="md:hidden text-[11px] tracking-[0.12em] uppercase text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-14 text-center text-[13.5px] text-muted">{children}</div>;
}
