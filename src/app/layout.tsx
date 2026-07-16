import type { Metadata } from "next";

import Providers from "./providers";
import StartupLoader from "./StartupLoader";
import "./global.css";
import FloatingSocialIcons from "@/components/ui/FloatingSocialIcons";
import GemConsultant from "@/components/GemConsultant/GemConsultant";
import CookieConsent from "@/components/ui/Cookieconsent";
import HomeOnlyWidgets from "./HomeOnlyWidgets";

const BASE_URL = "https://gmstone-new-2026.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: "Alpha Imports | Fine Diamonds, Gemstones & Jewelry",
    template: "%s | Alpha Imports",
  },

  description:
    "Discover premium natural diamonds, certified gemstones, sapphires, rubies, emeralds, and luxury fine jewelry collections crafted for elegance and trust.",

  keywords: [
    "diamonds",
    "gemstones",
    "fine jewelry",
    "natural diamonds",
    "certified diamonds",
    "sapphires",
    "rubies",
    "emeralds",
    "Alpha Imports",
  ],

  creator: "Alpha Imports",
  publisher: "Alpha Imports",

  robots: {
    index: true,
    follow: true,
  },

  alternates: {
    canonical: BASE_URL,
  },

  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Alpha Imports",
    title: "Alpha Imports | Fine Diamonds, Gemstones & Jewelry",
    description:
      "Discover premium natural diamonds, certified gemstones, sapphires, rubies, emeralds, and luxury fine jewelry collections crafted for elegance and trust.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Alpha Imports - Fine Diamonds & Gemstones",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Alpha Imports | Fine Diamonds, Gemstones & Jewelry",
    description:
      "Discover premium natural diamonds, certified gemstones, sapphires, rubies, emeralds, and luxury fine jewelry collections crafted for elegance and trust.",
    images: [`${BASE_URL}/og-image.png`],
  },

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "JewelryStore",
              name: "Alpha Imports",
              url: BASE_URL,
              image: `${BASE_URL}/og-image.png`,
              description:
                "Premium diamonds, gemstones and fine jewelry collections.",
            }),
          }}
        />
      </head>

      <body
        style={{
          background: "var(--bg)",
          color: "var(--text)",
          position: "relative",
        }}
      >
        <Providers>
          <StartupLoader>{children}</StartupLoader>
          <HomeOnlyWidgets />
        </Providers>
        <CookieConsent />
      </body>
    </html>
  );
}
