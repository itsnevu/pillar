export function HowItWorks() {
  return (
    <section className="rusd-explainer" id="how" aria-labelledby="how-heading">
      <div className="rusd-explainer-heading">
        <h2 id="how-heading">How Pyris Pact works</h2>
        <p>Three simple steps. Trustless milestone escrow from agreement to settlement.</p>
        <img
          className="rusd-explainer-art"
          alt=""
          width={1536}
          height={1024}
          src="/illustrations/pyris-scales.svg"
        />
      </div>
      <ol className="rusd-borrow-flow">
        <li>
          <strong>1. Fund the Milestone (Client)</strong>
          <p>
            Deposit USDC into smart contract escrow. Specify contractor address, deliverable scope,
            and deadline. Funds remain locked in the PyrisPact smart contract on Arc or Robinhood Chain.
          </p>
        </li>
        <li>
          <strong>2. Submit Proof of Work (Contractor)</strong>
          <p>
            The contractor executes the project and posts proof of completion (GitHub PR, Figma design,
            or deliverable note) directly onchain for instant client review.
          </p>
        </li>
        <li>
          <strong>3. One-Click Instant Payout</strong>
          <p>
            The client reviews the submitted deliverable and approves payment with one click. USDC is
            transferred directly to the contractor in seconds, on the network the pact was created on.
          </p>
        </li>
      </ol>
    </section>
  );
}
