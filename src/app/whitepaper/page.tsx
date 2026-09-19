import Link from "next/link";
import { ProsePage, Section, Note } from "@/components/ProsePage";

export const metadata = {
  title: "Whitepaper — Pyris Pact",
  description:
    "Pyris Pact Whitepaper: Programmable B2B Payments & Milestone Escrow on Arc and Robinhood Chain. Contract specification, deployment modes, state machine transitions, and dispute resolution.",
};

const TOC = [
  { id: "abstract", heading: "Abstract" },
  { id: "problem", heading: "The Problem in Global B2B Payments" },
  { id: "core-pillars", heading: "Core Pillars: Programmable B2B Payments" },
  { id: "architecture", heading: "Smart Contract Architecture (PyrisPact.sol)" },
  { id: "state-machine", heading: "State Machine & Conditional Disbursal" },
  { id: "networks", heading: "Networks & Deployment Modes: Arc and Robinhood Chain" },
  { id: "invoice-tracking", heading: "Onchain Invoicing & Milestone Tracking" },
  { id: "case-study", heading: "Reference Case: Agency & Freelancer Settlement" },
  { id: "security-refund", heading: "Timeout Refunds & Non-Custodial Invariants" },
  { id: "dispute-resolution", heading: "Dispute Resolution" },
  { id: "conclusion", heading: "Conclusion & Protocol Status" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Whitepaper · v2.0"
      title="Programmable B2B Payments & Smart Contract Escrow"
      lede="A non-custodial protocol for businesses that pay freelancers, vendors, or agencies automatically, on conditions both sides agreed to, settled on Arc or Robinhood Chain."
      meta={["Version 2.1", "20 September 2026", "~11 min read"]}
      toc={TOC}
      numbered
      footNote="Technical specification of PyrisPact.sol as deployed on Arc Mainnet (native mode) and Robinhood Chain (ERC-20 mode)."
    >
      <Section id="abstract" heading="Abstract">
        <p>
          <strong>Pyris Pact</strong> is a non-custodial programmable payments protocol built for modern B2B
          commerce. It lets businesses, agencies, and global companies lock USDC into smart contract escrow before
          work begins, and release it the moment deliverables are approved.
        </p>
        <p>
          Pyris Pact is dual chain. On <strong>Arc</strong>, Circle&rsquo;s EVM Layer-1 where gas is paid in native
          USDC, it removes the friction of volatile gas tokens entirely. On <strong>Robinhood Chain</strong>, an
          Ethereum Layer-2, the same contract escrows USDG with gas of a few cents. On both it removes the latency of
          bank wires and the 10–20% commission taken by centralised freelance marketplaces.
        </p>
      </Section>

      <Section id="problem" heading="The Problem in Global B2B Payments">
        <p>
          Transactions between businesses (clients, agencies) and service providers (freelancers, vendors) suffer
          from structural inefficiencies:
        </p>
        <ul>
          <li>
            <strong>Platform fee extraction:</strong> conventional freelance platforms (Upwork, Freelancer,
            Escrow.com) take 10% to 20% of project value, hold funds for 5–14 days, and can freeze accounts
            unilaterally.
          </li>
          <li>
            <strong>Wire transfer latency and cost:</strong> cross-border payments over SWIFT take 3–5 business
            days, cost $30–$50 per transfer, and lose a further 2–4% to FX markups.
          </li>
          <li>
            <strong>Trust deficit:</strong> clients hesitate to pay up front without proof of progress; freelancers
            hesitate to deliver final work without certainty that funds exist.
          </li>
        </ul>
      </Section>

      <Section id="core-pillars" heading="Core Pillars: Programmable B2B Payments">
        <p>Pyris Pact rests on four foundations:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong>Smart contract escrow:</strong> USDC is held autonomously by an onchain contract, not in an
            intermediary&rsquo;s database.
          </li>
          <li>
            <strong>Payment after approval:</strong> funds move only when the client has reviewed and approved the
            deliverable.
          </li>
          <li>
            <strong>Invoice and payment tracking:</strong> payment status, milestones, and proof of work are
            recorded permanently on the blockchain.
          </li>
          <li>
            <strong>Stablecoin-native settlement:</strong> escrow value is always a dollar stablecoin (USDC on Arc,
            USDG on Robinhood Chain); on Arc even gas is settled in USDC.
          </li>
        </ol>
      </Section>

      <Section id="architecture" heading="Smart Contract Architecture (PyrisPact.sol)">
        <p>
          The heart of the protocol is the autonomous contract <code>PyrisPact.sol</code>. Each milestone is a single
          struct identified by a unique <code>pactId</code>:
        </p>
        <pre className="p-4 bg-soft rounded-[8px] text-[12px] font-mono overflow-x-auto">
{`enum PactStatus {
    FUNDED,      // 0: client deposited USDC into escrow
    SUBMITTED,   // 1: contractor submitted deliverable / proof
    RELEASED,    // 2: client approved; USDC paid to contractor
    REFUNDED,    // 3: funds returned to client (timeout / cancel)
    DISPUTED,    // 4: frozen; awaiting agreed split or arbiter ruling
    RESOLVED     // 5: dispute settled; funds split per vendorShareBps
}

struct Pact {
    uint256 id;
    address client;
    address vendor;
    address arbiter;        // optional; address(0) = mutual settlement only
    uint256 amount;
    uint256 deadline;
    PactStatus status;
    string title;
    string description;
    string submissionNote;
    uint256 createdAt;
    uint256 submittedAt;
    uint256 disputedAt;
    uint16  vendorShareBps; // set on RESOLVED
}`}
        </pre>
        <Note>
          Contract invariant: escrowed funds can only flow to the <code>vendor</code>, back to the{" "}
          <code>client</code>, or be split between the two according to an agreed <code>vendorShareBps</code>. No
          third party, including the deployer, can move funds.
        </Note>
      </Section>

      <Section id="state-machine" heading="State Machine & Conditional Disbursal">
        <p>The protocol implements a deterministic state machine:</p>
        <div className="py-4 font-mono text-[12.5px] bg-soft p-4 rounded-[8px] border border-line">
          [CLIENT: createPact] ──► FUNDED (0)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▼ [VENDOR: submitWork, before deadline]<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SUBMITTED (1)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▼ [CLIENT: releaseFunds]<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RELEASED (2)  ──► 100% USDC paid to vendor
        </div>
        <p>
          From FUNDED or SUBMITTED, the vendor may cancel (REFUNDED), the client may reclaim after the deadline if
          nothing was submitted (REFUNDED), and either party may freeze the pact (DISPUTED). A dispute ends in
          RESOLVED.
        </p>
      </Section>

      <Section id="networks" heading="Networks & Deployment Modes: Arc and Robinhood Chain">
        <p>
          <code>PyrisPact.sol</code> is written once and deployed per network. The constructor takes one argument,{" "}
          <code>_usdcToken</code>, which fixes the escrow mode for that deployment:
        </p>
        <pre className="p-4 bg-soft rounded-[8px] text-[12px] font-mono overflow-x-auto">
{`constructor(address _usdcToken)           // address(0) = native mode, else ERC-20 mode

// createPact, native mode (Arc):     amount == msg.value, 18 decimals
// createPact, ERC-20 mode (Robinhood): msg.value == 0; usdcToken.transferFrom(client, this, amount)
// payouts:  native -> call{value}; ERC-20 -> usdcToken.transfer; failures land in pendingWithdrawals`}
        </pre>
        <table className="w-full text-[13px] my-4">
          <thead>
            <tr className="text-left text-muted border-b border-line">
              <th className="py-2 pr-4">Network</th>
              <th className="py-2 pr-4">Mode</th>
              <th className="py-2 pr-4">Escrow asset</th>
              <th className="py-2 pr-4">Gas</th>
              <th className="py-2">Contract</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-2 pr-4"><strong>Arc Mainnet</strong> · 5042</td>
              <td className="py-2 pr-4">native</td>
              <td className="py-2 pr-4">USDC, 18 decimals</td>
              <td className="py-2 pr-4">USDC, ~$0.001</td>
              <td className="py-2 font-mono text-[11.5px]">0xb5f905f48321F44e379d8680e947dDd05830AF62</td>
            </tr>
            <tr>
              <td className="py-2 pr-4"><strong>Robinhood Chain</strong> · 4663</td>
              <td className="py-2 pr-4">ERC-20</td>
              <td className="py-2 pr-4">USDG, 6 decimals</td>
              <td className="py-2 pr-4">ETH, a few cents</td>
              <td className="py-2 font-mono text-[11.5px]">0xf7c81a882594b3f3ddd969ebfa750e30eedaead3</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Arc</strong> solves gas token fragmentation at the protocol level: corporate clients keep a single
          asset on the balance sheet. The client locks $1,000 USDC, pays about $0.001 USDC in gas, and the vendor
          receives $1,000 USDC, with sub-second finality.
        </p>
        <p>
          <strong>Robinhood Chain</strong> is an Arbitrum Orbit Layer-2 settling to Ethereum (ArbOS 61 at the time of
          writing). Gas is ETH but cheap enough that a whole pact costs cents; the escrow asset is USDG, so the
          amount a vendor receives is still a dollar figure. ERC-20 mode adds one step for the client, an{" "}
          <code>approve</code> before the deposit, and nothing for the vendor. Because the public RPC is
          content-filtered by some ISPs, the frontend reaches Robinhood Chain through a same-origin relay that forwards
          an allow-list of JSON-RPC methods; the trust model is unchanged, since every state the app shows is read from
          the chain&rsquo;s own logs.
        </p>
        <p>
          Deployments are independent: pact ids, events and pending withdrawals never cross networks. The frontend
          keeps one selected network at a time and addresses every read and write to it explicitly.
        </p>
      </Section>

      <Section id="invoice-tracking" heading="Onchain Invoicing & Milestone Tracking">
        <p>
          Every pact is an immutable onchain invoice. Completion status, submission timestamps, deliverable proof
          links (GitHub PR, Figma, IPFS), and the client&rsquo;s approval are recorded as a permanent audit trail,
          each transition backed by a transaction on the pact&rsquo;s chain, ready for B2B bookkeeping and tax reporting.
        </p>
      </Section>

      <Section id="case-study" heading="Reference Case: Agency & Freelancer Settlement">
        <p>A digital agency based in Asia hires a software engineer in Europe to build a DeFi module:</p>
        <ol className="list-decimal pl-5 space-y-1 text-[13.5px]">
          <li>
            <strong>Agency deposits USDC:</strong> $10,000 USDC into <code>PyrisPact.sol</code> with a 14-day
            deadline.
          </li>
          <li>
            <strong>Work is guaranteed:</strong> the engineer verifies onchain that $10,000 USDC is locked and starts
            work with confidence.
          </li>
          <li>
            <strong>Work is delivered:</strong> the engineer submits the repository and pull request onchain via{" "}
            <code>submitWork()</code>.
          </li>
          <li>
            <strong>Funds are released:</strong> the agency reviews the code, confirms QA passed, and calls{" "}
            <code>releaseFunds()</code>.
          </li>
          <li>
            <strong>Clean settlement:</strong> the engineer receives exactly $10,000 USDC instantly, without the
            $2,000 commission an intermediary platform would have taken.
          </li>
        </ol>
      </Section>

      <Section id="security-refund" heading="Timeout Refunds & Non-Custodial Invariants">
        <p>The protocol enforces timeout protection mathematically:</p>
        <p className="font-mono text-[12.5px] bg-soft p-3 rounded-[6px] border border-line">
          require(block.timestamp &gt; pact.deadline &amp;&amp; pact.status == PactStatus.FUNDED);
        </p>
        <p>
          If the deadline passes and the contractor has not submitted a deliverable, the client may call{" "}
          <code>refund(pactId)</code> to reclaim 100% of the capital without the contractor&rsquo;s consent.{" "}
          <code>submitWork</code> is rejected after the deadline, so the contractor cannot pre-empt the
          client&rsquo;s refund with a late submission. The client may grant more time through{" "}
          <code>extendDeadline</code>.
        </p>
      </Section>

      <Section id="dispute-resolution" heading="Dispute Resolution">
        <p>
          The <code>DISPUTED</code> status freezes the escrow, but it is not a dead end. There are two exits:
        </p>
        <ul>
          <li>
            <strong>Mutual agreement:</strong> either party calls{" "}
            <code>proposeResolution(pactId, vendorShareBps)</code> with the contractor&rsquo;s share in basis points
            (0–10000). When the other party proposes the same figure, the contract splits the funds immediately and
            the status becomes <code>RESOLVED</code>. A different figure replaces the open proposal.
          </li>
          <li>
            <strong>Optional arbiter:</strong> when creating a pact, the client may name a third-party{" "}
            <code>arbiter</code> address. Only that address may call <code>arbitrate(pactId, vendorShareBps)</code>{" "}
            to rule on the dispute.
          </li>
        </ul>
        <p>
          Payouts use a push-with-pull-fallback pattern: if a recipient address rejects the transfer, the amount is
          recorded in <code>pendingWithdrawals</code> and can be claimed through <code>withdraw()</code>, so no
          party can block settlement.
        </p>
      </Section>

      <Section id="conclusion" heading="Conclusion & Protocol Status">
        <p>
          Pyris Pact modernises real-world B2B payment infrastructure with programmable escrow, instant conditional
          payments, and stablecoin-denominated invoice tracking on Arc and Robinhood Chain. The contract is deployed
          on Arc Mainnet (source verified on Sourcify) and on Robinhood Chain at <code>0xf7c81a882594b3f3ddd969ebfa750e30eedaead3</code> (ERC-20 mode against USDG, block 67358826).
        </p>
        <p>
          Open the production <Link href="/app">Pact Dashboard</Link> or read the{" "}
          <Link href="/docs">Pyris Pact documentation</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
