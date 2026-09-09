"use client";

import { useState } from "react";
import { parseUnits, type Address, type Hash } from "viem";
import { useAccount, useConfig, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { MockERC20Abi, PillarCoreAbi, STOCK_DECIMALS, USDG_DECIMALS, addresses, fmtStock, fmtUsdg } from "@/lib/contracts";
import type { MarketLive, UserPosition } from "@/lib/hooks";

type Tab = "deposit" | "borrow" | "repay" | "withdraw";
const TABS: { id: Tab; label: string }[] = [
  { id: "deposit", label: "Deposit" },
  { id: "borrow", label: "Borrow" },
  { id: "repay", label: "Repay" },
  { id: "withdraw", label: "Withdraw" },
];

type Phase = "idle" | "approve-wallet" | "approve-mining" | "approved" | "act-wallet" | "act-mining" | "done";

const core = addresses.pillarCore as Address;
const usdg = addresses.usdg as Address;

function shortErr(e: unknown): string {
  const m = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
  return m.split("\n")[0].slice(0, 160);
}

export function ActionPanel({ market, position, onDone }: { market: MarketLive; position?: UserPosition; onDone: () => void }) {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<Hash | null>(null);

  const isUsdg = tab === "borrow" || tab === "repay";
  const token = isUsdg ? usdg : market.asset;
  const decimals = isUsdg ? USDG_DECIMALS : STOCK_DECIMALS;
  const needsApproval = tab === "deposit" || tab === "repay";

  const bal = useReadContracts({
    contracts: address
      ? [
          { address: market.asset, abi: MockERC20Abi, functionName: "balanceOf", args: [address] } as const,
          { address: usdg, abi: MockERC20Abi, functionName: "balanceOf", args: [address] } as const,
          { address: token, abi: MockERC20Abi, functionName: "allowance", args: [address, core] } as const,
        ]
      : [],
    query: { enabled: !!address },
  });
  const stockBal = bal.data?.[0]?.result as bigint | undefined;
  const usdgBal = bal.data?.[1]?.result as bigint | undefined;
  const allowance = (bal.data?.[2]?.result as bigint | undefined) ?? 0n;

  let parsed = 0n;
  try {
    parsed = amount ? parseUnits(amount, decimals) : 0n;
  } catch {
    parsed = 0n;
  }
  const approvalOk = !needsApproval || allowance >= parsed;

  const max = (() => {
    switch (tab) {
      case "deposit": return stockBal;
      case "borrow": return position?.maxBorrowable;
      case "repay": return position && usdgBal !== undefined ? (position.debt < usdgBal ? position.debt : usdgBal) : undefined;
      case "withdraw": return position?.collateral;
    }
  })();

  const disabledReason = (() => {
    if (!isConnected) return "Connect a wallet";
    if (parsed === 0n) return "Enter an amount";
    if (tab === "borrow" && !market.open) return "Market closed for new borrows";
    if ((tab === "borrow" || tab === "withdraw") && !market.priceFresh) return "Oracle price is stale";
    if (max !== undefined && parsed > max) return "Exceeds available";
    return null;
  })();

  const busy = phase.endsWith("-wallet") || phase.endsWith("-mining");

  function switchTab(t: Tab) {
    setTab(t);
    setAmount("");
    setErr(null);
    setPhase("idle");
  }

  async function submit() {
    setErr(null);
    try {
      if (!approvalOk) {
        setPhase("approve-wallet");
        const hash = await writeContractAsync({ address: token, abi: MockERC20Abi, functionName: "approve", args: [core, parsed] });
        setPhase("approve-mining");
        setLastHash(hash);
        await waitForTransactionReceipt(config, { hash });
        await bal.refetch();
        setPhase("approved");
        return;
      }
      setPhase("act-wallet");
      const fn = tab === "deposit" ? "depositCollateral" : tab === "withdraw" ? "withdrawCollateral" : tab;
      const hash = await writeContractAsync({ address: core, abi: PillarCoreAbi, functionName: fn, args: [market.asset, parsed] });
      setPhase("act-mining");
      setLastHash(hash);
      await waitForTransactionReceipt(config, { hash });
      setAmount("");
      setPhase("done");
      bal.refetch();
      onDone();
    } catch (e) {
      setErr(shortErr(e));
      setPhase(approvalOk && needsApproval ? "approved" : "idle");
    }
  }

  async function harvest() {
    if (!address) return;
    setErr(null);
    try {
      setPhase("act-wallet");
      const hash = await writeContractAsync({ address: core, abi: PillarCoreAbi, functionName: "harvest", args: [market.asset, address] });
      setPhase("act-mining");
      setLastHash(hash);
      await waitForTransactionReceipt(config, { hash });
      setPhase("done");
      onDone();
    } catch (e) {
      setErr(shortErr(e));
      setPhase("idle");
    }
  }

  const status: Record<Phase, string | null> = {
    idle: null,
    "approve-wallet": "Confirm approval in wallet…",
    "approve-mining": "Approval pending…",
    approved: "Approved — now confirm the action",
    "act-wallet": "Confirm in wallet…",
    "act-mining": "Transaction pending…",
    done: "Confirmed.",
  };

  const label = TABS.find((t) => t.id === tab)!.label;

  return (
    <div className="rounded-[12px] border border-line bg-surface p-5">
      <div className="grid grid-cols-4 gap-1 rounded-[10px] bg-soft border border-line p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`h-9 rounded-pill text-[13px] ${tab === t.id ? "bg-ink text-surface font-medium" : "text-ink hover:bg-white/60"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[11px] tracking-[0.12em] uppercase text-muted">
          <span>Amount ({isUsdg ? "USDG" : market.symbol})</span>
          <button
            className="normal-case tracking-normal text-[12px] underline underline-offset-2 text-ink disabled:text-muted"
            disabled={max === undefined}
            onClick={() => max !== undefined && setAmount(isUsdg ? fmtUsdg(max, 6).replaceAll(",", "") : fmtStock(max, 18).replaceAll(",", ""))}
          >
            Max: {isUsdg ? fmtUsdg(max) : fmtStock(max)}
          </button>
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="mt-2 w-full h-12 rounded-[10px] border border-control bg-bg px-4 font-serif text-[22px] text-ink outline-none focus:border-ink"
        />
      </div>

      <div className="mt-3 text-[12.5px] text-muted leading-relaxed">
        {tab === "deposit" && <>Collateral is routed to the yield source immediately. No oracle needed.</>}
        {tab === "borrow" && <>Up to {market.maxLtvBps / 100}% LTV. Requires a fresh price and an open market. No interest, ever.</>}
        {tab === "repay" && <>Manual repay is always allowed — even when paused or the oracle is stale.</>}
        {tab === "withdraw" && <>Allowed while the remaining LTV stays ≤ {market.maxLtvBps / 100}%, or if debt is zero.</>}
      </div>

      <button
        onClick={submit}
        disabled={!!disabledReason || busy}
        className="mt-5 w-full h-12 rounded-pill bg-ink text-surface text-[14px] font-medium hover:bg-black transition-colors disabled:opacity-50"
      >
        {busy ? status[phase] : disabledReason ?? (!approvalOk ? `Approve ${isUsdg ? "USDG" : market.symbol}` : label)}
      </button>

      {needsApproval && isConnected && parsed > 0n && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
          <StepDot done={approvalOk} active={phase.startsWith("approve")} /> 1. Approve
          <span className="w-6 h-px bg-line" />
          <StepDot done={phase === "done"} active={phase.startsWith("act")} /> 2. {label}
        </div>
      )}

      {!busy && status[phase] && (
        <div className="mt-3 text-[12.5px] text-ink">
          {status[phase]}
          {lastHash && phase === "done" && <span className="ml-2 font-mono text-muted">{lastHash.slice(0, 10)}…</span>}
        </div>
      )}
      {err && <div className="mt-3 text-[12.5px] text-accent-dark">{err}</div>}

      <div className="mt-6 pt-5 border-t border-line flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[0.12em] uppercase text-muted">Pending yield</div>
          <div className="text-[15px] text-ink mt-1">{fmtUsdg(position?.pendingYield)} USDG</div>
          <div className="text-[11.5px] text-muted mt-0.5">Anyone can harvest. 10% protocol cut, rest to your debt.</div>
        </div>
        <button
          onClick={harvest}
          disabled={!isConnected || busy || !position || position.pendingYield === 0n}
          className="rounded-pill border border-ink text-ink text-[13px] font-medium px-4 h-10 hover:bg-soft transition-colors disabled:opacity-40"
        >
          Harvest
        </button>
      </div>
    </div>
  );
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full border ${done ? "bg-ink border-ink" : active ? "border-accent bg-accent/40 animate-pulse" : "border-control bg-surface"}`}
    />
  );
}
