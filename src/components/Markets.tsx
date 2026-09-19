"use client";

import Link from "next/link";
import { usePacts, useMounted } from "@/lib/hooks";
import { fmtDate, pactStatusMeta } from "@/lib/contracts";
import { useNetwork } from "@/lib/network";
import { AddressLink, ProofLink } from "@/components/app/Explorer";

export function Markets() {
  const net = useNetwork();
  const { pacts, stats, isLoading, isError } = usePacts();
  const mounted = useMounted();
  const settling = !mounted || isLoading;
  const sym = net.symbol;

  return (
    <div id="pacts" style={{ marginTop: "24px" }}>
      {/* Live Escrow Directory Table */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <h2>Live Escrow Milestones</h2>
          <span style={{ fontSize: "14px", color: "var(--rusd-muted, #78716c)" }}>
            Currently in escrow: <strong>${net.fmt(stats.activeEscrowAmount)} {sym}</strong> · Settled:{" "}
            <strong>${net.fmt(stats.completedPayouts)} {sym}</strong>
          </span>
        </div>

        <table className="rusd-market-table">
          <caption className="borrow-table-caption">
            {settling ? `Reading pacts from ${net.name}` : `${stats.totalCount} registered pact${stats.totalCount === 1 ? "" : "s"}`}
            {" · "}read live from contract{" "}
            {net.pyrisPact ? <AddressLink address={net.pyrisPact} /> : <span className="font-mono">not deployed</span>} on {net.name}
          </caption>
          <thead>
            <tr>
              <th scope="col">Milestone & Scope</th>
              <th scope="col">Escrow Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {pacts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "32px 16px", color: "var(--rusd-muted, #78716c)" }}>
                  {settling
                    ? `Reading pacts from ${net.name}…`
                    : isError
                      ? `Could not reach the ${net.name} RPC. Refresh to try again.`
                      : `No pacts have been created on ${net.name} yet. Open the app to fund the first one.`}
                </td>
              </tr>
            )}
            {pacts.map((p) => {
              const meta = pactStatusMeta(p.status);
              return (
                <tr className="borrow-directory-row" key={p.id.toString()}>
                  <td>
                    <div className="borrow-table-identity">
                      <strong>{p.title}</strong>
                      <span style={{ fontSize: "13px", color: "var(--rusd-muted, #78716c)" }}>
                        Client: <AddressLink address={p.client} /> → Contractor: <AddressLink address={p.vendor} />
                      </span>
                    </div>
                    <div className="borrow-directory-value">
                      <span>Deadline</span>
                      <span>{fmtDate(p.deadline)}</span>
                    </div>
                    {p.submissionNote && (
                      <div className="borrow-directory-value">
                        <span>Deliverable</span>
                        <span style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <ProofLink note={p.submissionNote} />
                        </span>
                      </div>
                    )}
                    <div className="borrow-directory-value">
                      <span>Onchain proof</span>
                      <span>
                        <Link href={net.link(`/app/${p.id.toString()}`)}>view every transaction →</Link>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: "16px", fontWeight: 600 }}>
                      ${net.fmt(p.amount)} <small style={{ fontWeight: 400, color: "#78716c" }}>{sym}</small>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor:
                          p.status === 2
                            ? "rgba(34, 197, 94, 0.12)"
                            : p.status === 1
                              ? "rgba(59, 130, 246, 0.12)"
                              : "rgba(234, 179, 8, 0.12)",
                        color:
                          p.status === 2
                            ? "#15803d"
                            : p.status === 1
                              ? "#1d4ed8"
                              : "#a16207",
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "currentColor",
                        }}
                      />
                      {meta.label}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="rusd-action rusd-action-secondary"
                      href={net.link("/app")}
                      aria-label={`View ${p.title} in dashboard`}
                    >
                      View in App
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Comparison Grid */}
      <section style={{ marginTop: "48px", borderTop: "1px solid var(--rusd-border, #e7e5e4)", paddingTop: "32px" }}>
        <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Why Businesses Choose Pyris Pact</h2>
        <p style={{ color: "var(--rusd-muted, #78716c)", fontSize: "14px", marginBottom: "20px" }}>
          Traditional payment rails and centralized freelancer platforms take a massive cut of your margin.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div
            style={{
              padding: "20px",
              border: "1px solid var(--rusd-border, #e7e5e4)",
              borderRadius: "8px",
              background: "#fafaf9",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px", color: "#44403c" }}>
              Traditional Freelance Escrows
            </h3>
            <ul style={{ fontSize: "13px", color: "#57534e", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
              <li><strong>10% – 20% platform commission</strong> deducted from payouts.</li>
              <li>5 – 14 business days dispute and withdrawal hold.</li>
              <li>Arbitrary account suspensions and freezing.</li>
            </ul>
          </div>

          <div
            style={{
              padding: "20px",
              border: "1px solid var(--rusd-border, #e7e5e4)",
              borderRadius: "8px",
              background: "#fafaf9",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px", color: "#44403c" }}>
              International Bank Wires
            </h3>
            <ul style={{ fontSize: "13px", color: "#57534e", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
              <li><strong>$35 – $50 flat fee</strong> per international wire transfer.</li>
              <li>3 – 5 days settlement time with zero visibility.</li>
              <li>2% – 4% foreign exchange conversion markups.</li>
            </ul>
          </div>

          <div
            style={{
              padding: "20px",
              border: "1.5px solid #292524",
              borderRadius: "8px",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px", color: "#1c1917" }}>
              Pyris Pact on Arc & Robinhood Chain ✨
            </h3>
            <ul style={{ fontSize: "13px", color: "#292524", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
              <li><strong>0% platform fee</strong> during open beta.</li>
              <li>Sub-cent gas: native <strong>USDC</strong> on Arc, a few cents of ETH on Robinhood Chain.</li>
              <li>Settlement in seconds with onchain cryptographic guarantees.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
