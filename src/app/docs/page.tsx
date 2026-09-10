import Link from "next/link";
import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Docs — Pillar Finance",
  description:
    "How Pillar works: deposit tokenized stock as collateral, borrow USDG, and let the yield the collateral produces repay the debt.",
};

export default function Page() {
  return (
    <ProsePage
      title="How Pillar works"
      intro="Deposit tokenized stock, borrow USDG against it, and the yield your collateral produces pays the debt down. No schedule, no interest."
      updated="10 September 2026"
    >
      <Section heading="The loop">
        <p>
          You deposit a tokenized equity. It becomes collateral and is immediately forwarded to a yield source
          rather than sitting inert in a vault. You borrow USDG against it, up to that market&apos;s maximum
          loan-to-value, drawn from a treasury of USDG the protocol holds.
        </p>
        <p>
          Anyone can call <code>harvest()</code> on a position. That function pulls the yield the collateral has
          accrued, takes the protocol&apos;s 10% cut, and applies the rest to your debt, emitting a record of how
          much was repaid and what remains. If you have no debt at that moment, the yield is credited to you as
          claimable USDG instead of disappearing.
        </p>
      </Section>

      <Section heading="What it costs">
        <p>
          Pillar charges no interest on the loan. There is no repayment schedule and no maturity date, because
          nothing accrues against you. The protocol&apos;s only revenue is a 10% share of the yield your collateral
          produces, which means Pillar earns only while your collateral is working — our incentive and yours point
          the same direction.
        </p>
      </Section>

      <Section heading="A worked example">
        <p>
          Say you hold 10,000 USDG worth of tokenized Apple. Apple&apos;s market carries a maximum loan-to-value of
          40%, so that position supports a 4,000 USDG borrow while the collateral stays yours the whole time.
        </p>
        <p>
          At an illustrative 8% annual yield, the collateral generates roughly 800 a year. Pillar takes 10% of that
          and the remaining 720 goes against the 4,000 debt: down to roughly 3,280 after a year, around 2,500 after
          two, and zero somewhere in the fifth or sixth year — faster if the collateral appreciates, because a
          larger collateral value generates more yield. You never made a payment and never had a due date.
        </p>
      </Section>

      <Section heading="Loan-to-value limits">
        <p>
          Apple and Microsoft borrow at a maximum 40% loan-to-value, Nvidia at 35%, Tesla at 30%, and a broad market
          ETF at 50% because it is a basket rather than a single company. These are deliberately unexciting: equity
          markets close while your loan stays live, and a stock can gap on Monday with no window to trade out of the
          way. The full reasoning is on the <Link className="rusd-text-link" href="/risk">risk page</Link>.
        </p>
      </Section>

      <Section heading="When prices go stale">
        <p>
          If a price feed goes stale, Pillar blocks new borrows and collateral withdrawals — precisely the actions
          that could exploit a wrong number. It never blocks repayment, deposits, or the harvest, because those only
          improve your position, and you should never be locked out of making yourself safer.
        </p>
      </Section>

      <Section heading="Liquidation">
        <p>
          Positions are overcollateralised and can be liquidated. Liquidation is partial by construction: the
          contract computes the smallest repayment that restores your position to health and reverts anything
          larger, so you lose a slice rather than the position. It is a mathematical constraint in the contract, not
          a policy.
        </p>
      </Section>

      <Section heading="Using the app">
        <p>
          The <Link className="rusd-text-link" href="/app">portfolio page</Link> shows your loan-to-value, remaining
          debt, how much yield has already gone toward it, the estimated time until it reaches zero, and how far the
          price would have to fall before liquidation. Each market page — <code>/app/AAPL</code>, for example —
          handles deposit, borrow, repay, withdraw, and harvest for that asset.
        </p>
        <p>
          Connect any injected wallet. There is no account and no signup; see the{" "}
          <Link className="rusd-text-link" href="/privacy">privacy page</Link> for what the site does and does not
          see.
        </p>
      </Section>
    </ProsePage>
  );
}
