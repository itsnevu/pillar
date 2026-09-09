import type { Metadata } from "next";
import { Libre_Caslon_Text } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const display = Libre_Caslon_Text({
  variable: "--font-display",
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pillar | Never sell. Never repay.",
  description:
    "Borrow USDG against your Robinhood Crypto tokenized stocks and let the yield repay the loan for you. Self-repaying credit on Robinhood Chain.",
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
