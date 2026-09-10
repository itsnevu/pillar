import { LINKS } from "@/lib/links";

const TEXT_FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Hand-drawn Chainlink text-logo: hexagon ring + wordmark (84x21, same box Turret uses). */
function ChainlinkLogo() {
  return (
    <svg
      className="turret-technology-chainlink"
      width="84"
      height="21"
      viewBox="0 0 84 21"
      role="img"
      aria-label="Chainlink"
    >
      <path
        fill="#292524"
        fillRule="evenodd"
        d="M10.5 1 18.7 5.75v9.5L10.5 20 2.3 15.25v-9.5L10.5 1Zm0 3.6L5.4 7.55v5.9l5.1 2.95 5.1-2.95v-5.9L10.5 4.6Z"
      />
      <text x="22.5" y="15.4" fill="#292524" fontFamily={TEXT_FONT} fontSize="13.4" fontWeight="600" letterSpacing="-0.2">
        Chainlink
      </text>
    </svg>
  );
}

/** Hand-drawn KyberSwap text-logo: three-wedge K mark + wordmark (96x32). */
function KyberSwapLogo() {
  return (
    <svg
      className="turret-technology-kyber"
      width="96"
      height="32"
      viewBox="0 0 96 32"
      role="img"
      aria-label="KyberSwap"
    >
      <g fill="#292524">
        <path d="M3 7 8 4.6v22.8L3 25Z" />
        <path d="M10.2 5.6 21.6 9.8 10.2 15.4Z" />
        <path d="M10.2 16.6 21.6 22.2 10.2 26.4Z" />
      </g>
      <text x="25" y="20.4" fill="#292524" fontFamily={TEXT_FONT} fontSize="12.6" fontWeight="500" letterSpacing="-0.25">
        KyberSwap
      </text>
    </svg>
  );
}

/** Social entries are dropped when the handle is not configured yet. */
const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: LINKS.support, label: "support@pillar.finance" },
  { href: LINKS.blog, label: "Blog" },
  { href: LINKS.docs, label: "Documentation" },
  { href: LINKS.risk, label: "Risk" },
  { href: LINKS.terms, label: "Terms" },
  { href: LINKS.privacy, label: "Privacy" },
  ...(LINKS.x ? [{ href: LINKS.x, label: "X" }] : []),
  ...(LINKS.telegram ? [{ href: LINKS.telegram, label: "Telegram" }] : []),
];

export function Footer() {
  return (
    <footer className="rusd-footer">
      <section className="rusd-frame turret-technology" aria-label="Technology integrations">
        <p>Technology</p>
        <div className="turret-technology-logos">
          <a href="https://chain.link/" aria-label="Chainlink">
            <ChainlinkLogo />
          </a>
          <a href="https://kyberswap.com/" aria-label="KyberSwap">
            <KyberSwapLogo />
          </a>
        </div>
      </section>
      <div className="rusd-frame rusd-footer-inner">
        <span>Self-repaying collateral credit · Robinhood Chain</span>
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
