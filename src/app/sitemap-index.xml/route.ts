import { NextResponse } from "next/server";
import { getSitemapChunkCount } from "@/lib/sitemapConfig";

// IMPORTANT: this route deliberately lives at /sitemap-index.xml, not
// /sitemap.xml. Next.js's generateSitemaps() convention (see sitemap.ts)
// reserves the literal "/sitemap.xml" path for itself internally — even
// though it actually serves chunks at /sitemap/[id].xml, having a *second*
// route also resolve to "/sitemap.xml" causes next-metadata-route-loader to
// process src/app/sitemap.ts twice and emit a duplicate `GET` export,
// breaking the production build. Pointing robots.txt at this differently
// named path avoids the collision entirely; the Sitemap: directive in
// robots.txt works with any URL, it doesn't have to be named sitemap.xml.
const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

export const revalidate = 3600; // 1 hour — matches how often chunk counts realistically change

export async function GET() {
  const chunkCount = await getSitemapChunkCount();
  const now = new Date().toISOString();

  const sitemapEntries = Array.from({ length: chunkCount }, (_, id) => id)
    .map(
      (id) => `  <sitemap>
    <loc>${BASE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}