import Link from "next/link";
import "@/styles/pyris.css";
import "@/styles/prose.css";

import { Banner, Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { allPosts, formatDate } from "@/lib/posts";

export const metadata = {
  title: "Blog — Pyris Pact",
  description:
    "Writing from Pyris Pact on programmable milestone escrow, B2B settlements, and native USDC gas on Arc Chain.",
};

export default function Page() {
  const posts = allPosts();
  return (
    <>
      <Banner />
      <div className="rusd-shell p2p-app-shell">
        <Header />
        <main className="rusd-frame rusd-main pyris-doc">
          <header className="blog-index-heading">
            <p className="pyris-doc-eyebrow">Writing</p>
            <h1>Blog</h1>
            <p className="pyris-doc-lede">
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

