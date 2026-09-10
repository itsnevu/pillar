import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";
import { allPosts, formatDate } from "@/lib/posts";

export const metadata = {
  title: "Blog — Pillar Finance",
  description: "Writing from Pillar on self-repaying credit, collateral, and lending against assets whose markets close.",
};

export default function Page() {
  const posts = allPosts();
  return (
    <ProsePage title="Blog" intro="Notes on self-repaying credit and the constraints that shape it.">
      {posts.map((p) => (
        <article key={p.slug} style={{ display: "grid", gap: "0.6rem" }}>
          <p className="borrow-directory-note" style={{ margin: 0 }}>{formatDate(p.date)}</p>
          <h2 style={{ fontSize: "1.25rem", lineHeight: 1.25, margin: 0 }}>
            <Link className="rusd-text-link" href={`/blog/${p.slug}`}>{p.title}</Link>
          </h2>
          <p style={{ margin: 0 }}>{p.excerpt.slice(0, 240).trimEnd()}…</p>
        </article>
      ))}
    </ProsePage>
  );
}
