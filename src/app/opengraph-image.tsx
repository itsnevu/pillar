import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Pyris Pact — Programmable B2B Payments on Arc & Robinhood Chain.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card for Pyris Pact. */
export default async function Image() {
  const mark = await readFile(join(process.cwd(), "public/brand/pyris-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={markSrc} width={52} height={52} />
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
            Lock stablecoins into trustless milestone escrows. Instant settlement on Arc and Robinhood Chain.
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
