"use client";

import { useState } from "react";
import { USDC_DECIMALS } from "@/lib/contracts";
import { parseUnits, isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { usePactMutations } from "@/lib/hooks";

export function ActionPanel({ onDone }: { onDone?: () => void }) {
  const { isConnected } = useAccount();
  const { createPact, isPending } = usePactMutations();
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddress(vendor)) {
      alert("Invalid contractor address");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Invalid USDC amount");
      return;
    }

    try {
      setStatus("Submitting to Arc Chain...");
      await createPact(vendor as Address, parseUnits(amount, USDC_DECIMALS), days * 86400, title, description);
      setStatus("Pact created successfully!");
      setVendor("");
      setAmount("");
      setTitle("");
      setDescription("");
      if (onDone) onDone();
    } catch (err) {
      console.error(err);
      setStatus(/user rejected|denied/i.test(String(err)) ? "Transaction cancelled in wallet." : "Pact not created: transaction failed.");
    }
  };

  return (
    <div className="rounded-[12px] border border-line bg-surface p-5">
      <h3 className="font-serif text-[18px] text-ink mb-2">New Milestone Escrow</h3>
      <p className="text-[12.5px] text-muted mb-4">
        Lock USDC in trustless escrow on Arc Chain. Disbursed only upon approved deliverable.
      </p>

      {status && (
        <div className="p-3 mb-4 rounded-[6px] bg-emerald-50 text-emerald-800 text-[12px]">
          {status}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 text-[13px]">
        <div>
          <label className="block text-[11px] uppercase font-semibold text-muted mb-1">
            Contractor Address
          </label>
          <input
            type="text"
            required
            placeholder="0x..."
            value={vendor}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendor(e.target.value)}
            className="w-full h-10 px-3 rounded-[6px] border border-line bg-bg font-mono text-ink text-[12px]"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase font-semibold text-muted mb-1">
            Milestone Title
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Audit Delivery"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            className="w-full h-10 px-3 rounded-[6px] border border-line bg-bg text-ink text-[13px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase font-semibold text-muted mb-1">
              Amount (USDC)
            </label>
            <input
              type="number"
              step="any"
              required
              placeholder="1000"
              value={amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-[6px] border border-line bg-bg font-mono text-ink text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase font-semibold text-muted mb-1">
              Deadline
            </label>
            <select
              value={days}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDays(Number(e.target.value))}
              className="w-full h-10 px-2 rounded-[6px] border border-line bg-bg text-ink text-[12px]"
            >
              <option value={3}>3 Days</option>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase font-semibold text-muted mb-1">
            Deliverable Specification
          </label>
          <textarea
            rows={2}
            placeholder="Milestone criteria or PR link"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            className="w-full p-2.5 rounded-[6px] border border-line bg-bg text-ink text-[12px]"
          />
        </div>

        <button
          type="submit"
          disabled={!isConnected || isPending}
          className="w-full h-11 rounded-pill bg-ink text-surface font-semibold text-[13px] hover:bg-black transition-colors disabled:opacity-50 mt-2"
        >
          {isPending ? "Locking USDC..." : "Lock USDC into Escrow"}
        </button>
      </form>
    </div>
  );
}
