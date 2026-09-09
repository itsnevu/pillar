function PlayIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10 8 6 4-6 4Z" fill="currentColor" />
    </svg>
  );
}

const EXPLAINERS = ["How self-repay works", "How collateral earns"];

export function Hero() {
  return (
    <section className="rusd-hero borrow-hero">
      <div className="rusd-hero-message">
        <h1>Never sell. Never repay.</h1>
        <p className="rusd-hero-copy">
          Borrow USDG against your Robinhood Crypto tokenized stocks and let the yield repay the loan for
          you. Your position stays open the entire time.
        </p>
        <div className="borrow-hero-videos" aria-label="Loan explainers">
          {EXPLAINERS.map((label) => (
            <div className="_action_coq5c_144" key={label}>
              <button aria-haspopup="dialog" className="rusd-text-link _trigger_coq5c_1" type="button">
                <PlayIcon />
                {label}
              </button>
            </div>
          ))}
        </div>
      </div>

      <figure className="rusd-position-preview turret-loan-story">
        <img
          className="turret-loan-art"
          alt=""
          width={1536}
          height={1024}
          src="/illustrations/pillar-column.svg"
        />
        <div
          className="rusd-position-path"
          role="img"
          aria-label="Deposit stock tokens as collateral and borrow USDG against them"
        >
          <div className="rusd-position-node">
            <span>You deposit</span>
            <strong>Stock tokens</strong>
            <small>Collateral</small>
          </div>
          <span aria-hidden="true" className="rusd-position-route">
            <svg fill="none" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="19" />
              <path d="M12.5 20h14M21 14.5l5.5 5.5-5.5 5.5" />
            </svg>
          </span>
          <div className="rusd-position-node">
            <span>You borrow</span>
            <strong>USDG</strong>
            <small>Stablecoin</small>
          </div>
        </div>
        <figcaption>Your collateral earns while it backs the loan. That yield is applied to your debt.</figcaption>
        <div className="rusd-position-safeguards">
          <span>Loan terms apply</span>
          <span>Availability varies</span>
        </div>
      </figure>
    </section>
  );
}
