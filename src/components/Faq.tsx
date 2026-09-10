import Link from "next/link";

/** Answers are deliberately the unflattering ones; every claim here is enforced in the contract. */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What happens if the yield goes to zero?",
    a: (
      <p>
        Your debt stops shrinking. It does not grow — Pillar charges no interest and nothing accrues
        against you — but it does not disappear either. A self-repaying loan repays itself at the speed
        your collateral earns, and no faster.
      </p>
    ),
  },
  {
    q: "Can I still be liquidated?",
    a: (
      <>
        <p>
          Yes. Positions are overcollateralised and a position below a health factor of 1.0 can be
          liquidated. What the contract constrains is how much: it computes the smallest repayment that
          restores your position to health and reverts anything larger.
        </p>
        <p>
          You lose a slice rather than the position. That is a constraint in the code, not a policy we
          promise to follow.
        </p>
      </>
    ),
  },
  {
    q: "Why is the maximum LTV only 30–50%?",
    a: (
      <>
        <p>
          Because equity markets close and your loan does not. A tokenized stock follows a market that
          shuts on Friday and reopens on Monday, and it can open well below Friday&apos;s close with no
          window in which anyone could have traded out of the way.
        </p>
        <p>
          No faster oracle fixes that. The only honest response is to lend less against it, which is why
          a broad ETF is allowed more than a single company.
        </p>
      </>
    ),
  },
  {
    q: "What does Pillar charge?",
    a: (
      <p>
        No interest, no origination fee, and no early-repayment fee. The protocol takes 10% of the yield
        your collateral produces, which means it earns only while your collateral is working.
      </p>
    ),
  },
  {
    q: "What happens if a price feed breaks?",
    a: (
      <p>
        New borrowing and collateral withdrawal are blocked, because those are the actions that could
        exploit a wrong number. Repayment, deposits and the harvest are never blocked — you must never be
        locked out of making your own position safer.
      </p>
    ),
  },
  {
    q: "Can I repay early or take my collateral back?",
    a: (
      <p>
        Any time, at no cost. There is no interest schedule for early repayment to interrupt. Withdrawing
        collateral only requires the remaining debt to stay within the loan-to-value limit, and pulling
        principal out never forfeits yield you have already earned.
      </p>
    ),
  },
];

export function Faq() {
  return (
    <section className="rusd-faq" id="faq" aria-labelledby="faq-heading">
      <div className="rusd-faq-heading">
        <h2 id="faq-heading">Before you borrow</h2>
        <p>
          The questions worth asking, answered with the limits included. The longer version is in the{" "}
          <Link className="rusd-text-link" href="/risk">
            risk disclosure
          </Link>
          .
        </p>
      </div>
      <div className="rusd-faq-list">
        {FAQ.map(({ q, a }) => (
          <details key={q}>
            <summary>
              {q}
              <span className="rusd-faq-toggle" aria-hidden="true" />
            </summary>
            <div className="rusd-faq-answer">{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
