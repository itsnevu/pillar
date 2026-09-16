import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { HeaderNavigation } from "@/components/HeaderNavigation";

/** The Pyris mark (public/brand/pyris-mark.png). Used by the /app shell. */
export function PyrisMark({ size = 30 }: { size?: number }) {
  return <img alt="" aria-hidden="true" height={size} width={size} src="/brand/pyris-mark.png" style={{ display: "block" }} />;
}

export function Banner() {
  return (
    <aside className="turret-beta-notice" aria-label="Open beta notice">
      <p>
        <strong>Pyris Pact is in open beta.</strong> Programmable B2B escrow & payments on Arc Chain.
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
          <span className="rusd-network" title="Arc Chain">
            <span aria-hidden="true" className="rusd-network-dot" />
            <span className="rusd-network-name">Arc Chain</span>
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
