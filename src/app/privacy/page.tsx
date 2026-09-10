import { ProsePage } from "@/components/ProsePage";

export const metadata = {
  title: "Privacy — Pillar Finance",
  description: "Pillar has no account and no signup. What the site sees, what the chain records, and what we never collect.",
};

export default function Page() {
  return (
    <ProsePage eyebrow="Legal" title="Privacy" lede="No account, no signup, no identity documents. What the site sees and what it never collects." meta={["Updated 10 September 2026"]}>
          <p>There is no account and no signup. Pillar does not ask for your name, email, or identity documents.</p>
          <p>The site sees your public wallet address once you connect, plus ordinary web request data such as IP address and browser type, used only to serve the site and spot abuse.</p>
          <p>Deposits, borrows, repayments, harvests, and liquidations are recorded on a public blockchain. They are readable by anyone and cannot be deleted.</p>
          <p>Your browser talks directly to an RPC provider and to your wallet extension, each of which has its own policy.</p>
          <p>We do not sell data and we do not run advertising or cross site tracking.</p>
          <p>Questions: support@pillar.finance</p>
    </ProsePage>
  );
}
