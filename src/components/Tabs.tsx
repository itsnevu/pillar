import Link from "next/link";

import { LINKS } from "@/lib/links";

export function Tabs() {
  return (
    <>
      <nav className="borrow-navigation" aria-label="Loan types">
        <Link href="/#markets" aria-current="page">
          Self-repaying loans
        </Link>
        <Link href={LINKS.app}>Portfolio</Link>
        <Link href="/#how">How it works</Link>
      </nav>
      <p className="borrow-pool-summary">
        <strong>Self-repaying loans:</strong> deposit stock tokens, borrow USDG at a conservative LTV, and
        your collateral is routed to yield that pays the debt down automatically. If yield falls to zero the
        debt stops shrinking — it never grows on its own. There is no repayment schedule, no maturity
        date, and Pillar charges no interest: the protocol earns only a share of the yield your
        collateral produces.
      </p>
    </>
  );
}
