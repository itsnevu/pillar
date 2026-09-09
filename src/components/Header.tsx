import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { HeaderNavigation } from "@/components/HeaderNavigation";

/** Inline column glyph (same drawing as /brand/pillar-mark.svg). Used by the /app shell. */
export function PillarMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="28" height="4.2" rx="0.6" fill="#292524" />
      <path d="M7 8.2h22l-2.6 3.6H9.6Z" fill="#292524" />
      <rect x="10.4" y="11.8" width="3.9" height="14.6" fill="#292524" />
      <rect x="16.05" y="11.8" width="3.9" height="14.6" fill="#292524" />
      <rect x="21.7" y="11.8" width="3.9" height="14.6" fill="#292524" />
      <path d="M9.6 26.4h16.8l2.6 3.4H7Z" fill="#292524" />
      <rect x="4" y="29.8" width="28" height="3.6" rx="0.6" fill="#292524" />
    </svg>
  );
}

export function Banner() {
  return (
    <aside className="turret-beta-notice" aria-label="Open beta notice">
      <p>
        <strong>Pillar is in open beta.</strong> Start with small amounts.
      </p>
    </aside>
  );
}

export function Header() {
  return (
    <header className="rusd-topbar">
      <div className="rusd-frame rusd-topbar-inner rusd-topbar-preview">
        <Link aria-label="Pillar home" className="rusd-brand-link" href="/">
          <span aria-label="Pillar" className="dockyard-logo" role="img" style={{ height: 36 }}>
            <span aria-hidden="true" className="dockyard-logo-mark-frame" style={{ height: 36, width: 36 }}>
              <img alt="" className="dockyard-logo-mark" height={36} width={36} src="/brand/pillar-mark.svg" />
            </span>
            <span className="dockyard-logo-wordmark" style={{ fontSize: "23.76px" }}>
              pillar.
            </span>
          </span>
        </Link>

        <HeaderNavigation />

        <div className="rusd-account">
          <span className="rusd-network" title="Robinhood Chain">
            <span aria-hidden="true" className="rusd-network-dot" />
            <span className="rusd-network-name">Robinhood Chain</span>
          </span>
          <div className="dockyard-wallet-control">
            <div className="dockyard-wallet-control" style={{ opacity: 1, transform: "scale(1)" }}>
              <ConnectButton className="dockyard-wallet-button" label="Connect" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
