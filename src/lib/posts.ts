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
 * title, every other non-empty line is a paragraph. No front matter, no parser.
 */
const SOURCES: { slug: string; date: string; file: string }[] = [
  { slug: "the-most-expensive-trade-you-ever-made-was-a-sale", date: "2026-09-10", file: "ARTICLE.md" },
  { slug: "why-we-lend-so-little-against-your-apple", date: "2026-09-10", file: "ARTICLE-LTV.md" },
  { slug: "what-a-self-repaying-loan-cannot-do", date: "2026-09-10", file: "ARTICLE-LIMITS.md" },
  { slug: "an-oracle-should-refuse", date: "2026-09-10", file: "ARTICLE-ORACLE.md" },
];

function read(source: (typeof SOURCES)[number]): Post {
  const raw = fs.readFileSync(path.join(process.cwd(), "docs", source.file), "utf8");
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const [title, ...paragraphs] = lines;
  return { ...source, title, paragraphs, excerpt: paragraphs[0] ?? "" };
}

/**
 * Newest first. Posts published on the same day keep the order they are declared
 * in — the launch set all shares a date, and a stable sort is more useful there
 * than an arbitrary one.
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
