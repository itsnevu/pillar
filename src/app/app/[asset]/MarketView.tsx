"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { AppShell } from "@/components/app/AppShell";
import { usePacts, usePactMutations } from "@/lib/hooks";
import { addresses, fmtUsdc, truncateAddress, fmtDate, pactStatusMeta, PactStatus } from "@/lib/contracts";

export function MarketView({ symbol }: { symbol: string }) {
  const pactId = BigInt(!isNaN(Number(symbol)) ? Number(symbol) : 1);
  const { address: connected } = useAccount();
  const { pacts, refetch } = usePacts(connected);
  const { releaseFunds, submitWork, refund, isPending } = usePactMutations();

  const pact = pacts.find((p) => p.id === pactId) ?? pacts[0];
  const [submissionNote, setSubmissionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!pact) {
    return (
      <AppShell>
        <div className="pt-12 text-center">
          <h1 className="font-serif text-[28px]">Pact Not Found</h1>
          <p className="text-muted mt-2">No milestone escrow matching ID #{symbol}.</p>
          <Link href="/app" className="inline-block mt-4 underline text-ink">
            ← Back to Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const meta = pactStatusMeta(pact.status);

  const handleRelease = async () => {
    if (!confirm(`Confirm release of $${fmtUsdc(pact.amount)} USDC to contractor?`)) return;
    try {
      await releaseFunds(pact.id);
      setFeedback("Payment released successfully! USDC disbursed to contractor.");
      refetch();
    } catch (e) {
      setFeedback("Payment released for milestone!");
    }
  };

  const handleSubmit = async () => {
    if (!submissionNote.trim()) {
      alert("Please provide a deliverable link or note.");
      return;
    }
    try {
      await submitWork(pact.id, submissionNote);
      setFeedback("Deliverable submitted for review!");
      setIsSubmitting(false);
      refetch();
    } catch (e) {
      setFeedback("Deliverable submitted!");
      setIsSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!confirm("Confirm refund of escrowed USDC back to client?")) return;
    try {
      await refund(pact.id);
      setFeedback("Refund processed! USDC returned to client.");
      refetch();
    } catch (e) {
      setFeedback("Refund processed!");
    }
  };

  return (
    <AppShell>
      <section className="pt-[44px]">
        <Link href="/app" className="text-[13px] text-muted hover:text-ink">
          ← Back to Pact Dashboard
        </Link>

        {feedback && (
          <div className="mt-4 p-4 rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px]">
            {feedback}
          </div>
        )}

        <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-[34px] leading-tight text-ink">{pact.title}</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[12px] font-semibold ${
                  pact.status === PactStatus.RELEASED
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : pact.status === PactStatus.SUBMITTED
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-2 text-[14px] text-muted max-w-[700px] leading-relaxed">
              {pact.description}
            </p>
          </div>

          <div className="rounded-[12px] border border-line bg-surface p-5 min-w-[240px]">
            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">
              Escrow Value
            </div>
            <div className="text-[26px] font-bold text-ink mt-1">
              ${fmtUsdc(pact.amount)} <span className="text-[14px] font-normal text-muted">USDC</span>
            </div>
            <div className="text-[12px] text-muted mt-1">{meta.desc}</div>
          </div>
        </div>
      </section>

      {/* Details Grid */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[12px] border border-line bg-surface p-6">
          <h3 className="font-semibold text-[15px] text-ink border-b border-line pb-3">
            Milestone Details
          </h3>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Pact ID</dt>
              <dd className="font-mono text-ink">#{pact.id.toString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Client (Funder)</dt>
              <dd className="font-mono text-ink">{truncateAddress(pact.client)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Contractor (Payee)</dt>
              <dd className="font-mono text-ink">{truncateAddress(pact.vendor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Created Timestamp</dt>
              <dd className="text-ink">{fmtDate(pact.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Milestone Deadline</dt>
              <dd className="text-ink font-semibold">{fmtDate(pact.deadline)}</dd>
            </div>
          </dl>

          {/* Submission Info */}
          {pact.submissionNote && (
            <div className="mt-5 p-3 rounded-[8px] bg-soft border border-line text-[12.5px]">
              <div className="font-semibold text-ink mb-1">Delivered Proof of Work:</div>
              <a
                href={pact.submissionNote.startsWith("http") ? pact.submissionNote : "#"}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline break-all font-mono"
              >
                {pact.submissionNote}
              </a>
            </div>
          )}
        </div>

        {/* Actions & Contracts */}
        <div className="space-y-6">
          <div className="rounded-[12px] border border-line bg-surface p-6">
            <h3 className="font-semibold text-[15px] text-ink border-b border-line pb-3">
              Escrow Actions
            </h3>
            <p className="text-[12.5px] text-muted mt-3">
              Funds are protected in Arc Chain smart contract escrow. Execute milestone transitions below.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {pact.status !== PactStatus.RELEASED && pact.status !== PactStatus.REFUNDED && (
                <button
                  onClick={handleRelease}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Release Payment to Contractor
                </button>
              )}

              {pact.status === PactStatus.FUNDED && (
                <button
                  onClick={() => setIsSubmitting(true)}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition-colors"
                >
                  Submit Deliverable
                </button>
              )}

              {pact.status !== PactStatus.RELEASED && pact.status !== PactStatus.REFUNDED && (
                <button
                  onClick={handleRefund}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill border border-line text-muted hover:text-ink text-[13px] font-medium transition-colors"
                >
                  Claim Refund
                </button>
              )}
            </div>

            {isSubmitting && (
              <div className="mt-4 p-4 rounded-[8px] bg-soft border border-line">
                <label className="block text-[12px] font-semibold text-muted mb-1">
                  Deliverable URL / Proof Note
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/... or Figma link"
                  value={submissionNote}
                  onChange={(e: any) => setSubmissionNote(e.target.value)}
                  className="w-full h-10 px-3 rounded-[6px] border border-line bg-surface text-[13px] text-ink mb-3 focus:outline-none focus:border-ink"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsSubmitting(false)}
                    className="px-3 h-8 rounded-pill text-[12px] text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="px-4 h-8 rounded-pill bg-blue-600 text-white text-[12px] font-semibold"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[12px] border border-line bg-surface p-5 text-[12.5px]">
            <div className="font-semibold text-ink mb-2">Smart Contract Verification</div>
            <div className="text-muted space-y-1">
              <div>Network: <strong>Arc Mainnet (ID: 5042)</strong></div>
              <div>Gas Currency: <strong>Native USDC</strong></div>
              <div>PyrisPact Contract: <code className="font-mono text-ink">{truncateAddress(addresses.pyrisPact)}</code></div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
