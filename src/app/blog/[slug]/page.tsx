import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/styles/pyris.css";
import "@/styles/prose.css";

import { Banner, Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { allPosts, formatDate, postBySlug } from "@/lib/posts";

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return { title: "Not found — Pyris Pact" };
  const description = `${post.excerpt.slice(0, 180).trimEnd()}…`;
  return {
    title: `${post.title} — Pyris Pact`,
    description,
    openGraph: { type: "article", title: post.title, description, publishedTime: post.date },
  };
}

/** Roughly 230 words a minute, rounded up — close enough to be useful, never precise enough to mislead. */
function readingTime(paragraphs: string[]): string {
  const words = paragraphs.reduce((n, p) => n + p.split(/\s+/).length, 0);
  return `~${Math.max(1, Math.ceil(words / 230))} min read`;
}

export default async function Page({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <Banner />
      <div className="rusd-shell p2p-app-shell">
        <Header />
        <main className="rusd-frame rusd-main pyris-doc">
          <header className="blog-article-heading">
            <p className="pyris-doc-eyebrow">Blog</p>
            <h1>{post.title}</h1>
            <p className="pyris-doc-meta">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>{readingTime(post.paragraphs)}</span>
            </p>
          </header>
          <div className="blog-article-rule" />

          <article className="blog-prose">
            {post.paragraphs.map((t, i) => (
              <p key={i} className={i === 0 ? "pyris-first" : undefined}>
                {t}
              </p>
            ))}
          </article>

          <div className="pyris-doc-foot">
            <Link className="rusd-text-link" href="/blog">
              ← All posts
            </Link>
            <span className="pyris-doc-next">
              <Link className="rusd-text-link" href="/docs">
                How Pyris works
              </Link>
              <Link className="rusd-text-link" href="/app">
                Open the app
              </Link>
            </span>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
