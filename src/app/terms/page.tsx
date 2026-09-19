import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Terms — Pyris Pact",
  description:
    "Pyris Pact is non-custodial milestone escrow software on Arc and Robinhood Chain. The terms, parameters, and user responsibilities.",
};

const TOC = [
  { id: "what-this-is", heading: "What this is" },
  { id: "what-it-costs", heading: "What it costs" },
  { id: "what-you-risk", heading: "Escrow and settlement risks" },
  { id: "your-responsibility", heading: "Your responsibility" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms of Use"
      lede="Plain language, clear parameters. Pyris Pact is software that interacts directly with smart contracts on Arc and Robinhood Chain."
      meta={["Updated 16 September 2026"]}
      toc={TOC}
    >
      <Section id="what-this-is" heading="What this is">
        <p>
          Pyris Pact is non-custodial software, not a bank, not an employer, and not an escrow agent of
          record. It provides an interface to <code>PyrisPact.sol</code> deployed on Arc and on Robinhood Chain. Responsibility
          for verifying counterparty addresses and milestone deliverables resides entirely with the user.
        </p>
      </Section>

      <Section id="what-it-costs" heading="What it costs">
        <p>
          Pyris Pact charges 0% platform fees during the open beta period. All transactions require the network
          gas fee: paid in USDC on Arc, and in ETH on Robinhood Chain. On Robinhood Chain the escrow asset is USDG.
        </p>
      </Section>

      <Section id="what-you-risk" heading="Escrow and settlement risks">
        <p>
          Funds deposited into an escrow pact are held by the smart contract. Releasing funds to a
          contractor is permanent and cannot be reversed by the protocol developers or any central entity.
          Clients must review submitted deliverables before triggering <code>releaseFunds()</code>.
        </p>
        <p>
          In the event of a deadline expiry where deliverables were not submitted, the client may reclaim
          their funds via the onchain <code>refund()</code> mechanism.
        </p>
      </Section>

      <Section id="your-responsibility" heading="Your responsibility">
        <p>
          You are responsible for safeguarding your private keys, evaluating your commercial counterparties,
          and managing your own tax and regulatory obligations.
        </p>
        <p>
          Questions: <a href="mailto:support@pyris.tech">support@pyris.tech</a>
        </p>
      </Section>
    </ProsePage>
  );
}
