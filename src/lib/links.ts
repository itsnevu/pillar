/**
 * Every outbound link on the site, in one place.
 *
 * The X handle can be overridden from the environment so a move is a deploy
 * variable rather than a code change.
 */
const env = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const LINKS = {
  /** The only official social account. Override with NEXT_PUBLIC_X_URL if it ever moves. */
  x: env(process.env.NEXT_PUBLIC_X_URL) ?? "https://x.com/pyristech",
  support: "mailto:support@pyris.tech",
  // Live pages in this app:
  app: "/app",
  docs: "/docs",
  whitepaper: "/whitepaper",
  blog: "/blog",
  risk: "/risk",
  terms: "/terms",
  privacy: "/privacy",
} as const;

/** Canonical origin, used for absolute URLs in metadata, sitemap and robots. */
export const SITE_URL = env(process.env.NEXT_PUBLIC_SITE_URL) ?? "https://pyris.tech";

/** Block explorer link for an address, when the active chain publishes one. */
export function explorerAddress(explorerUrl: string | undefined, address: string): string | undefined {
  if (!explorerUrl || explorerUrl.includes("TODO")) return undefined;
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}

/** Block explorer link for a transaction hash. */
export function explorerTx(explorerUrl: string | undefined, hash: string): string | undefined {
  if (!explorerUrl || explorerUrl.includes("TODO")) return undefined;
  return `${explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}
