import Link from "next/link";
import { ProsePage, Section, Note } from "@/components/ProsePage";

export const metadata = {
  title: "Whitepaper — Pillar Finance",
  description:
    "Pillar Finance: self-repaying credit against tokenized equities. Mechanism, parameters, oracle policy, liquidation, and the limits of the design.",
};

const TOC = [
  { id: "abstract", heading: "Abstract" },
  { id: "problem", heading: "The problem" },
  { id: "mechanism", heading: "Mechanism" },
  { id: "yield", heading: "Defining yield" },
  { id: "parameters", heading: "Risk parameters" },
  { id: "oracle", heading: "Oracle policy" },
  { id: "liquidation", heading: "Liquidation" },
  { id: "revenue", heading: "Revenue and incentives" },
  { id: "limits", heading: "Limits" },
  { id: "status", heading: "Status" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Whitepaper · v1.0"
      title="Self-repaying credit against tokenized equities"
      lede="A borrower deposits a tokenized equity, borrows a stablecoin against it, and the yield the collateral produces retires the debt. No interest accrues, no schedule exists, and the position is never closed."
      meta={["Version 1.0", "10 September 2026", "~12 min read"]}
      toc={TOC}
      numbered
      footNote="This document describes deployed contract behaviour, not a roadmap."
    >
      <Section id="abstract" heading="Abstract">
        <p>
          Pillar is a lending protocol in which the collateral pays the loan. A borrower deposits a
          tokenized equity into an isolated market, borrows USDG against it at a conservative
          loan-to-value ratio, and the collateral is forwarded to a yield venue rather than held
          inert. The yield that collateral produces is periodically converted to USDG and applied to
          the borrower&apos;s debt. The protocol charges no interest, so the debt is monotonically
          non-increasing: it falls when the collateral earns and is otherwise unchanged.
        </p>
        <p>
          The design&apos;s distinguishing constraint is the collateral itself. Tokenized equities
          track markets that close, while the debt they back remains live continuously. Pillar treats
          this as an irreducible risk rather than something to engineer away, and prices it into
          deliberately low loan-to-value limits.
        </p>
      </Section>

      <Section id="problem" heading="The problem">
        <p>
          An investor who needs cash and holds appreciated assets has, in practice, one accessible
          option: sell. Selling ends the upside, closes a position built on a thesis that may still be
          intact, and in many jurisdictions realises a taxable event. None of these are consequences
          of being wrong about the asset. They are consequences of needing liquidity on a particular
          day.
        </p>
        <p>
          Borrowing against a portfolio instead of selling it is not a novel instrument. It is a
          standard service offered to people who already hold enough to be offered it. The mechanism
          has existed for decades; access to it has not. Pillar implements that mechanism as a
          contract with fixed parameters rather than a relationship with a private bank.
        </p>
      </Section>

      <Section id="mechanism" heading="Mechanism">
        <p>
          Each collateral asset has its own isolated market with its own parameters and its own yield
          venue. A market never shares risk with another: a failure in one asset&apos;s vault or feed
          cannot propagate into a second market&apos;s positions.
        </p>
        <p>The lifecycle of a position is four operations.</p>
        <p>
          <strong>Deposit.</strong> Collateral is transferred in and immediately forwarded to the
          market&apos;s yield source, which deposits it into an ERC-4626 vault. It does not sit idle
          while it backs a loan.
        </p>
        <p>
          <strong>Borrow.</strong> USDG is drawn from a protocol treasury, bounded by the
          market&apos;s maximum loan-to-value applied to the oracle value of the collateral. No
          interest rate is attached, and no maturity date is recorded, because neither exists.
        </p>
        <p>
          <strong>Harvest.</strong> Anyone may call <code>harvest</code> on any position — the
          borrower, a keeper, a stranger. It realises the yield the position has accrued, takes the
          protocol&apos;s share, converts the remainder to USDG, and applies it to the debt, emitting
          a record of how much was repaid and what remains. If the position carries no debt at that
          moment, the proceeds are credited to the borrower as claimable USDG rather than discarded.
        </p>
        <p>
          <strong>Withdraw.</strong> Collateral is redeemable at any time, subject only to the
          remaining debt staying within the loan-to-value bound. Withdrawing principal never forfeits
          unharvested yield.
        </p>
        <Note>
          Because no interest accrues, debt is a monotonically non-increasing quantity. A borrower who
          never interacts with the protocol again never owes more than they owed on the day they
          borrowed.
        </Note>
      </Section>

      <Section id="yield" heading="Defining yield">
        <p>
          Yield is defined as share appreciation in the vault and nothing else. The yield source
          records the principal deposited, holds the vault shares that principal bought, and treats
          the surplus — the current asset value of those shares minus the recorded principal — as the
          only harvestable quantity.
        </p>
        <p>
          This definition is symmetric, which matters more than it sounds. A vault that loses value
          produces a surplus of zero rather than a negative number the adapter would have to
          interpret. There is no accrual schedule to fall behind, no assumed rate to reconcile, and
          no circumstance in which the protocol reports yield the vault did not produce. Conversions
          round in the vault&apos;s favour, so the surplus reported is never more than the surplus
          that exists, and principal remains fully redeemable.
        </p>
        <p>
          Because a real vault pays in the collateral asset rather than in USDG, harvesting redeems
          exactly the surplus and swaps it through a router. The minimum acceptable output is computed
          from the oracle price less a bounded slippage tolerance. A swap that cannot be filled within
          that bound reverts the entire harvest, leaving the debt untouched — the protocol does not
          book a repayment it did not receive.
        </p>
        <p>
          The rate displayed to a borrower is realised rather than projected: total value earned since
          the first deposit divided by elapsed time. A new position therefore reports approximately
          zero until the vault has actually produced something. A projected rate would look better on
          a dashboard and would mean considerably less.
        </p>
      </Section>

      <Section id="parameters" heading="Risk parameters">
        <p>
          Every market carries three parameters. Maximum loan-to-value bounds new borrowing. The
          liquidation threshold, set ten percentage points above it, is the level at which a position
          becomes liquidatable. The liquidation bonus compensates a liquidator for the repayment.
        </p>
        <div className="pillar-table-wrap">
          <table className="pillar-table">
            <thead>
              <tr>
                <th scope="col">Market</th>
                <th scope="col">Max LTV</th>
                <th scope="col">Liq. threshold</th>
                <th scope="col">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Broad-market ETF</td>
                <td>50%</td>
                <td>60%</td>
                <td>A basket; single-name news cannot gap the whole index.</td>
              </tr>
              <tr>
                <td>Large-cap equity</td>
                <td>40%</td>
                <td>50%</td>
                <td>Deep liquidity, but a single issuer&apos;s earnings can gap it.</td>
              </tr>
              <tr>
                <td>High-volatility equity</td>
                <td>30–35%</td>
                <td>40–45%</td>
                <td>Larger historical overnight moves demand more headroom.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          These numbers are deliberately unexciting, and the reason is structural. A tokenized equity
          follows a market that closes on Friday and reopens on Monday, while the loan it backs stays
          live every second in between. A position can gap fifteen percent on an overnight headline
          with no window in which anyone could have traded out of the way. No oracle latency
          improvement and no interest-rate curve addresses this; the gap is risk manufactured by a
          closed market. The only honest response is to lend less against it. A thirty percent loan
          against an asset that gaps fifteen percent is comfortably safe. A seventy percent loan
          against the same asset is a liquidation waiting for a Monday.
        </p>
      </Section>

      <Section id="oracle" heading="Oracle policy">
        <p>
          Prices come from Chainlink-shaped aggregators, one per asset, normalised to a common scale.
          The oracle adapter refuses to report a price it cannot defend: a zero or negative answer, or
          a round the aggregator never completed. It reverts rather than returning a sentinel, because
          a caller that receives a revert cannot act on a bad number, whereas a caller that receives
          zero might.
        </p>
        <p>
          Each feed may additionally carry a ceiling. Aggregators have historically clamped answers to
          a circuit-breaker band and continued reporting the clamped value as though it were
          observed; a ceiling lets the protocol reject a feed that has visibly pinned rather than lend
          against a fiction.
        </p>
        <p>
          Staleness is a separate decision, and it lives in one place. The adapter reports the
          feed&apos;s observation timestamp faithfully; the core protocol compares it against a
          configured window. When a price is stale, new borrowing and collateral withdrawal are
          blocked, because those are the actions that could exploit a wrong number. Repayment,
          deposit, and harvest are never blocked, because those actions only improve a borrower&apos;s
          position. A user must never be locked out of making themselves safer.
        </p>
      </Section>

      <Section id="liquidation" heading="Liquidation">
        <p>
          A position whose health factor falls below one may be liquidated. Liquidation is partial by
          construction: the contract computes the smallest repayment that restores the position to
          health and reverts any attempt to repay more. A liquidator takes a slice and the borrower
          keeps a position.
        </p>
        <p>
          The distinction worth stating precisely is that this is a constraint enforced in the
          contract, not a policy the protocol undertakes to follow. An over-liquidation transaction
          does not merely violate a guideline; it does not execute. Pending yield is applied to the
          debt before the liquidation amount is computed, so a borrower is never liquidated for value
          their own collateral had already earned.
        </p>
      </Section>

      <Section id="revenue" heading="Revenue and incentives">
        <p>
          The protocol takes ten percent of harvested yield. It charges no interest, no origination
          fee, and no early-repayment fee, and it holds no claim that grows with time.
        </p>
        <p>
          This has a consequence worth making explicit: Pillar earns only while a borrower&apos;s
          collateral is productive. The protocol cannot profit from a borrower&apos;s distress, from a
          longer loan, or from a higher rate, because none of those quantities appear in its revenue.
          The incentive to keep collateral in a venue that genuinely produces yield is the same
          incentive the borrower has.
        </p>
      </Section>

      <Section id="limits" heading="Limits">
        <p>
          A self-repaying loan repays itself at the speed the collateral earns, and no faster. If the
          yield rate goes to zero, the debt stops shrinking. It does not grow — nothing accrues
          against the borrower — but it does not disappear either. Any statement of a self-repaying
          loan that omits this is describing a brochure rather than a product.
        </p>
        <p>
          Liquidation is real. Partial liquidation limits the damage; it does not eliminate it, and a
          sufficiently large overnight gap can move a position from healthy to liquidatable between
          blocks with no intervening opportunity to act.
        </p>
        <p>
          The protocol depends on systems it does not control: the vault that produces yield, the
          aggregator that reports price, the venue that fills the conversion swap, and the issuers of
          the collateral tokens and of USDG. Failure in any of them is a failure the borrower
          experiences. Borrowing additionally depends on the treasury holding a balance.
        </p>
        <p>
          A borrower should never encounter any of this by surprise. Health factor, current
          loan-to-value, yield already applied to the debt, estimated time to zero, and the price
          decline that would trigger liquidation are all displayed continuously. A protocol that hides
          a user&apos;s distance to failure is not protecting them from anxiety; it is protecting
          itself from their questions.
        </p>
      </Section>

      <Section id="status" heading="Status">
        <p>
          The protocol is in open beta and has not been audited. The contracts, their test suite, and
          the deployment scripts are public. Nothing in this document describes intended future
          behaviour: it describes what the deployed contracts do.
        </p>
        <p>
          For the operational view, see <Link href="/docs">how Pillar works</Link>; for the limits in
          user-facing language, see the <Link href="/risk">risk page</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
