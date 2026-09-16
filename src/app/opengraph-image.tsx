import { ImageResponse } from "next/og";

export const alt = "Pyris Pact — Programmable B2B Payments on Arc Chain.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card for Pyris Pact. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#faf8f4",
          color: "#292524",
          padding: "78px 82px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* The pyris mark, redrawn inline */}
          <svg width="46" height="46" viewBox="0 0 36 36" fill="#292524">
            <rect x="4" y="4" width="28" height="4.2" rx="0.6" />
            <path d="M7 8.2h22l-2.6 3.6H9.6Z" />
            <rect x="10.4" y="11.8" width="3.9" height="14.6" />
            <rect x="16.05" y="11.8" width="3.9" height="14.6" />
            <rect x="21.7" y="11.8" width="3.9" height="14.6" />
            <path d="M9.6 26.4h16.8l2.6 3.4H7Z" />
            <rect x="4" y="29.8" width="28" height="3.6" rx="0.6" />
          </svg>
          <div style={{ fontSize: 42, letterSpacing: -1 }}>pyris pact.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>
            Programmable B2B Payments.
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.4,
              color: "#57534e",
              maxWidth: 920,
              fontFamily: "Helvetica, sans-serif",
            }}
          >
            Lock USDC into trustless milestone escrows. Instant settlements and native USDC gas fees on Arc Chain.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#78716c",
            fontFamily: "Helvetica, sans-serif",
          }}
        >
          <span>Zero wire delays · 0% platform fee in beta</span>
          <span>pyris.tech</span>
        </div>
      </div>
    ),
    size,
  );
}
