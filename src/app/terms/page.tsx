import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Terms — Pillar Finance",
  description:
    "Pillar Finance is software, not a bank. The terms, the limits, and what you are responsible for.",
};

const TOC = [
  { id: "what-this-is", heading: "What this is" },
  { id: "what-it-costs", heading: "What it costs" },
  { id: "what-you-risk", heading: "What you risk" },
  { id: "when-it-refuses", heading: "When it refuses to act" },
  { id: "your-responsibility", heading: "Your responsibility" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms"
      lede="Plain language, and the unflattering parts included. Nothing here is written to be skimmed past."
      meta={["Updated 10 September 2026"]}
      toc={TOC}
    >
      <Section id="what-this-is" heading="What this is">
        <p>
          Pillar Finance is software, not a bank and not a lender of record. It is provided as is, without
          warranty, and responsibility for your own funds stays with you. There is no institution behind it
          that can reverse a transaction, restore a lost key, or make you whole.
        </p>
      </Section>

      <Section id="what-it-costs" heading="What it costs">
        <p>
          Pillar charges no interest on a loan, no origination fee and no early-repayment fee. The protocol
          takes a 10% share of the yield your collateral produces, and nothing else.
        </p>
        <p>
          If that yield falls to zero, your debt stops shrinking. It never grows on its own, but it does not
          disappear either.
        </p>
      </Section>

      <Section id="what-you-risk" heading="What you risk">
        <p>
          Loans are overcollateralised and can be liquidated. Liquidation is partial by construction: the
          contract computes the smallest repayment that restores your position to health and rejects
          anything larger. You can still lose part of your collateral.
        </p>
        <p>
          Collateral is tokenized equities and other assets whose underlying markets close. A price can gap
          while those markets are shut and your loan is live. Loan-to-value limits are set conservatively for
          that reason, but they do not remove the risk.
        </p>
        <p>
          Pillar depends on systems it does not operate: the vault that produces yield, the price feed, the
          venue that fills the conversion swap, and the issuers of the collateral tokens and of USDG. A
          failure in any of them is a failure you experience.
        </p>
      </Section>

      <Section id="when-it-refuses" heading="When it refuses to act">
        <p>
          New borrowing and collateral withdrawals are blocked whenever a price feed is stale. Repayment,
          deposits and yield harvesting are never blocked, because those actions only make your position
          safer.
        </p>
      </Section>

      <Section id="your-responsibility" heading="Your responsibility">
        <p>
          The protocol is in open beta and has not been audited. Nothing here is investment advice. You are
          responsible for your own tax position and for whether any of this is lawful where you live.
        </p>
        <p>
          Questions: <a href="mailto:support@pillar.finance">support@pillar.finance</a>
        </p>
      </Section>
    </ProsePage>
  );
}
