export function Tabs() {
  return (
    <>
      <nav className="borrow-navigation" aria-label="Loan types">
        <a href="/borrow/self-repaying" aria-current="page">
          Self-repaying loans
        </a>
        <a href="/borrow/fixed-term">Fixed-term loans</a>
        <a href="/portfolio">Portfolio</a>
      </nav>
      <p className="borrow-pool-summary">
        <strong>Self-repaying loans:</strong> deposit stock tokens, borrow USDG at a conservative LTV, and
        your collateral is routed to yield that pays the debt down automatically. If yield falls to zero the
        debt stops shrinking — it never grows on its own. With <a href="/borrow/fixed-term">fixed-term loans</a>,
        you agree fixed interest and a deadline instead.
      </p>
    </>
  );
}
