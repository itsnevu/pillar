"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { AppShell, Stat } from "@/components/app/AppShell";
import { usePacts, usePactMutations, useMounted } from "@/lib/hooks";
import {
  fmtUsdc,
  truncateAddress,
  fmtDate,
  pactStatusMeta,
  PactStatus,
  isActive,
  type Pact,
  USDC_DECIMALS,
} from "@/lib/contracts";

/** Wallet rejections and reverts both land here; the UI never claims success on failure. */
function errorText(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied/i.test(msg)) return "Transaction cancelled in wallet.";
  const m = msg.match(/reverted with the following reason:\s*([^\n]+)|Error: (\w+)\(/);
  return m ? `${fallback}: ${m[1] ?? m[2]}` : fallback;
}

export default function DashboardPage() {
  return (
    <AppShell>
      <PactDashboard />
    </AppShell>
  );
}

function PactDashboard() {
  const { address: connected } = useAccount();
  const mounted = useMounted();
  const [activeTab, setActiveTab] = useState<"all" | "outgoing" | "incoming">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submittingPactId, setSubmittingPactId] = useState<bigint | null>(null);
  const [submissionNote, setSubmissionNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const ok = (msg: string) => {
    setIsError(false);
    setFeedback(msg);
  };
  const fail = (e: unknown, msg: string) => {
    console.error(e);
    setIsError(true);
    setFeedback(errorText(e, msg));
  };

  // Form states for creating a new pact
  const [vendorAddress, setVendorAddress] = useState("");
  const [arbiterAddress, setArbiterAddress] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountUsdc, setAmountUsdc] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(7);

  const { pacts, outgoingPacts, incomingPacts, stats, refetch } = usePacts(connected);
  const { createPact, submitWork, releaseFunds, refund, isPending } = usePactMutations();

  const displayedPacts =
    activeTab === "outgoing" ? outgoingPacts : activeTab === "incoming" ? incomingPacts : pacts;

  const handleCreatePact = async (e: any) => {
    e.preventDefault();
    if (!isAddress(vendorAddress)) {
      alert("Please enter a valid Ethereum / Arc Chain address for the contractor.");
      return;
    }
    const parsedAmount = parseFloat(amountUsdc);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid USDC amount.");
      return;
    }
    const arbiter = arbiterAddress.trim();
    if (arbiter && !isAddress(arbiter)) {
      alert("Arbiter must be a valid address, or left empty.");
      return;
    }
    if (arbiter && (arbiter.toLowerCase() === vendorAddress.toLowerCase() || arbiter.toLowerCase() === connected?.toLowerCase())) {
      alert("The arbiter must be a third party, not the client or the contractor.");
      return;
    }

    try {
      const amountBigInt = parseUnits(amountUsdc, USDC_DECIMALS);
      const deadlineSeconds = deadlineDays * 86400;
      await createPact(
        vendorAddress as Address,
        amountBigInt,
        deadlineSeconds,
        title,
        description,
        (arbiter || zeroAddress) as Address
      );
      ok(`Pact "${title}" created and ${amountUsdc} USDC locked into escrow.`);
      setIsCreateOpen(false);
      setVendorAddress("");
      setArbiterAddress("");
      setTitle("");
      setDescription("");
      setAmountUsdc("");
      refetch();
    } catch (err) {
      fail(err, "Pact not created");
    }
  };

  const handleRelease = async (pactId: bigint, title: string) => {
    if (!confirm(`Are you sure you want to approve and release payment for "${title}"?`)) return;
    try {
      await releaseFunds(pactId);
      ok("Payment released. Funds sent to contractor.");
      refetch();
    } catch (err) {
      fail(err, "Release failed");
    }
  };

  const handleSubmitDeliverable = async (pactId: bigint) => {
    if (!submissionNote.trim()) {
      alert("Please provide a deliverable link or note (e.g. GitHub PR, Figma link).");
      return;
    }
    try {
      await submitWork(pactId, submissionNote);
      ok("Work submitted for review.");
      setSubmittingPactId(null);
      setSubmissionNote("");
      refetch();
    } catch (err) {
      fail(err, "Submission failed");
    }
  };

  const handleRefund = async (pactId: bigint) => {
    if (!confirm("Are you sure you want to claim a refund for this pact?")) return;
    try {
      await refund(pactId);
      ok("Refund processed. Funds returned to client.");
      refetch();
    } catch (err) {
      fail(err, "Refund failed");
    }
  };

  return (
    <>
      {/* Top Header */}
      <section className="pt-[44px]">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Pact Dashboard</h1>
            <p className="mt-3 max-w-[640px] text-[14px] leading-[1.65] text-muted">
              Programmable milestone escrows on Arc Chain. Lock USDC before work begins, verify deliverables onchain,
              and disburse instant payouts with zero banking fees.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <span className="text-[12.5px] text-muted">
                Connected: <span className="font-mono text-ink">{truncateAddress(connected)}</span>
              </span>
            )}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center rounded-pill bg-ink text-surface text-[13px] font-semibold px-5 h-10 hover:bg-black transition-all shadow-sm"
            >
              + Create New Pact
            </button>
          </div>
        </div>
      </section>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`mt-6 p-4 rounded-[8px] border text-[13.5px] flex justify-between items-center ${
            isError ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Total Escrow Volume"
          value={`$${fmtUsdc(stats.totalEscrowVolume)}`}
          sub="Cumulative USDC processed"
        />
        <Stat
          label="Active in Escrow"
          value={`$${fmtUsdc(stats.activeEscrowAmount)}`}
          sub={`${stats.activeCount} milestone${stats.activeCount === 1 ? "" : "s"} in progress`}
          accent
        />
        <Stat
          label="Settled Payouts"
          value={`$${fmtUsdc(stats.completedPayouts)}`}
          sub={`${stats.completedCount} milestone${stats.completedCount === 1 ? "" : "s"} completed`}
        />
        <Stat
          label="Network Gas Currency"
          value="USDC"
          sub="Native gas on Arc Chain (no ETH needed)"
        />
      </section>

      {/* Filter Tabs */}
      <section className="mt-12">
        <div className="flex items-center justify-between border-b border-line pb-2 flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-pill text-[13px] font-medium transition-colors ${
                activeTab === "all" ? "bg-ink text-surface" : "text-muted hover:text-ink bg-surface"
              }`}
            >
              All Pacts ({pacts.length})
            </button>
            <button
              onClick={() => setActiveTab("outgoing")}
              className={`px-4 py-2 rounded-pill text-[13px] font-medium transition-colors ${
                activeTab === "outgoing" ? "bg-ink text-surface" : "text-muted hover:text-ink bg-surface"
              }`}
            >
              Outgoing (As Client)
            </button>
            <button
              onClick={() => setActiveTab("incoming")}
              className={`px-4 py-2 rounded-pill text-[13px] font-medium transition-colors ${
                activeTab === "incoming" ? "bg-ink text-surface" : "text-muted hover:text-ink bg-surface"
              }`}
            >
              Incoming (As Contractor)
            </button>
          </div>

          <span className="text-[12px] text-muted">Showing {displayedPacts.length} pacts</span>
        </div>

        {/* Pacts Table */}
        <div className="mt-4">
          {displayedPacts.length === 0 ? (
            <div className="py-16 text-center text-muted text-[14px]">
              No pacts found in this view.{" "}
              <button onClick={() => setIsCreateOpen(true)} className="text-ink font-semibold underline">
                Create your first escrow pact
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {displayedPacts.map((p) => {
                const meta = pactStatusMeta(p.status);
                const isClient = connected && p.client.toLowerCase() === connected.toLowerCase();
                const isVendor = connected && p.vendor.toLowerCase() === connected.toLowerCase();

                return (
                  <div key={p.id.toString()} className="py-6 flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-[17px] text-ink">{p.title}</h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-[11.5px] font-semibold ${
                            p.status === PactStatus.RELEASED || p.status === PactStatus.RESOLVED
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === PactStatus.SUBMITTED
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : p.status === PactStatus.REFUNDED
                                  ? "bg-stone-100 text-stone-600 border border-stone-200"
                                  : p.status === PactStatus.DISPUTED
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed">{p.description}</p>

                      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted">
                        <span>
                          Client: <strong className="text-ink font-mono">{truncateAddress(p.client)}</strong>
                        </span>
                        <span>
                          Contractor: <strong className="text-ink font-mono">{truncateAddress(p.vendor)}</strong>
                        </span>
                        <span>
                          Deadline: <strong className="text-ink">{fmtDate(p.deadline)}</strong>
                        </span>
                        <span>
                          Created: <strong className="text-ink">{fmtDate(p.createdAt)}</strong>
                        </span>
                      </div>

                      {p.submissionNote && (
                        <div className="mt-3 p-3 rounded-[6px] bg-soft border border-line text-[12.5px]">
                          <span className="font-semibold text-ink">Deliverable Submission: </span>
                          <a
                            href={p.submissionNote.startsWith("http") ? p.submissionNote : "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline break-all"
                          >
                            {p.submissionNote}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-start md:items-end justify-between gap-3 min-w-[200px]">
                      <div>
                        <div className="text-[20px] font-bold text-ink">
                          ${fmtUsdc(p.amount)} <small className="text-[13px] font-normal text-muted">USDC</small>
                        </div>
                        <div className="text-[11.5px] text-muted">{meta.desc}</div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {/* Client Release Button */}
                        {isActive(p.status) && connected?.toLowerCase() === p.client.toLowerCase() && (
                          <button
                            onClick={() => handleRelease(p.id, p.title)}
                            disabled={isPending}
                            className="px-3.5 py-1.5 rounded-pill bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700 transition-colors"
                          >
                            Release Funds
                          </button>
                        )}

                        {/* Contractor Submit Button */}
                        {p.status === PactStatus.FUNDED && connected?.toLowerCase() === p.vendor.toLowerCase() && (
                          <button
                            onClick={() => setSubmittingPactId(p.id)}
                            disabled={isPending}
                            className="px-3.5 py-1.5 rounded-pill bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Submit Deliverable
                          </button>
                        )}

                        {/* Refund Button */}
                        {isActive(p.status) &&
                          (connected?.toLowerCase() === p.client.toLowerCase() ||
                            connected?.toLowerCase() === p.vendor.toLowerCase()) && (
                          <button
                            onClick={() => handleRefund(p.id)}
                            disabled={isPending}
                            className="px-3.5 py-1.5 rounded-pill border border-line text-muted hover:text-ink text-[12px] font-medium transition-colors"
                          >
                            Refund
                          </button>
                        )}

                        {p.status === PactStatus.DISPUTED && (
                          <a
                            href={`/app/${p.id.toString()}`}
                            className="px-3.5 py-1.5 rounded-pill border border-red-200 text-red-700 text-[12px] font-medium hover:bg-red-50 transition-colors"
                          >
                            Settle Dispute
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Modal: Create New Pact */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-[540px] rounded-[16px] bg-surface p-6 sm:p-8 shadow-2xl border border-line">
            <div className="flex justify-between items-center pb-4 border-b border-line">
              <h2 className="font-serif text-[22px] text-ink">Create Escrow Pact</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted hover:text-ink text-[18px] font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePact} className="mt-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Contractor Wallet Address (Arc Chain)
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={vendorAddress}
                  onChange={(e: any) => setVendorAddress(e.target.value)}
                  className="w-full h-11 px-3 rounded-[8px] border border-line bg-bg font-mono text-[13px] text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Arbiter Address <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="0x… a third party who can rule on a dispute"
                  value={arbiterAddress}
                  onChange={(e: any) => setArbiterAddress(e.target.value)}
                  className="w-full h-11 px-3 rounded-[8px] border border-line bg-bg font-mono text-[13px] text-ink focus:outline-none focus:border-ink"
                />
                <p className="text-[12px] text-muted mt-1">
                  Without an arbiter, a dispute can only be settled by a split both parties agree on.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Milestone Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js App Implementation"
                  value={title}
                  onChange={(e: any) => setTitle(e.target.value)}
                  className="w-full h-11 px-3 rounded-[8px] border border-line bg-bg text-[13.5px] text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Scope of Work / Specification
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Briefly describe the requirements, acceptance criteria, or link to Notion/PRD"
                  value={description}
                  onChange={(e: any) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-[8px] border border-line bg-bg text-[13px] text-ink focus:outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Escrow Amount (USDC)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="1000"
                    value={amountUsdc}
                    onChange={(e: any) => setAmountUsdc(e.target.value)}
                    className="w-full h-11 px-3 rounded-[8px] border border-line bg-bg font-mono text-[14px] text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Deadline (Days)
                  </label>
                  <select
                    value={deadlineDays}
                    onChange={(e: any) => setDeadlineDays(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-[8px] border border-line bg-bg text-[13.5px] text-ink focus:outline-none focus:border-ink"
                  >
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (1 Week)</option>
                    <option value={14}>14 Days (2 Weeks)</option>
                    <option value={30}>30 Days (1 Month)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-5 h-11 rounded-pill border border-line text-[13px] font-medium text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 h-11 rounded-pill bg-ink text-surface text-[13.5px] font-semibold hover:bg-black transition-colors"
                >
                  {isPending ? "Locking USDC…" : "Lock USDC & Create Escrow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submit Deliverable */}
      {submittingPactId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-[480px] rounded-[16px] bg-surface p-6 shadow-2xl border border-line">
            <h2 className="font-serif text-[20px] text-ink">Submit Deliverable</h2>
            <p className="text-[12.5px] text-muted mt-1">
              Provide the GitHub PR link, Figma URL, or completion note for Pact #{submittingPactId.toString()}.
            </p>

            <div className="mt-4">
              <input
                type="text"
                placeholder="https://github.com/organization/repo/pull/1"
                value={submissionNote}
                onChange={(e: any) => setSubmissionNote(e.target.value)}
                className="w-full h-11 px-3 rounded-[8px] border border-line bg-bg text-[13px] text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSubmittingPactId(null)}
                className="px-4 h-9 rounded-pill border border-line text-[12.5px] text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitDeliverable(submittingPactId)}
                disabled={isPending}
                className="px-4 h-9 rounded-pill bg-blue-600 text-white text-[12.5px] font-semibold hover:bg-blue-700 transition-colors"
              >
                {isPending ? "Submitting…" : "Confirm Submission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
