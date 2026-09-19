import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Privacy — Pyris Pact",
  description:
    "Pyris Pact has no account and no signup. What the site sees, what the chain records, and what we never collect.",
};

const TOC = [
  { id: "what-we-never-ask", heading: "What we never ask for" },
  { id: "what-the-site-sees", heading: "What the site sees" },
  { id: "what-the-chain-records", heading: "What the chain records" },
  { id: "third-parties", heading: "Who else is involved" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy"
      lede="Short, because there is not much to say. Most of what a service like this would normally collect, Pyris never receives."
      meta={["Updated 16 September 2026"]}
      toc={TOC}
    >
      <Section id="what-we-never-ask" heading="What we never ask for">
        <p>
          There is no account and no signup. Pyris does not ask for your name, your email, or identity
          documents, and there is no password to lose. We do not sell data, and we run no advertising and no
          cross-site tracking.
        </p>
      </Section>

      <Section id="what-the-site-sees" heading="What the site sees">
        <p>
          Your public wallet address, once you choose to connect it, plus ordinary web request data such as
          an IP address and a browser type — used to serve the site and to spot abuse, and nothing further.
        </p>
      </Section>

      <Section id="what-the-chain-records" heading="What the chain records">
        <p>
          Escrow deposits, deliverable submissions, releases, and refunds are recorded on the pact's chain, Arc or Robinhood Chain. They
          are readable by anyone, they are permanent, and they cannot be deleted — by us or by you. That is a
          property of the chain, not a policy choice, and it is worth understanding before your first
          transaction.
        </p>
      </Section>

      <Section id="third-parties" heading="Who else is involved">
        <p>
          Your browser talks directly to an RPC provider and to your wallet extension. Each of those is
          operated by someone else and carries its own policy, which governs what it sees.
        </p>
        <p>
          Questions: <a href="mailto:support@pyris.tech">support@pyris.tech</a>
        </p>
      </Section>
    </ProsePage>
  );
}

