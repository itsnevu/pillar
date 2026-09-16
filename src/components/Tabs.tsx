import Link from "next/link";
import { LINKS } from "@/lib/links";

export function Tabs() {
  return (
    <>
      <nav className="borrow-navigation" aria-label="Escrow navigation">
        <Link href="/#pacts" aria-current="page">
          Milestone Escrows
        </Link>
        <Link href={LINKS.app}>Pact Dashboard</Link>
        <Link href="/#how">How it works</Link>
      </nav>
      <p className="borrow-pool-summary">
        <strong>Programmable B2B Escrow:</strong> Deposit USDC into smart contract milestones for your
        contractors, freelancers, and agency partners. Deliverables are recorded directly onchain and
        funds disburse immediately upon client approval. Powered by Arc Chain with native USDC gas fees.
      </p>
    </>
  );
}
