/**
 * The three operations a position goes through, in the order they happen.
 * Uses Turret's `rusd-explainer` / `rusd-borrow-flow` pair, which lays out
 * exactly three numbered steps — so this list is three items by construction.
 */
export function HowItWorks() {
  return (
    <section className="rusd-explainer" id="how" aria-labelledby="how-heading">
      <div className="rusd-explainer-heading">
        <h2 id="how-heading">How it works</h2>
        <p>Three steps. Only the first two are yours.</p>
      </div>
      <ol className="rusd-borrow-flow">
        <li>
          <strong>Deposit your stock tokens</strong>
          <p>
            They become collateral and go straight to a yield vault. Nothing sits idle while it backs
            your loan, and no oracle is needed to deposit.
          </p>
        </li>
        <li>
          <strong>Borrow USDG against them</strong>
          <p>
            Up to that market&apos;s max LTV, drawn from the protocol treasury. No interest, no
            schedule, no maturity date — nothing accrues against you.
          </p>
        </li>
        <li>
          <strong>The yield pays it down</strong>
          <p>
            Anyone can harvest a position. Pillar takes 10% of the yield; the rest goes onto your debt.
            You are not required to do anything at all.
          </p>
        </li>
      </ol>
    </section>
  );
}
