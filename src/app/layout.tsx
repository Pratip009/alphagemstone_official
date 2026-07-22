import type { Metadata } from "next";
import { cache } from "react";

import Providers from "./providers";
import StartupLoader from "./StartupLoader";
import "./global.css";
import CookieConsent from "@/components/ui/Cookieconsent";
import HomeOnlyWidgets from "./HomeOnlyWidgets";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Every other data-facing module in this codebase (newsletter service, email
// templates, blog metadata) resolves the canonical origin from
// NEXT_PUBLIC_SITE_URL and falls back to https://alphagemstone-official-two.vercel.app/. The old
// hardcoded gmstone-new-2026.vercel.app preview URL here meant canonical
// links, Open Graph tags, and JSON-LD were all pointing search engines at a
// staging deployment instead of the real production domain — fixed below.
export const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://alphagemstone-official-two.vercel.app/";

const SITE_NAME = "Alpha Imports";
const OG_IMAGE = `${BASE_URL}/og-image.png`;

const FALLBACK_DESCRIPTION =
  "Discover premium natural diamonds, certified gemstones, sapphires, rubies, emeralds, and luxury fine jewelry collections crafted for elegance and trust.";

const BASE_KEYWORDS = [
  "diamonds",
  "gemstones",
  "fine jewelry",
  "natural diamonds",
  "certified diamonds",
  "sapphires",
  "rubies",
  "emeralds",
  "Alpha Imports",
];

/**
 * Live snapshot of the catalogue, used to keep the site-wide <title>,
 * <meta description>, keywords, and JSON-LD in sync with what's actually in
 * stock instead of a paragraph hand-written once and never revisited.
 * Wrapped in React's `cache()` so generateMetadata() and RootLayout share a
 * single DB round trip per request instead of querying twice, and wrapped in
 * try/catch so a DB hiccup degrades gracefully to static copy rather than
 * breaking every page on the site.
 */
const getCatalogSnapshot = cache(async () => {
  try {
    const { connectDB } = await import("@/lib/db");
    const { getNavCategories } = await import("@/lib/getNavCategories");
    const { getProductStats } = await import("@/services/product.service");

    await connectDB();

    const [categories, stats] = await Promise.all([
      getNavCategories(),
      getProductStats(),
    ]);

    const categoryNames = categories.map((c) => c.name).filter(Boolean);

    return { categoryNames, activeCount: stats?.active ?? 0 };
  } catch (err) {
    console.error("[layout] catalog snapshot failed, using static SEO fallback:", err);
    return { categoryNames: [] as string[], activeCount: 0 };
  }
});

// Root layout metadata is otherwise fully static at build time. Marking it
// as an ISR-style revalidation target means the live category/stock-derived
// copy below is recomputed on a schedule instead of only at the next deploy.
export const revalidate = 3600; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const { categoryNames, activeCount } = await getCatalogSnapshot();

  const topCategories = categoryNames.slice(0, 6);
  const categoryPhrase = topCategories.length
    ? topCategories.slice(0, -1).join(", ") +
      (topCategories.length > 1
        ? `, and ${topCategories[topCategories.length - 1]}`
        : topCategories[0])
    : "natural diamonds, certified gemstones, sapphires, rubies, and emeralds";

  const description =
    activeCount > 0
      ? `Shop ${activeCount.toLocaleString()}+ certified pieces across ${categoryPhrase}, and luxury fine jewelry — crafted for elegance, backed by certification, and built for trust.`
      : FALLBACK_DESCRIPTION;

  const title =
    topCategories.length > 0
      ? `${SITE_NAME} | ${topCategories.slice(0, 3).join(", ")} & Fine Jewelry`
      : `${SITE_NAME} | Fine Diamonds, Gemstones & Jewelry`;

  const keywords = Array.from(new Set([...BASE_KEYWORDS, ...categoryNames]));

  return {
    metadataBase: new URL(BASE_URL),

    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },

    description,
    keywords,

    creator: SITE_NAME,
    publisher: SITE_NAME,
    applicationName: SITE_NAME,
    category: "Jewelry & Gemstones",

    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },

    alternates: {
      canonical: BASE_URL,
    },

    openGraph: {
      type: "website",
      url: BASE_URL,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - Fine Diamonds & Gemstones`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },

    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },

    manifest: "/site.webmanifest",

    // Populate these via env vars once you have real verification codes from
    // Google Search Console / Bing Webmaster Tools; harmless no-ops until then.
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
        : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { categoryNames, activeCount } = await getCatalogSnapshot();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    "@id": `${BASE_URL}/#organization`,
    name: SITE_NAME,
    url: BASE_URL,
    image: OG_IMAGE,
    description:
      activeCount > 0
        ? `${SITE_NAME} offers ${activeCount.toLocaleString()}+ certified natural diamonds, gemstones, and fine jewelry pieces.`
        : "Premium diamonds, gemstones and fine jewelry collections.",
    ...(categoryNames.length > 0 && {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Diamond, Gemstone & Jewelry Categories",
        itemListElement: categoryNames.map((name, i) => ({
          "@type": "OfferCatalog",
          position: i + 1,
          name,
        })),
      },
    }),
  };

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
        <SpeedInsights />
      </body>
    </html>
  );
}