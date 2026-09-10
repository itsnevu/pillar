import Link from "next/link";
import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Risk — Pillar Finance",
  description:
    "The honest limits of a self-repaying loan: yield can stop, collateral markets close while the loan stays live, liquidation is partial but real.",
};

export default function Page() {
  return (
    <ProsePage
      title="Risk"
      intro="Everything below is a limit of the product, stated in the same place rather than scattered through the marketing."
      updated="10 September 2026"
    >
      <Section heading="Yield can stop, and then so does the repayment">
        <p>
          A self-repaying loan repays itself at the speed the collateral earns, and no faster. If the yield rate
          goes to zero your debt stops shrinking. It does not grow — Pillar charges no interest and nothing accrues
          against you — but it does not disappear either. Any estimate of time-to-zero on the dashboard is a
          projection from the current rate, not a promise.
        </p>
      </Section>

      <Section heading="The collateral market closes; your loan does not">
        <p>
          A tokenized equity tracks a market that shuts on Friday afternoon and does not reopen until Monday. Your
          loan stays live every second in between. On Monday that stock can open well below Friday&apos;s close on an
          earnings miss or an overnight headline, with no window in which anyone could have traded out of the way.
        </p>
        <p>
          There is no mechanism that removes this — not a faster oracle and not a dynamic curve. The only honest
          response is to lend less against it, which is why maximum loan-to-value sits at 30–50% depending on the
          market and why a broad ETF is allowed more than a single company. Conservative limits reduce the risk.
          They do not remove it.
        </p>
      </Section>

      <Section heading="Liquidation is partial, but it is real">
        <p>
          When a position becomes unhealthy, the contract computes the smallest repayment that restores it to health
          and reverts any liquidation attempting to seize more. You lose a slice, not the position. That is a
          constraint enforced in the contract rather than a policy we promise to follow — but you can still lose
          part of your collateral, and a large enough gap can move a healthy position to an unhealthy one between
          blocks.
        </p>
        <p>
          Your health factor, current loan-to-value, and the percentage the price would have to fall before
          liquidation are shown continuously on the <Link className="rusd-text-link" href="/app">dashboard</Link>.
        </p>
      </Section>

      <Section heading="Oracles can go stale">
        <p>
          When a price feed is stale, Pillar blocks new borrows and collateral withdrawals, because those are the
          actions that could exploit a wrong number. Repayment, deposits, and the yield harvest are never blocked —
          a user should never be locked out of making their own position safer. The cost of this is that borrowing
          may be unavailable for a period you did not choose.
        </p>
      </Section>

      <Section heading="Smart contract and counterparty risk">
        <p>
          Pillar is software. Bugs in the protocol, in the yield source it routes collateral to, in the oracle it
          reads, or in the token contracts themselves can cause loss. The USDG you borrow comes from a treasury the
          protocol holds; borrowing depends on that treasury having a balance. Yield depends on an external venue
          continuing to produce it.
        </p>
        <p>
          The protocol is in open beta. Start with small amounts. See also the{" "}
          <Link className="rusd-text-link" href="/terms">terms</Link> and the{" "}
          <Link className="rusd-text-link" href="/docs">documentation</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
