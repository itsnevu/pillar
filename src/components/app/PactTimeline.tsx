"use client";

import { usePactHistory, type PactEventKind } from "@/lib/hooks";
import { useNetwork } from "@/lib/network";
import { AddressLink, TxLink, ProofLink } from "./Explorer";

const LABEL: Record<PactEventKind, string> = {
  PactCreated: "Escrow funded",
  DeadlineExtended: "Deadline extended",
  WorkSubmitted: "Deliverable submitted",
  PactReleased: "Payment released",
  PactRefunded: "Refunded",
  PactDisputed: "Dispute raised",
  ResolutionProposed: "Settlement proposed",
  PactResolved: "Dispute settled",
};

const DOT: Record<PactEventKind, string> = {
  PactCreated: "bg-amber-500",
  DeadlineExtended: "bg-stone-400",
  WorkSubmitted: "bg-blue-500",
  PactReleased: "bg-emerald-500",
  PactRefunded: "bg-stone-500",
  PactDisputed: "bg-red-500",
  ResolutionProposed: "bg-stone-400",
  PactResolved: "bg-emerald-500",
};

function when(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Every state transition of a pact with the transaction that proves it, on the pact's chain.
 * Built from contract event logs, so it cannot show anything that did not happen.
 */
export function PactTimeline({ pactId }: { pactId: bigint }) {
  const { events, isLoading, isError } = usePactHistory(pactId);
  const net = useNetwork();

  return (
    <div className="rounded-[12px] border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h3 className="font-semibold text-[15px] text-ink">Onchain Activity</h3>
        <span className="text-[11.5px] text-muted">
          {events.length} transaction{events.length === 1 ? "" : "s"} on {net.name}
        </span>
      </div>

      {isLoading && events.length === 0 && (
        <p className="text-[12.5px] text-muted mt-4">Reading event logs from {net.name}…</p>
      )}
      {isError && (
        <p className="text-[12.5px] text-red-700 mt-4">Could not read event logs from the {net.name} RPC. Refresh to retry.</p>
      )}
      {!isLoading && !isError && events.length === 0 && (
        <p className="text-[12.5px] text-muted mt-4">No events found for this pact.</p>
      )}

      {events.length > 0 && (
        <ol className="mt-4 space-y-0">
          {events.map((e, i) => (
            <li key={`${e.txHash}-${i}`} className="relative pl-6 pb-5 last:pb-0">
              {i < events.length - 1 && (
                <span aria-hidden className="absolute left-[5px] top-3 bottom-0 w-px bg-line" />
              )}
              <span aria-hidden className={`absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full ${DOT[e.kind]}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-semibold text-[13px] text-ink">{LABEL[e.kind]}</span>
                <span className="text-[11.5px] text-muted">{when(e.timestamp)}</span>
              </div>
              {e.detail && (
                <div className="text-[12.5px] text-muted mt-0.5 break-words">
                  {e.kind === "WorkSubmitted" ? <ProofLink note={e.detail} /> : e.detail}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted">
                <span>
                  tx <TxLink hash={e.txHash} />
                </span>
                {e.actor && (
                  <span>
                    by <AddressLink address={e.actor} />
                  </span>
                )}
                <span>block {e.blockNumber.toString()}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
