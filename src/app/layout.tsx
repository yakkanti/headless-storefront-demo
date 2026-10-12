import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WebVitals } from "@/components/WebVitals";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Multi-Brand Headless Commerce Demo",
    template: "%s | Headless Commerce Demo",
  },
  description:
    "A portfolio demo of a multi-brand headless storefront on Next.js and Vercel, with a Salesforce Commerce Cloud (SCAPI) adapter, SEO parity tooling and an incremental migration plan. Fictional brands and mock data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="demo-banner" role="note">
          Portfolio demo. Fictional brands and mock data, not affiliated with any retailer.
        </div>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
