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

const TITLE = "Pillar | Never sell. Never repay.";
const DESCRIPTION =
  "Borrow USDG against your Robinhood Crypto tokenized stocks and let the yield repay the loan for you. Self-repaying credit on Robinhood Chain.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s" },
  description: DESCRIPTION,
  applicationName: "Pillar Finance",
  keywords: ["self-repaying loan", "tokenized stocks", "USDG", "Robinhood Chain", "collateral", "DeFi lending"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Pillar Finance",
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
