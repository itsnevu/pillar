"use client";

import { explorerUrl } from "@/lib/chain";
import { explorerAddress, explorerTx } from "@/lib/links";
import { truncateAddress } from "@/lib/contracts";

const linkClass = "font-mono text-ink underline decoration-dotted underline-offset-2 hover:text-blue-700";

/** An address that links to the block explorer when the chain has one. */
export function AddressLink({ address, className }: { address: string; className?: string }) {
  const href = explorerAddress(explorerUrl, address);
  const text = truncateAddress(address);
  if (!href) return <span className={`font-mono ${className ?? ""}`}>{text}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={address} className={`${linkClass} ${className ?? ""}`}>
      {text}
    </a>
  );
}

/** A transaction hash that links to the block explorer. */
export function TxLink({ hash, className, label }: { hash: string; className?: string; label?: string }) {
  const href = explorerTx(explorerUrl, hash);
  const text = label ?? `${hash.slice(0, 10)}…${hash.slice(-6)}`;
  if (!href) return <span className={`font-mono ${className ?? ""}`}>{text}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={hash} className={`${linkClass} ${className ?? ""}`}>
      {text} ↗
    </a>
  );
}

/** A submission note rendered as a link when it is a URL. */
export function ProofLink({ note, className }: { note: string; className?: string }) {
  if (!/^https?:\/\//i.test(note)) return <span className={className}>{note}</span>;
  return (
    <a href={note} target="_blank" rel="noopener noreferrer" className={`text-blue-700 underline break-all ${className ?? ""}`}>
      {note}
    </a>
  );
}
