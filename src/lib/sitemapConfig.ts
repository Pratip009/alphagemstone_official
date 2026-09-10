import { connectDB } from "@/lib/db";
import Product from "@/models/Product";

// Google/Bing cap a single <urlset> at 50,000 URLs. We stay well under that
// per file so sitemaps keep generating (and re-crawling) fast even as the
// catalogue grows well past its current ~31k products.
export const PRODUCTS_PER_SITEMAP = 10000;

// Sitemap id 0 carries every non-product URL (static marketing pages,
// categories, subcategories, blog posts). Ids 1..N each carry one page of
// products.
export const STATIC_SITEMAP_ID = 0;

/**
 * How many /sitemap/[id].xml files should exist right now: 1 for the
 * static/content sitemap, plus one per PRODUCTS_PER_SITEMAP-sized page of
 * active products. Shared by generateSitemaps() (which tells Next.js which
 * chunk routes to build) and the /sitemap.xml index route (which has to
 * list the exact same set) so the two can never drift out of sync.
 */
export async function getSitemapChunkCount(): Promise<number> {
  try {
    await connectDB();
    const totalActiveProducts = await Product.countDocuments({ isActive: true });
    const productChunks = Math.max(1, Math.ceil(totalActiveProducts / PRODUCTS_PER_SITEMAP));
    return productChunks + 1; // +1 for the static/content chunk at id 0
  } catch (err) {
    console.error("[sitemap] chunk count query failed, falling back to 1 chunk:", err);
    return 1;
  }
}