"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { truncateAddress } from "@/lib/contracts";
import { useMounted } from "@/lib/hooks";

type Props = { className?: string; label?: string };

const base =
  "inline-flex items-center justify-center rounded-pill bg-ink text-surface text-[14px] font-medium px-5 h-11 hover:bg-black transition-colors disabled:opacity-60";

/** Injected-wallet connect button. Shows a truncated address + disconnect when connected. */
export function ConnectButton({ className, label = "Connect" }: Props) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const mounted = useMounted();

  const cls = className ?? base;

  if (!mounted) {
    return (
      <button className={cls} disabled>
        {label}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 h-11 text-[13px] text-ink font-mono">
          <span className="inline-block size-2 rounded-full bg-accent" />
          {truncateAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="rounded-pill border border-line bg-surface text-[13px] text-muted hover:text-ink px-3 h-11 transition-colors"
          title="Disconnect"
        >
          Disconnect
        </button>
      </span>
    );
  }

  const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className={cls}
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
        title={injected ? undefined : "No injected wallet found"}
      >
        {isPending ? "Connecting…" : label}
      </button>
      {error && <span className="text-[11px] text-accent-dark">{error.message.split("\n")[0]}</span>}
    </span>
  );
}
