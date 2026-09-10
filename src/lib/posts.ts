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
];

function read(source: (typeof SOURCES)[number]): Post {
  const raw = fs.readFileSync(path.join(process.cwd(), "docs", source.file), "utf8");
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const [title, ...paragraphs] = lines;
  return { ...source, title, paragraphs, excerpt: paragraphs[0] ?? "" };
}

/** Newest first. */
export function allPosts(): Post[] {
  return SOURCES.map(read).sort((a, b) => b.date.localeCompare(a.date));
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
