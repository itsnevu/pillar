"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { zeroAddress } from "viem";
import { AppShell } from "@/components/app/AppShell";
import { AddressLink, ProofLink } from "@/components/app/Explorer";
import { PactTimeline } from "@/components/app/PactTimeline";
import { usePacts, usePactMutations, useProposal, usePendingWithdrawal } from "@/lib/hooks";
import {
  addresses,
  fmtUsdc,
  truncateAddress,
  fmtDate,
  pactStatusMeta,
  PactStatus,
  isActive,
  isTerminal,
} from "@/lib/contracts";

/** Wallet rejections and reverts both land here; the UI never claims success on failure. */
function errorText(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied/i.test(msg)) return "Transaction cancelled in wallet.";
  const m = msg.match(/reverted with the following reason:\s*([^\n]+)|Error: (\w+)\(/);
  return m ? `${fallback}: ${m[1] ?? m[2]}` : fallback;
}

const inputClass =
  "h-10 px-3 rounded-[6px] border border-line bg-surface text-[13px] text-ink focus:outline-none focus:border-ink";

export function MarketView({ symbol }: { symbol: string }) {
  const pactId = BigInt(!isNaN(Number(symbol)) ? Number(symbol) : 0);
  const { address: connected } = useAccount();
  const { pacts, refetch } = usePacts(connected);
  const { releaseFunds, submitWork, refund, dispute, proposeResolution, arbitrate, withdraw, isPending } =
    usePactMutations();

  const pact = pacts.find((p) => p.id === pactId);
  const proposal = useProposal(pact?.id);
  const pending = usePendingWithdrawal(connected);

  const [submissionNote, setSubmissionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [isDisputing, setIsDisputing] = useState(false);
  const [vendorShare, setVendorShare] = useState("50");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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
  const me = connected?.toLowerCase();
  const isClient = me === pact.client.toLowerCase();
  const isVendor = me === pact.vendor.toLowerCase();
  const hasArbiter = pact.arbiter !== zeroAddress;
  const isArbiter = hasArbiter && me === pact.arbiter.toLowerCase();
  const isParty = isClient || isVendor;
  const deadlinePassed = Number(pact.deadline) * 1000 < Date.now();
  // The contract only lets the client reclaim after the deadline with nothing submitted.
  const clientCanRefund = pact.status === PactStatus.FUNDED && deadlinePassed;

  const ok = (msg: string) => {
    setIsError(false);
    setFeedback(msg);
  };
  const fail = (e: unknown, msg: string) => {
    setIsError(true);
    setFeedback(errorText(e, msg));
  };

  const shareBps = (): number | null => {
    const pct = Number(vendorShare);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    return Math.round(pct * 100);
  };
  const bpsNow = shareBps() ?? 0;
  const vendorCut = (pact.amount * BigInt(bpsNow)) / 10000n;
  const proposalFromOther = !!proposal.proposer && proposal.proposer.toLowerCase() !== me;
  const wouldAccept = proposalFromOther && proposal.vendorShareBps === shareBps();

  const handleRelease = async () => {
    if (!confirm(`Confirm release of $${fmtUsdc(pact.amount)} USDC to contractor?`)) return;
    try {
      await releaseFunds(pact.id);
      ok("Payment released. USDC disbursed to contractor.");
      refetch();
    } catch (e) {
      fail(e, "Release failed");
    }
  };

  const handleSubmit = async () => {
    if (!submissionNote.trim()) {
      alert("Please provide a deliverable link or note.");
      return;
    }
    try {
      await submitWork(pact.id, submissionNote);
      ok("Deliverable submitted for review.");
      setIsSubmitting(false);
      refetch();
    } catch (e) {
      fail(e, "Submission failed");
    }
  };

  const handleRefund = async () => {
    if (!confirm("Confirm refund of escrowed USDC back to client?")) return;
    try {
      await refund(pact.id);
      ok("Refund processed. USDC returned to client.");
      refetch();
    } catch (e) {
      fail(e, "Refund failed");
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      alert("Please state the reason for the dispute.");
      return;
    }
    try {
      await dispute(pact.id, disputeReason);
      ok("Pact disputed. Funds are frozen until a settlement is agreed.");
      setIsDisputing(false);
      refetch();
    } catch (e) {
      fail(e, "Dispute failed");
    }
  };

  const handlePropose = async () => {
    const bps = shareBps();
    if (bps === null) {
      alert("Contractor share must be between 0 and 100 percent.");
      return;
    }
    try {
      await proposeResolution(pact.id, bps);
      ok(
        wouldAccept
          ? "Split accepted. Funds disbursed to both parties."
          : "Split proposed. It settles as soon as the other party proposes the same share."
      );
      refetch();
      proposal.refetch();
    } catch (e) {
      fail(e, "Proposal failed");
    }
  };

  const handleArbitrate = async () => {
    const bps = shareBps();
    if (bps === null) {
      alert("Contractor share must be between 0 and 100 percent.");
      return;
    }
    if (!confirm(`Rule ${bps / 100}% to contractor and ${100 - bps / 100}% to client?`)) return;
    try {
      await arbitrate(pact.id, bps);
      ok("Ruling recorded. Funds disbursed.");
      refetch();
    } catch (e) {
      fail(e, "Ruling failed");
    }
  };

  const handleWithdraw = async () => {
    try {
      await withdraw();
      ok("Pending payout withdrawn.");
      pending.refetch();
    } catch (e) {
      fail(e, "Withdraw failed");
    }
  };

  return (
    <AppShell>
      <section className="pt-[44px]">
        <Link href="/app" className="text-[13px] text-muted hover:text-ink">
          ← Back to Pact Dashboard
        </Link>

        {feedback && (
          <div
            role="status"
            className={`mt-4 p-4 rounded-[8px] border text-[13px] ${
              isError ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {feedback}
          </div>
        )}

        {pending.amount > 0n && (
          <div className="mt-4 p-4 rounded-[8px] bg-amber-50 border border-amber-200 text-amber-900 text-[13px] flex items-center justify-between gap-4 flex-wrap">
            <span>
              A payout of <strong>${fmtUsdc(pending.amount)} USDC</strong> could not be pushed to your wallet and is
              waiting to be claimed.
            </span>
            <button
              onClick={handleWithdraw}
              disabled={isPending}
              className="px-4 h-8 rounded-pill bg-amber-600 text-white text-[12px] font-semibold"
            >
              Withdraw
            </button>
          </div>
        )}

        <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-[34px] leading-tight text-ink">{pact.title}</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[12px] font-semibold ${
                  pact.status === PactStatus.RELEASED || pact.status === PactStatus.RESOLVED
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : pact.status === PactStatus.SUBMITTED
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : pact.status === PactStatus.DISPUTED
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-2 text-[14px] text-muted max-w-[700px] leading-relaxed">{pact.description}</p>
          </div>

          <div className="rounded-[12px] border border-line bg-surface p-5 min-w-[240px]">
            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Escrow Value</div>
            <div className="text-[26px] font-bold text-ink mt-1">
              ${fmtUsdc(pact.amount)} <span className="text-[14px] font-normal text-muted">USDC</span>
            </div>
            <div className="text-[12px] text-muted mt-1">{meta.desc}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[12px] border border-line bg-surface p-6">
          <h3 className="font-semibold text-[15px] text-ink border-b border-line pb-3">Milestone Details</h3>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Pact ID</dt>
              <dd className="font-mono text-ink">#{pact.id.toString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Client (Funder)</dt>
              <dd>
                <AddressLink address={pact.client} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Contractor (Payee)</dt>
              <dd>
                <AddressLink address={pact.vendor} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Arbiter</dt>
              <dd>
                {hasArbiter ? <AddressLink address={pact.arbiter} /> : <span className="text-muted">None · mutual settlement</span>}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Created</dt>
              <dd className="text-ink">{fmtDate(pact.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Milestone Deadline</dt>
              <dd className="text-ink font-semibold">{fmtDate(pact.deadline)}</dd>
            </div>
            {pact.disputedAt > 0n && (
              <div className="flex justify-between">
                <dt className="text-muted">Disputed</dt>
                <dd className="text-ink">{fmtDate(pact.disputedAt)}</dd>
              </div>
            )}
            {pact.status === PactStatus.RESOLVED && (
              <div className="flex justify-between">
                <dt className="text-muted">Settled Split</dt>
                <dd className="text-ink font-semibold">
                  {pact.vendorShareBps / 100}% contractor · {100 - pact.vendorShareBps / 100}% client
                </dd>
              </div>
            )}
          </dl>

          {pact.submissionNote && (
            <div className="mt-5 p-3 rounded-[8px] bg-soft border border-line text-[12.5px]">
              <div className="font-semibold text-ink mb-1">Delivered Proof of Work:</div>
              <ProofLink note={pact.submissionNote} className="font-mono" />
            </div>
          )}

        </div>

        <div className="space-y-6">
          <div className="rounded-[12px] border border-line bg-surface p-6">
            <h3 className="font-semibold text-[15px] text-ink border-b border-line pb-3">Escrow Actions</h3>
            <p className="text-[12.5px] text-muted mt-3">
              Funds are held by the PyrisPact contract on Arc. Only the parties named above can move them.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {isActive(pact.status) && isClient && (
                <button
                  onClick={handleRelease}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Release Payment to Contractor
                </button>
              )}

              {pact.status === PactStatus.FUNDED && isVendor && (
                <button
                  onClick={() => setIsSubmitting(true)}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition-colors"
                >
                  Submit Deliverable
                </button>
              )}

              {isActive(pact.status) && (isVendor || (isClient && clientCanRefund)) && (
                <button
                  onClick={handleRefund}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill border border-line text-muted hover:text-ink text-[13px] font-medium transition-colors"
                >
                  {isVendor ? "Cancel & Refund Client" : "Claim Refund"}
                </button>
              )}

              {isActive(pact.status) && isParty && (
                <button
                  onClick={() => setIsDisputing(true)}
                  disabled={isPending}
                  className="px-5 h-10 rounded-pill border border-red-200 text-red-700 hover:bg-red-50 text-[13px] font-medium transition-colors"
                >
                  Raise Dispute
                </button>
              )}

              {isClient && isActive(pact.status) && !clientCanRefund && (
                <p className="text-[12.5px] text-muted basis-full">
                  {pact.status === PactStatus.SUBMITTED
                    ? "Work has been submitted: release it, or raise a dispute if it does not match the scope."
                    : `You can reclaim the escrow after the deadline (${fmtDate(pact.deadline)}) if nothing is submitted. Until then only the contractor can cancel.`}
                </p>
              )}
              {!connected && !isTerminal(pact.status) && (
                <p className="text-[12.5px] text-muted">Connect the client or contractor wallet to act on this pact.</p>
              )}
              {connected && !isParty && !isArbiter && !isTerminal(pact.status) && (
                <p className="text-[12.5px] text-muted">This wallet is not a party to this pact.</p>
              )}
              {isTerminal(pact.status) && (
                <p className="text-[12.5px] text-muted">This pact is closed. No further actions are possible.</p>
              )}
            </div>

            {isSubmitting && (
              <div className="mt-4 p-4 rounded-[8px] bg-soft border border-line">
                <label className="block text-[12px] font-semibold text-muted mb-1">Deliverable URL / Proof Note</label>
                <input
                  type="text"
                  placeholder="https://github.com/... or Figma link"
                  value={submissionNote}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubmissionNote(e.target.value)}
                  className={`w-full mb-3 ${inputClass}`}
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

            {isDisputing && (
              <div className="mt-4 p-4 rounded-[8px] bg-soft border border-line">
                <label className="block text-[12px] font-semibold text-muted mb-1">Reason for dispute</label>
                <input
                  type="text"
                  placeholder="Deliverable does not match the agreed scope because…"
                  value={disputeReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisputeReason(e.target.value)}
                  className={`w-full mb-3 ${inputClass}`}
                />
                <p className="text-[12px] text-muted mb-3">
                  Disputing freezes the escrow. It can only be settled by a split both parties agree on
                  {hasArbiter ? ", or by the arbiter's ruling" : ""}.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsDisputing(false)}
                    className="px-3 h-8 rounded-pill text-[12px] text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDispute}
                    disabled={isPending}
                    className="px-4 h-8 rounded-pill bg-red-600 text-white text-[12px] font-semibold"
                  >
                    Confirm Dispute
                  </button>
                </div>
              </div>
            )}

            {pact.status === PactStatus.DISPUTED && (isParty || isArbiter) && (
              <div className="mt-4 p-4 rounded-[8px] bg-soft border border-line">
                <div className="font-semibold text-[13px] text-ink mb-1">
                  {isArbiter ? "Arbiter ruling" : "Propose a settlement"}
                </div>
                {proposal.proposer && (
                  <p className="text-[12px] text-muted mb-2">
                    Open proposal from {proposalFromOther ? truncateAddress(proposal.proposer) : "you"}:{" "}
                    <strong className="text-ink">{proposal.vendorShareBps / 100}% to contractor</strong>.
                    {proposalFromOther && isParty && " Enter the same share to accept it."}
                  </p>
                )}
                <label className="block text-[12px] font-semibold text-muted mb-1">Contractor share (%)</label>
                <div className="flex gap-3 items-center flex-wrap">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={vendorShare}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendorShare(e.target.value)}
                    className={`w-28 ${inputClass}`}
                  />
                  <span className="text-[12px] text-muted">
                    ${fmtUsdc(vendorCut)} to contractor · ${fmtUsdc(pact.amount - vendorCut)} to client
                  </span>
                </div>
                <div className="flex gap-2 justify-end mt-3">
                  {isArbiter ? (
                    <button
                      onClick={handleArbitrate}
                      disabled={isPending}
                      className="px-4 h-8 rounded-pill bg-ink text-white text-[12px] font-semibold"
                    >
                      Record Ruling
                    </button>
                  ) : (
                    <button
                      onClick={handlePropose}
                      disabled={isPending}
                      className="px-4 h-8 rounded-pill bg-ink text-white text-[12px] font-semibold"
                    >
                      {wouldAccept ? "Accept Split" : "Propose Split"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[12px] border border-line bg-surface p-5 text-[12.5px]">
            <div className="font-semibold text-ink mb-2">Smart Contract Verification</div>
            <div className="text-muted space-y-1">
              <div>
                Network: <strong>Arc Mainnet (ID: 5042)</strong>
              </div>
              <div>
                Gas Currency: <strong>Native USDC</strong>
              </div>
              <div>
                PyrisPact Contract: <AddressLink address={addresses.pyrisPact} />
              </div>
              <div>
                Source:{" "}
                <a
                  href={`https://sourcify.dev/server/v2/contract/5042/${addresses.pyrisPact}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-blue-700"
                >
                  verified on Sourcify ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <PactTimeline pactId={pact.id} />
      </section>
    </AppShell>
  );
}
