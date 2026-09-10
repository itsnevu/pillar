import { ProsePage } from "@/components/ProsePage";

export const metadata = {
  title: "Terms — Pillar Finance",
  description: "Pillar Finance is software, not a bank. The terms, the limits, and what you are responsible for.",
};

export default function Page() {
  return (
    <ProsePage eyebrow="Legal" title="Terms" lede="Pillar Finance is software, not a bank or a lender of record. What that means for you." meta={["Updated 10 September 2026"]}>
          <p>Pillar Finance is software, not a bank or a lender of record. It is provided as is, without warranty, and responsibility for your own funds stays with you.</p>
          <p>Pillar charges no interest on a loan. The protocol takes a share of the yield your collateral produces. If that yield falls to zero, your debt stops shrinking. It never grows on its own, but it does not disappear either.</p>
          <p>Loans are overcollateralised and can be liquidated. Liquidation is partial by construction: the contract computes the smallest repayment that restores your position to health and rejects anything larger. You can still lose part of your collateral.</p>
          <p>Collateral is tokenized equities and other assets whose underlying markets close. A price can gap while those markets are shut and your loan is live. Loan to value limits are set conservatively for that reason, but they do not remove the risk.</p>
          <p>New borrowing and collateral withdrawals are blocked whenever a price feed is stale. Repayment, deposits, and yield harvesting are never blocked.</p>
          <p>The protocol is in open beta. Nothing here is investment advice. You are responsible for your own tax position and local law.</p>
          <p>Questions: support@pillar.finance</p>
    </ProsePage>
  );
}
