import type { Metadata } from "next";
import { Libre_Caslon_Text } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SITE_URL } from "@/lib/links";

const display = Libre_Caslon_Text({
  variable: "--font-display",
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
});

const TITLE = "Pyris Pact | Programmable B2B Payments on Arc Chain";
const DESCRIPTION =
  "Lock USDC in trustless milestone escrow. Disburse upon approved deliverables. Native USDC gas fees, zero wire markups, and instant settlement on Arc Chain.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s" },
  description: DESCRIPTION,
  applicationName: "Pyris Pact",
  keywords: [
    "B2B payments",
    "programmable escrow",
    "milestone payments",
    "USDC",
    "Arc Chain",
    "freelancer payments",
    "contractor escrow",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Pyris Pact",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
