import Link from "next/link";
import "@/styles/pillar.css";
import "@/styles/prose.css";

import { Banner, Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { allPosts, formatDate } from "@/lib/posts";

export const metadata = {
  title: "Blog — Pillar Finance",
  description:
    "Writing from Pillar on self-repaying credit, collateral, and lending against assets whose markets close.",
};

export default function Page() {
  const posts = allPosts();
  return (
    <>
      <Banner />
      <div className="rusd-shell p2p-app-shell">
        <Header />
        <main className="rusd-frame rusd-main pillar-doc">
          <header className="blog-index-heading">
            <p className="pillar-doc-eyebrow">Writing</p>
            <h1>Blog</h1>
            <p className="pillar-doc-lede">
              Notes on self-repaying credit and the constraints that shape it.
            </p>
          </header>

          <div className="blog-archive">
            {posts.map((p) => (
              <article key={p.slug}>
                <time dateTime={p.date}>{formatDate(p.date)}</time>
                <div>
                  <h2>
                    <Link href={`/blog/${p.slug}`}>{p.title}</Link>
                  </h2>
                  <p>{p.excerpt.slice(0, 220).trimEnd()}…</p>
                </div>
              </article>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
