import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProsePage } from "@/components/ProsePage";
import { allPosts, formatDate, postBySlug } from "@/lib/posts";

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return { title: "Not found — Pillar Finance" };
  const description = `${post.excerpt.slice(0, 180).trimEnd()}…`;
  return {
    title: `${post.title} — Pillar Finance`,
    description,
    openGraph: { type: "article", title: post.title, description, publishedTime: post.date },
  };
}

export default async function Page({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();
  return (
    <ProsePage title={post.title} intro={formatDate(post.date)}>
      {post.paragraphs.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      <p style={{ marginTop: "2rem" }}>
        <Link className="rusd-text-link" href="/blog">← All posts</Link>
      </p>
    </ProsePage>
  );
}
