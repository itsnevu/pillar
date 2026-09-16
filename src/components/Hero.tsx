import Link from "next/link";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.5 12h5m-2-2.25L14.75 12l-2.25 2.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const EXPLAINERS = [
  { label: "How milestone escrow works", href: "/docs#escrow-flow" },
  { label: "Why Arc Chain USDC gas", href: "/docs#arc-chain" },
];

export function Hero() {
  return (
    <section className="rusd-hero borrow-hero">
      <div className="rusd-hero-message">
        <h1>Programmable B2B Payments.</h1>
        <p className="rusd-hero-copy">
          Lock USDC into trustless milestone escrows for your contractors, freelancers, and agencies.
          Funds disburse immediately upon deliverable approval. Native USDC gas, zero wire delays, and
          cryptographic settlement on Arc Chain.
        </p>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "16px", marginBottom: "8px" }}>
          <Link
            href="/app"
            className="dockyard-wallet-button"
            style={{
              padding: "10px 22px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Launch Pact Dashboard →
          </Link>
        </div>
        <nav className="borrow-hero-videos" aria-label="Escrow explainers">
          {EXPLAINERS.map(({ label, href }) => (
            <div className="_action_coq5c_144" key={label}>
              <Link className="rusd-text-link _trigger_coq5c_1" href={href}>
                <ArrowIcon />
                {label}
              </Link>
            </div>
          ))}
        </nav>
      </div>

      <figure className="rusd-position-preview turret-loan-story">
        <img
          className="turret-loan-art"
          alt=""
          width={1536}
          height={1024}
          src="/illustrations/pyris-column.svg"
        />
        <div
          className="rusd-position-path"
          role="img"
          aria-label="Client deposits USDC into milestone escrow and releases funds upon completed deliverable"
        >
          <div className="rusd-position-node">
            <span>Client deposits</span>
            <strong>USDC</strong>
            <small>Locked Escrow</small>
          </div>
          <span aria-hidden="true" className="rusd-position-route">
            <svg fill="none" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="19" />
              <path d="M12.5 20h14M21 14.5l5.5 5.5-5.5 5.5" />
            </svg>
          </span>
          <div className="rusd-position-node">
            <span>Contractor receives</span>
            <strong>Instant Payout</strong>
            <small>Direct to Wallet</small>
          </div>
        </div>
        <figcaption>
          Funds remain locked in PyrisPact.sol until deliverables are reviewed and signed off by the client.
        </figcaption>
        <div className="rusd-position-safeguards">
          <span>Sub-second Arc settlement</span>
          <span>Native USDC gas fee</span>
        </div>
      </figure>
    </section>
  );
}
