import { LINKS } from "@/lib/links";

const TEXT_FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Hand-drawn Arc text-logo: filled arc mark + wordmark (72x24). */
function ArcLogo() {
  return (
    <svg
      className="turret-technology-arc"
      viewBox="0 0 72 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Arc"
    >
      <path d="M2 21 A11 11 0 0 1 24 21 L19 21 A6 6 0 0 0 7 21 Z" fill="#57534e" />
      <text x="30" y="18" fontFamily={TEXT_FONT} fontSize="17" fontWeight="600" fill="#57534e">
        Arc
      </text>
    </svg>
  );
}

/** Social entries are dropped when the handle is not configured yet. */
const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: LINKS.support, label: "support@pyris.tech" },
  { href: LINKS.blog, label: "Blog" },
  { href: LINKS.docs, label: "Documentation" },
  { href: LINKS.whitepaper, label: "Whitepaper" },
  { href: LINKS.risk, label: "Risk" },
  { href: LINKS.terms, label: "Terms" },
  { href: LINKS.privacy, label: "Privacy" },
  ...(LINKS.x ? [{ href: LINKS.x, label: "X" }] : []),
];

export function Footer() {
  return (
    <footer className="rusd-footer">
      <section className="rusd-frame turret-technology" aria-label="Network">
        <img
          className="turret-technology-art"
          alt=""
          width={1536}
          height={1024}
          src="/illustrations/pyris-urn.svg"
        />
        <p>Built on</p>
        <div className="turret-technology-logos">
          <a href="https://arc.network/" aria-label="Arc, Circle's Layer-1 for stablecoin finance">
            <ArcLogo />
          </a>
        </div>
      </section>
      <div className="rusd-frame rusd-footer-inner">
        <span>Programmable B2B payments & milestone escrow · Arc Chain</span>
        <div className="rusd-footer-links">
          {FOOTER_LINKS.map((l) => (
            <a className="rusd-text-link" href={l.href} key={l.label}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
