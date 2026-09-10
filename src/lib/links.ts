/**
 * Every outbound link on the site, in one place.
 *
 * Social handles come from the environment so that publishing them is a deploy
 * variable rather than a code change. When a handle is unset the link is simply
 * not rendered — better than shipping an `href="#"` that goes nowhere.
 */
const env = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const LINKS = {
  /** undefined until NEXT_PUBLIC_X_URL is set. */
  x: env(process.env.NEXT_PUBLIC_X_URL),
  /** undefined until NEXT_PUBLIC_TELEGRAM_URL is set. */
  telegram: env(process.env.NEXT_PUBLIC_TELEGRAM_URL),
  support: "mailto:support@pillar.finance",
  // Live pages in this app:
  app: "/app",
  docs: "/docs",
  blog: "/blog",
  risk: "/risk",
  terms: "/terms",
  privacy: "/privacy",
} as const;

/** Canonical origin, used for absolute URLs in metadata, sitemap and robots. */
export const SITE_URL = env(process.env.NEXT_PUBLIC_SITE_URL) ?? "https://pillar.finance";

/** Block explorer link for an address, when the active chain publishes one. */
export function explorerAddress(explorerUrl: string | undefined, address: string): string | undefined {
  if (!explorerUrl || explorerUrl.includes("TODO")) return undefined;
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
