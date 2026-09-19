import Link from "next/link";

const FAQ: { q: string; a: any }[] = [
  {
    q: "Which networks does Pyris Pact run on?",
    a: (
      <p>
        Two. <strong>Arc</strong>, Circle&apos;s Layer-1 where gas is paid directly in native <strong>USDC</strong>,
        and <strong>Robinhood Chain</strong>, an Ethereum Layer-2 where escrows are held in <strong>USDG</strong>
        (a 6-decimal dollar stablecoin) and gas costs a few cents of ETH. The same contract runs on both; a pact
        lives on the network it was created on, and you pick the network in the header.
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
        You only pay the network gas fee: sub-cent USDC on Arc, a few cents of ETH on Robinhood Chain.
      </p>
    ),
  },
  {
    q: "What types of deliverables can be submitted?",
    a: (
      <p>
        The deliverable proof note can include GitHub pull request URLs, Figma links, IPFS content
        hashes, or encrypted document links. All timestamps and submissions are permanently recorded on
        the pact&apos;s chain, Arc or Robinhood Chain.
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
          Learn how programmable milestone escrows protect both businesses and contractors on Arc and Robinhood Chain.
          Read the{" "}
          <Link className="rusd-text-link" href="/docs">
            technical documentation
          </Link>
          .
        </p>
        <img
          className="rusd-faq-art"
          alt=""
          width={1536}
          height={1024}
          src="/illustrations/pyris-arch.svg"
        />
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

export default Faq;
