"use client";

import Link from "next/link";

import { useMarkets } from "@/lib/hooks";
import { fmtPrice } from "@/lib/contracts";

type Market = {
  ticker: string;
  name: string;
  /** Oracle price, formatted. Undefined until the chain answers — never a placeholder. */
  value?: string;
  /** Max LTV in percent, read from the market. Undefined until the chain answers. */
  maxLtv?: number;
  state?: "open" | "closed";
  /** On-chain price exists but is older than the staleness window: borrowing is blocked. */
  stale?: boolean;
};

type Group = { title: string; markets: Market[] };

/**
 * Which table a ticker belongs in, and the display name to show beside it.
 * This is the only thing about a market that is hard-coded — a label, not a
 * number. Price, max LTV and open/closed are read from the chain, and a market
 * that is not in the deployment is not shown at all.
 */
const CATEGORY: Record<string, { title: string; name?: string }> = {
  AAPL: { title: "Stocks" },
  MSFT: { title: "Stocks" },
  GOOGL: { title: "Stocks" },
  AMZN: { title: "Stocks" },
  META: { title: "Stocks" },
  NVDA: { title: "Stocks" },
  AMD: { title: "Stocks" },
  MU: { title: "Stocks" },
  TSLA: { title: "Stocks" },
  SPY: { title: "ETFs" },
  QQQ: { title: "ETFs" },
  SLV: { title: "Metals" },
  CASHCAT: { title: "Memecoins" },
};

const CATEGORY_ORDER = ["Stocks", "ETFs", "Metals", "Memecoins", "Other"];

function StatusHeading() {
  return (
    <span className="turret-term-label">
      <span>Status</span>
      <span className="turret-field-info">
        <div>
          <button
            type="button"
            className="turret-info-trigger"
            aria-label="About vault status"
            aria-expanded={false}
          >
            <svg fill="none" viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"
              />
            </svg>
          </button>
        </div>
      </span>
    </span>
  );
}

function Status({ state }: { state: Market["state"] }) {
  const closed = state === "closed";
  return (
    <span className="borrow-directory-status rusd-market-status" data-state={closed ? "closed" : "open"}>
      <span aria-hidden="true" className="rusd-market-status-icon">
        {closed ? (
          <svg fill="none" viewBox="0 0 18 18" focusable="false">
            <circle cx="9" cy="9" r="5.25" />
            <path d="M5.3 12.7 12.7 5.3" />
          </svg>
        ) : (
          <svg fill="none" viewBox="0 0 18 18" focusable="false">
            <path d="m5 9.2 2.45 2.45L13.2 6" />
          </svg>
        )}
      </span>
      <span>{closed ? "Closed" : "Open"}</span>
    </span>
  );
}

function MarketTable({ group }: { group: Group }) {
  const n = group.markets.length;
  return (
    <section>
      <h2>{group.title}</h2>
      <table className="rusd-market-table">
        <caption className="borrow-table-caption">
          {n} collateral market{n === 1 ? "" : "s"} · Open means the vault is enabled. Borrow capacity is
          checked in the market.
        </caption>
        <thead>
          <tr>
            <th scope="col">Market</th>
            <th scope="col">
              <StatusHeading />
            </th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {group.markets.map((m) => (
            <tr className="borrow-directory-row" key={m.ticker}>
              <td>
                <div className="borrow-table-identity">
                  <strong>{m.ticker}</strong>
                  <span>{m.name}</span>
                </div>
                <div className="borrow-directory-value">
                  <span>Oracle price</span>
                  <span>{m.value ? `${m.value} USDG` : "—"}</span>
                </div>
                <div className="borrow-directory-value">
                  <span>Max LTV</span>
                  <span>{m.maxLtv !== undefined ? `${m.maxLtv}%` : "—"}</span>
                </div>
                {m.stale && (
                  <div className="borrow-directory-value">
                    <span>Oracle</span>
                    <span>Stale · borrowing paused</span>
                  </div>
                )}
              </td>
              <td>
                <Status state={m.state} />
              </td>
              <td>
                <Link
                  className="rusd-action rusd-action-secondary"
                  href={`/app/${m.ticker}`}
                  aria-label={`View ${m.ticker} market`}
                >
                  View market
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Markets() {
  const { markets, hasDeployment, isLoading, isError } = useMarkets();

  // Every row is a market the chain actually reports. There is no static price
  // table to fall back on: a number on this page is either read from the
  // contract or it is not shown.
  const byTitle = new Map<string, Market[]>();
  for (const m of markets) {
    const cat = CATEGORY[m.symbol] ?? { title: "Other" };
    const row: Market = {
      ticker: m.symbol,
      name: cat.name ?? m.name,
      value: m.price !== undefined ? fmtPrice(m.price) : undefined,
      maxLtv: m.maxLtvBps ? m.maxLtvBps / 100 : undefined,
      state: m.open ? "open" : "closed",
      stale: m.price !== undefined && !m.priceFresh,
    };
    const list = byTitle.get(cat.title);
    if (list) list.push(row);
    else byTitle.set(cat.title, [row]);
  }

  const groups: Group[] = CATEGORY_ORDER.filter((t) => byTitle.has(t)).map((title) => ({
    title,
    markets: byTitle.get(title)!,
  }));

  if (groups.length === 0) {
    return (
      <p className="borrow-directory-note" id="markets">
        {isLoading
          ? "Loading markets from the chain…"
          : isError || !hasDeployment
            ? "Markets are unavailable right now — the app could not reach the chain. Nothing on this page is a placeholder, so no figures are shown until it can."
            : "No markets are listed yet."}
      </p>
    );
  }

  return (
    <>
      <div className="borrow-original-tables" id="markets">
        {groups.map((g) => (
          <MarketTable key={g.title} group={g} />
        ))}
      </div>
      <p className="borrow-directory-note">
        Prices and limits above are read live from the protocol. Loan-to-value limits are set
        conservatively because equity markets close while your loan stays live.{" "}
        <Link href="/risk">How Pillar handles that risk</Link>.
      </p>
    </>
  );
}
