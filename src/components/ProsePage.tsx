import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/pillar.css";

/**
 * Shared shell for the long-form pages (docs, blog, risk, terms, privacy).
 * Keeps the measure, the back-link and the "last updated" line in one place.
 */
export function ProsePage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="rusd-shell">
      <main className="rusd-frame rusd-main" style={{ maxWidth: "72ch" }}>
        <Link className="rusd-text-link" href="/">← Pillar Finance</Link>
        <h1 style={{ marginTop: "2rem", lineHeight: 1.1 }}>{title}</h1>
        {intro && (
          <p className="borrow-directory-note" style={{ marginTop: "1rem", maxWidth: "60ch" }}>
            {intro}
          </p>
        )}
        <div style={{ marginTop: "2rem", display: "grid", gap: "1.4rem", lineHeight: 1.75 }}>{children}</div>
        {updated && (
          <p className="borrow-directory-note" style={{ marginTop: "3rem" }}>
            Last updated {updated}
          </p>
        )}
      </main>
    </div>
  );
}

/** A titled section inside a ProsePage. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: "0.9rem" }}>
      <h2 style={{ fontSize: "1.15rem", lineHeight: 1.3, marginTop: "1rem" }}>{heading}</h2>
      {children}
    </section>
  );
}
