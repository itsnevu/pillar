import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/pillar.css";
import "@/styles/prose.css";

import { Banner, Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LINKS } from "@/lib/links";

/** A section that also earns an entry in the table of contents. */
export type TocEntry = { id: string; heading: string };

/**
 * Shell for every long-form page. It carries the site's own header and footer so
 * a reader arriving from the landing page never lands somewhere that looks like
 * a different product.
 */
export function ProsePage({
  eyebrow,
  title,
  lede,
  meta,
  toc,
  numbered,
  children,
  footNote,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Small facts under the title: a date, a reading time, a version. */
  meta?: string[];
  /** When given, a sticky contents rail appears alongside the prose. */
  toc?: TocEntry[];
  /** Number the sections, for a document that refers to them by number. */
  numbered?: boolean;
  children: ReactNode;
  footNote?: ReactNode;
}) {
  return (
    <>
      <Banner />
      <div className="rusd-shell p2p-app-shell">
        <Header />
        <main className="rusd-frame rusd-main pillar-doc">
          <header className="pillar-doc-head">
            {eyebrow && <p className="pillar-doc-eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
            {lede && <p className="pillar-doc-lede">{lede}</p>}
            {meta && meta.length > 0 && (
              <p className="pillar-doc-meta">
                {meta.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </p>
            )}
          </header>

          <div className="pillar-doc-body" data-toc={toc && toc.length > 0 ? "true" : "false"}>
            {toc && toc.length > 0 && (
              <nav className="pillar-doc-toc" aria-label="On this page">
                <p>On this page</p>
                {toc.map((t) => (
                  <a key={t.id} href={`#${t.id}`}>
                    {t.heading}
                  </a>
                ))}
              </nav>
            )}
            <div className="blog-prose" data-numbered={numbered ? "true" : "false"}>
              {children}
            </div>
          </div>

          <div className="pillar-doc-foot">
            <span>{footNote ?? "Pillar is in open beta. Start with small amounts."}</span>
            <span className="pillar-doc-next">
              <Link className="rusd-text-link" href={LINKS.docs}>
                Docs
              </Link>
              <Link className="rusd-text-link" href={LINKS.whitepaper}>
                Whitepaper
              </Link>
              <Link className="rusd-text-link" href={LINKS.risk}>
                Risk
              </Link>
              <Link className="rusd-text-link" href={LINKS.app}>
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

/** A titled section inside a ProsePage. `id` anchors it for the contents rail. */
export function Section({ id, heading, children }: { id?: string; heading: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2>{heading}</h2>
      {children}
    </section>
  );
}

/** A pulled-out consequence or limit. Used sparingly, for the thing a reader must not miss. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="pillar-note">{children}</p>;
}
