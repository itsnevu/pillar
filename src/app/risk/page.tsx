import Link from "next/link";
import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Risk — Pyris Pact",
  description:
    "The honest limits of programmable milestone escrow: irreversible releases, deadline timeout rules, and smart contract execution parameters on Arc Chain.",
};

const TOC = [
  { id: "irreversible-release", heading: "Releases are permanent and irreversible" },
  { id: "deadline-rules", heading: "Deadlines, timeouts, and refunds" },
  { id: "disputes", heading: "Offchain quality and subjective disputes" },
  { id: "contract-risk", heading: "Smart contract execution on Arc Chain" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Risk disclosure"
      title="What can go wrong"
      lede="Every constraint and failure mode of milestone escrow, stated with complete clarity."
      meta={["Updated 16 September 2026"]}
      toc={TOC}
    >
      <Section id="irreversible-release" heading="Releases are permanent and irreversible">
        <p>
          Once a client triggers <code>releaseFunds(pactId)</code>, the transaction immediately transfers
          the locked USDC into the contractor&apos;s wallet. Blockchain transactions on Arc Chain are final
          and cannot be clawed back, cancelled, or reversed by the Pyris team or any centralized authority.
        </p>
        <p>
          Clients must thoroughly inspect submitted deliverables (code, design files, or reports) before
          authorizing release.
        </p>
      </Section>

      <Section id="deadline-rules" heading="Deadlines, timeouts, and refunds">
        <p>
          Every pact is initialized with a UNIX deadline. If that timestamp passes and the contractor has
          not called <code>submitWork()</code>, the smart contract allows the client to reclaim 100% of
          their escrowed funds via <code>refund()</code>.
        </p>
        <p>
          Contractors must ensure their deliverables are formally submitted onchain prior to the deadline
          timestamp to prevent automatic refund eligibility.
        </p>
      </Section>

      <Section id="disputes" heading="Offchain quality and subjective disputes">
        <p>
          Smart contracts verify signatures and deadlines; they cannot autonomously judge the qualitative
          elegance of code, design, or written copy.
        </p>
        <p>
          If deliverables diverge from the original agreed specifications, either party may flag the pact
          as <strong>Disputed</strong>. Pyris Pact provides onchain record-keeping, but parties should
          maintain clear written specifications and agreed revision rounds.
        </p>
      </Section>

      <Section id="contract-risk" heading="Smart contract execution on Arc Chain">
        <p>
          Pyris Pact executes on <code>PyrisPact.sol</code>. While the contract has been stripped of complex
          oracle and DEX dependencies for maximal security, software bugs or network-level delays can occur.
        </p>
        <p>
          The protocol is in open beta. Start with small amounts. See also the{" "}
          <Link href="/terms">terms of use</Link> and <Link href="/docs">documentation</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
