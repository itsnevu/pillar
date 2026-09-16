import Link from "next/link";

const FAQ: { q: string; a: any }[] = [
  {
    q: "Why use Arc Chain for programmable B2B payments?",
    a: (
      <p>
        Arc Chain is Circle&apos;s Layer-1 EVM network where the native gas fee is paid directly in
        <strong> USDC</strong>. Businesses and freelancers never need to purchase or manage volatile tokens
        just to fund an escrow or submit an invoice.
      </p>
    ),
  },
  {
    q: "How does a client get a refund if a contractor fails to deliver?",
    a: (
      <p>
        Every pact specifies an onchain milestone deadline. If the deadline passes without the contractor
        submitting work, the client can trigger the <code>refund()</code> function to immediately reclaim
        100% of the locked USDC.
      </p>
    ),
  },
  {
    q: "Can a contractor voluntarily cancel or decline a project?",
    a: (
      <p>
        Yes. At any time before release, a contractor can initiate a refund to return the escrowed
        funds back to the client immediately.
      </p>
    ),
  },
  {
    q: "What are the platform fees compared to traditional escrow services?",
    a: (
      <p>
        Traditional platforms like Upwork or Escrow.com charge 10% to 20% in platform cuts and currency
        conversion fees. Pyris Pact operates onchain with <strong>0% platform fee</strong> during open beta.
        You only pay the sub-cent Arc Chain gas fee (in USDC).
      </p>
    ),
  },
  {
    q: "What types of deliverables can be submitted?",
    a: (
      <p>
        The deliverable proof note can include GitHub pull request URLs, Figma links, IPFS content
        hashes, or encrypted document links. All timestamps and submissions are permanently recorded on
        Arc Chain.
      </p>
    ),
  },
  {
    q: "How does dispute handling work?",
    a: (
      <p>
        If the submitted work does not match agreed specifications, either party can mark the pact
        as <strong>Disputed</strong>, halting automatic state progression while parties resolve terms.
      </p>
    ),
  },
];

export function Faq() {
  return (
    <section className="rusd-faq" id="faq" aria-labelledby="faq-heading">
      <div className="rusd-faq-heading">
        <h2 id="faq-heading">Frequently asked questions</h2>
        <p>
          Learn how programmable milestone escrows protect both businesses and contractors on Arc Chain.
          Read the{" "}
          <Link className="rusd-text-link" href="/docs">
            technical documentation
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
