import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { HeaderNavigation } from "@/components/HeaderNavigation";
import { NetworkSwitcher } from "@/lib/network";
import { CHAIN_LIST_TEXT } from "@/lib/chains";

/** The Pyris mark (public/brand/pyris-mark.png). Used by the /app shell. */
export function PyrisMark({ size = 30 }: { size?: number }) {
  return <img alt="" aria-hidden="true" height={size} width={size} src="/brand/pyris-mark.png" style={{ display: "block" }} />;
}

export function Banner() {
  return (
    <aside className="turret-beta-notice" aria-label="Open beta notice">
      <p>
        <strong>Pyris Pact is in open beta.</strong> Programmable B2B escrow & payments on {CHAIN_LIST_TEXT}.
      </p>
    </aside>
  );
}

export function Header() {
  return (
    <header className="rusd-topbar">
      <div className="rusd-frame rusd-topbar-inner rusd-topbar-preview">
        <Link aria-label="Pyris home" className="rusd-brand-link" href="/">
          <span aria-label="Pyris" className="dockyard-logo" role="img" style={{ height: 36 }}>
            <span aria-hidden="true" className="dockyard-logo-mark-frame" style={{ height: 36, width: 36 }}>
              <img alt="" className="dockyard-logo-mark" height={36} width={36} src="/brand/pyris-mark.png" />
            </span>
            <span className="dockyard-logo-wordmark" style={{ fontSize: "23.76px" }}>
              pyris.
            </span>
          </span>
        </Link>

        <HeaderNavigation />

        <div className="rusd-account">
          {/* Arc or Robinhood Chain: which deployment the public directory and the app read. */}
          <NetworkSwitcher />
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
