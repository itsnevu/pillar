import Link from "next/link";
import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Docs — Pyris Pact",
  description:
    "How Pyris Pact works: programmable B2B payments, smart contract escrow, milestone tracking, and native USDC gas fees on Arc Chain.",
};

const TOC = [
  { id: "overview", heading: "01 · Overview: Programmable B2B Payments" },
  { id: "case-study", heading: "Real-World Example: Agency & Freelancer" },
  { id: "smart-contract-escrow", heading: "Smart Contract Escrow Architecture" },
  { id: "conditional-release", heading: "Conditional Release upon Approval" },
  { id: "invoice-tracking", heading: "Invoice & Milestone Payment Tracking" },
  { id: "arc-chain-gas", heading: "Why Arc Chain & Native USDC Gas" },
  { id: "refund-protection", heading: "Timeout Refunds & Contractor Guarantees" },
  { id: "using-the-dashboard", heading: "Using the Dashboard" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Documentation"
      title="Pyris Pact: Programmable B2B Payments"
      lede="A platform for businesses that pay freelancers, vendors, or agencies automatically, on conditions both sides agreed to, settled on Arc Chain."
      meta={["Updated 17 September 2026", "~6 min read"]}
      toc={TOC}
    >
      <Section id="overview" heading="01 · Overview: Programmable B2B Payments">
        <p>
          <strong>Pyris Pact</strong> is programmable payment infrastructure built for business entities: agencies,
          software houses, B2B marketplaces, and international contractors.
        </p>
        <p>In a conventional cross-border engagement, money is held back by two opposing risks:</p>
        <ul>
          <li>
            <strong>Client / agency:</strong> reluctant to wire a large deposit to an unproven vendor or freelancer,
            because they might be ghosted.
          </li>
          <li>
            <strong>Freelancer / vendor:</strong> reluctant to hand over final code or assets before funds are
            guaranteed, because the invoice might never be paid.
          </li>
        </ul>
        <p>
          Pyris Pact removes both with <strong>smart contract escrow</strong> on Arc Chain: the funds sit safely on
          the blockchain and are only disbursed once the deliverable is approved.
        </p>
      </Section>

      <Section id="case-study" heading="Real-World Example: Agency & Freelancer">
        <div className="p-5 rounded-[12px] bg-soft border border-line my-4">
          <h3 className="text-[16px] font-bold text-ink mb-2">A typical engagement:</h3>
          <p className="text-[13.5px] text-muted leading-relaxed">
            An <strong>agency</strong> hires a <strong>freelancer</strong> to build a landing page and a smart
            contract for <strong>$5,000 USDC</strong>:
          </p>
          <ol className="list-decimal pl-5 mt-3 space-y-2 text-[13px] text-ink">
            <li>
              <strong>Lock the funds:</strong> the agency creates a Pact in the dashboard and deposits $5,000 USDC
              into the escrow contract on Arc Chain.
            </li>
            <li>
              <strong>Work begins:</strong> the freelancer can verify onchain that the full $5,000 USDC is locked
              in the contract and cannot be withdrawn unilaterally.
            </li>
            <li>
              <strong>Submit the deliverable:</strong> the freelancer finishes the work and records proof of
              delivery (a GitHub PR or Figma link) in the contract.
            </li>
            <li>
              <strong>Approve and release:</strong> the agency reviews the work, is satisfied, and clicks{" "}
              <strong>&ldquo;Release Funds&rdquo;</strong>.
            </li>
            <li>
              <strong>Instant settlement:</strong> $5,000 USDC lands in the freelancer&rsquo;s wallet in under a
              second with a <strong>0%</strong> platform fee, saving roughly $1,000 compared with Upwork or a
              conventional escrow service.
            </li>
          </ol>
        </div>
      </Section>

      <Section id="smart-contract-escrow" heading="Smart Contract Escrow Architecture">
        <p>
          Escrow is managed entirely by <code>PyrisPact.sol</code>. No third party and no platform operator can
          take or redirect funds while they are locked.
        </p>
        <pre className="p-4 bg-soft rounded-[8px] text-[12px] font-mono overflow-x-auto">
{`// Create and fund a new milestone escrow
function createPact(
    address vendor,
    address arbiter,      // optional; address(0) for mutual settlement only
    uint256 amount,
    uint256 deadline,
    string calldata title,
    string calldata description
) external payable returns (uint256 pactId);`}
        </pre>
        <p>
          When the client calls it, the USDC is pulled from the client&rsquo;s wallet and locked in the contract
          with status <code>FUNDED (0)</code>.
        </p>
      </Section>

      <Section id="conditional-release" heading="Conditional Release upon Approval">
        <p>The contract enforces the principle of <em>payment after approval</em>:</p>
        <ul>
          <li>
            <strong>Contractor submits proof:</strong> via <code>submitWork(pactId, note)</code>, moving the status
            to <code>SUBMITTED (1)</code>.
          </li>
          <li>
            <strong>Client approves:</strong> only the client&rsquo;s wallet (<code>pact.client</code>) may call{" "}
            <code>releaseFunds(pactId)</code>.
          </li>
          <li>
            <strong>Automatic disbursement:</strong> the contract atomically transfers 100% of the USDC to the
            contractor and sets the status to <code>RELEASED (2)</code>.
          </li>
        </ul>
      </Section>

      <Section id="invoice-tracking" heading="Invoice & Milestone Payment Tracking">
        <p>
          Pyris Pact doubles as a permanent onchain payment tracker. Every Pact has an identifier (
          <code>pactId</code>), a creation timestamp, a deadline, the deliverable note, and a verifiable status. Every
          state change is an event on Arc, so both parties can audit the full history through the block explorer.
        </p>
      </Section>

      <Section id="arc-chain-gas" heading="Why Arc Chain & Native USDC Gas">
        <p>
          Arc Chain (Circle&rsquo;s EVM Layer-1) is the natural home for B2B payments because it uses{" "}
          <strong>USDC as the native gas currency</strong>.
        </p>
        <p>
          On most blockchains a business must first buy a volatile token such as ETH just to pay for gas. On Arc
          Chain:
        </p>
        <ul>
          <li>The client holds USDC and pays a fraction of a cent in USDC for gas.</li>
          <li>The contractor receives clean USDC with no price exposure.</li>
          <li>Company bookkeeping stays simple: everything is denominated in US dollars.</li>
        </ul>
      </Section>

      <Section id="refund-protection" heading="Timeout Refunds & Contractor Guarantees">
        <p>What happens when one side stops responding?</p>
        <ul>
          <li>
            <strong>Client protection (timeout refund):</strong> if the deadline passes and the contractor has not
            submitted a deliverable, the client may call <code>refund(pactId)</code> to reclaim 100% of the USDC.
          </li>
          <li>
            <strong>Voluntary cancellation:</strong> the contractor may trigger a refund at any time to return the
            funds to the client, for example when the scope changes.
          </li>
          <li>
            <strong>Disputes:</strong> if the deliverable does not match the scope, either party can set the status
            to <code>DISPUTED (4)</code>. The escrow is frozen and can only be settled by a split both parties
            agree on (<code>proposeResolution</code>), or by the ruling of an <em>arbiter</em> if one was named when
            the Pact was created.
          </li>
          <li>
            <strong>Late submissions are rejected:</strong> the contractor cannot call <code>submitWork</code> after
            the deadline, so the client&rsquo;s refund right cannot be pre-empted. The client can grant more time
            with <code>extendDeadline</code>.
          </li>
          <li>
            <strong>Payouts cannot be blocked:</strong> if a recipient wallet rejects the transfer, the amount is
            credited to <code>pendingWithdrawals</code> and can be claimed at any time with <code>withdraw()</code>.
          </li>
        </ul>
      </Section>

      <Section id="using-the-dashboard" heading="Using the Dashboard">
        <p>
          Open the <Link href="/app">Pact Dashboard</Link> to create a new escrow, track incoming and outgoing
          milestones, and approve payouts directly from your wallet.
        </p>
      </Section>
    </ProsePage>
  );
}
