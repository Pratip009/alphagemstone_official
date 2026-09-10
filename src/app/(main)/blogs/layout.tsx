import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import Blog from "@/models/Blog";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

const TITLE = "Jewelry & Gemstone Blog | Alpha Gemstone";
const DESCRIPTION =
  "Expert guides on diamonds, gemstones, and fine jewelry — buying advice, care tips, and industry insight from Alpha Gemstone.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blogs` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blogs`,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Alpha Gemstone",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function BlogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort ItemList of the most recent posts for the blog index —
  // a DB hiccup here should never take down the (client-rendered) blog
  // list itself, just omit this extra bit of structured data.
  let itemListJsonLd: Record<string, unknown> | null = null;
  try {
    await connectDB();
    const recent = await Blog.find({ status: "published" })
      .sort({ publishedAt: -1 })
      .limit(20)
      .select("title slug")
      .lean();

    if (recent.length > 0) {
      itemListJsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: (recent as any[]).map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/blogs/${b.slug}`,
          name: b.title,
        })),
      };
    }
  } catch (err) {
    console.error("[blogs layout] recent-posts query failed:", err);
  }

  return (
    <>
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      {children}
    </>
  );
}
