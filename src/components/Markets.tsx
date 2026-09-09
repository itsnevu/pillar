"use client";

import { useMarkets } from "@/lib/hooks";
import { fmtPrice } from "@/lib/contracts";

type Market = {
  ticker: string;
  name: string;
  value: string;
  maxLtv: number;
  state?: "open" | "closed";
  /** On-chain price exists but is older than the staleness window: borrowing is blocked. */
  stale?: boolean;
};

type Group = { title: string; markets: Market[] };

const GROUPS: Group[] = [
  {
    title: "Stocks",
    markets: [
      { ticker: "AAPL", name: "Apple", value: "312.6794", maxLtv: 40 },
      { ticker: "MSFT", name: "Microsoft", value: "491.6189", maxLtv: 40 },
      { ticker: "GOOGL", name: "Alphabet", value: "331.6927", maxLtv: 40 },
      { ticker: "AMZN", name: "Amazon", value: "251.527", maxLtv: 40 },
      { ticker: "META", name: "Meta Platforms", value: "651.7102", maxLtv: 35 },
      { ticker: "NVDA", name: "Nvidia", value: "224.6168", maxLtv: 35 },
      { ticker: "AMD", name: "AMD", value: "524.5592", maxLtv: 35 },
      { ticker: "MU", name: "Micron", value: "1,023.4692", maxLtv: 30 },
      { ticker: "TSLA", name: "Tesla", value: "368.1579", maxLtv: 30 },
    ],
  },
  {
    title: "ETFs",
    markets: [
      { ticker: "SPY", name: "S&P 500 ETF", value: "761.5574", maxLtv: 50 },
      { ticker: "QQQ", name: "Nasdaq-100 ETF", value: "716.9059", maxLtv: 45 },
    ],
  },
  {
    title: "Metals",
    markets: [{ ticker: "SLV", name: "Silver", value: "61.4422", maxLtv: 35, state: "closed" }],
  },
  {
    title: "Memecoins",
    markets: [{ ticker: "CASHCAT", name: "Cash Cat", value: "0.1755", maxLtv: 15 }],
  },
];

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
                  <span>Indicative value</span>
                  <span>{m.value} USDG</span>
                </div>
                <div className="borrow-directory-value">
                  <span>Max LTV</span>
                  <span>{m.maxLtv}%</span>
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
                <a
                  className="rusd-action rusd-action-secondary"
                  href={`/app/${m.ticker}`}
                  aria-label={`View ${m.ticker} market`}
                >
                  View market
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Markets() {
  const { markets, hasDeployment } = useMarkets();

  // Overlay on-chain status, LTV and oracle price onto the static rows, matched by ticker.
  // Falls back to the static values whenever the chain has no deployment or a read failed.
  const live = new Map(markets.map((m) => [m.symbol, m]));
  const groups: Group[] = GROUPS.map((g) => ({
    ...g,
    markets: g.markets.map((m) => {
      const l = hasDeployment ? live.get(m.ticker) : undefined;
      if (!l) return m;
      return {
        ...m,
        value: l.price !== undefined ? fmtPrice(l.price) : m.value,
        maxLtv: l.maxLtvBps ? l.maxLtvBps / 100 : m.maxLtv,
        state: l.open ? ("open" as const) : ("closed" as const),
        stale: l.price !== undefined && !l.priceFresh,
      };
    }),
  }));

  return (
    <>
      <div className="borrow-original-tables">
        {groups.map((g) => (
          <MarketTable key={g.title} group={g} />
        ))}
      </div>
      <p className="borrow-directory-note">
        Want fixed terms instead? <a href="/borrow/fixed-term">Explore fixed-term loans</a>.
      </p>
    </>
  );
}
