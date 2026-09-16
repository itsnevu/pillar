import fs from "node:fs";
import path from "node:path";

export type Post = {
  slug: string;
  title: string;
  /** ISO date, used for ordering and for the sitemap. */
  date: string;
  /** First paragraph, used as the index-page teaser and the OG description. */
  excerpt: string;
  paragraphs: string[];
  file: string;
};

/**
 * Posts live as plain-prose Markdown under `docs/`: first non-empty line is the
 * title, every other non-empty line is a paragraph.
 */
const SOURCES: { slug: string; date: string; file: string }[] = [
  { slug: "every-hole-you-can-poke-in-pyris-pact", date: "2026-09-16", file: "ARTICLE-OBJECTIONS.md" },
  { slug: "the-end-of-the-twenty-percent-freelance-platform-tax", date: "2026-09-16", file: "ARTICLE.md" },
  { slug: "why-b2b-commerce-demands-native-usdc-gas", date: "2026-09-16", file: "ARTICLE-USDC-GAS.md" },
  { slug: "what-trustless-milestone-escrow-can-and-cannot-do", date: "2026-09-12", file: "ARTICLE-LIMITS.md" },
  { slug: "instant-sub-second-settlement-vs-the-five-day-wire", date: "2026-09-10", file: "ARTICLE-ORACLE.md" },
  { slug: "how-pyris-pact-turns-a-work-agreement-into-a-self-settling-contract", date: "2026-08-22", file: "ARTICLE-PYRIS.md" },
];

function read(source: (typeof SOURCES)[number]): Post {
  const raw = fs.readFileSync(path.join(process.cwd(), "docs", source.file), "utf8") as string;
  const lines = raw.trim().split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  const [title, ...paragraphs] = lines;
  return { ...source, title, paragraphs, excerpt: paragraphs[0] ?? "" };
}

/**
 * Newest first. Posts published on the same day keep the order they are declared in.
 */
export function allPosts(): Post[] {
  return SOURCES.map(read)
    .map((post, i) => ({ post, i }))
    .sort((a, b) => b.post.date.localeCompare(a.post.date) || a.i - b.i)
    .map(({ post }) => post);
}

export function postBySlug(slug: string): Post | undefined {
  const source = SOURCES.find((s) => s.slug === slug);
  return source ? read(source) : undefined;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
