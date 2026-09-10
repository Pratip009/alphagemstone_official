import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import Blog from "@/models/Blog";
import { listSubcategoriesWithChildFlagAll } from "@/services/category.service";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

// Google/Bing cap a single <urlset> at 50,000 URLs. We stay well under that
// per file so sitemaps keep generating (and re-crawling) fast even as the
// catalogue grows well past its current ~31k products.
const PRODUCTS_PER_SITEMAP = 10000;

// Sitemap id 0 carries every non-product URL (static marketing pages,
// categories, subcategories, blog posts). Ids 1..N each carry one page of
// products. Splitting this way means adding products never touches the
// (much more stable) content sitemap, and vice versa.
const STATIC_SITEMAP_ID = 0;

/**
 * Every static/marketing/legal route that isn't generated from the DB.
 * changeFrequency/priority are tuned by how often the page's content
 * actually changes and how much it matters for organic discovery —
 * commerce landing pages and blog index rank above legal boilerplate.
 */
function staticRoutes(now: Date): MetadataRoute.Sitemap {
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
  ) => ({
    url: path ? `${BASE_URL}${path}` : BASE_URL,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("", 1.0, "daily"),
    page("/products", 0.9, "daily"),
    page("/products/diamonds", 0.9, "daily"),
    page("/products/gemstones", 0.9, "daily"),
    page("/products/watches", 0.85, "daily"),
    page("/alpha-bargains", 0.7, "daily"),
    page("/blogs", 0.8, "daily"),
    page("/about", 0.6),
    page("/contact", 0.5),
    page("/faq", 0.6),
    page("/info", 0.5),
    page("/learning-center", 0.55),
    page("/help-center", 0.5),
    page("/customer-service", 0.5),
    page("/expert-advice", 0.55),
    page("/e-catalog", 0.5),
    page("/certificates-appraisal", 0.5),
    page("/find-products", 0.5),
    page("/volume-discount", 0.4),
    page("/drop-shipping", 0.4),
    page("/where-is-my-order", 0.3),
    page("/ask-for-catalog", 0.4),
    page("/join-alpha-club", 0.4),
    page("/quality-score-chart", 0.3),
    page("/privacy-policy", 0.2, "yearly"),
    page("/terms-and-conditions", 0.2, "yearly"),
    page("/shipping-policy", 0.3, "yearly"),
    page("/return-policy", 0.3, "yearly"),
  ];
}

async function categoryAndBlogRoutes(now: Date): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  try {
    const categories = await Category.find({ isActive: true })
      .select("slug updatedAt")
      .lean();

    for (const c of categories as any[]) {
      entries.push({
        url: `${BASE_URL}/category/${c.slug}`,
        lastModified: c.updatedAt ?? now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Subcategories that have their own drill-down grid get the real
    // /category/[slug]/[subSlug] landing page. Leaf subcategories (the
    // majority) don't have a dedicated route — they route straight into
    // the filtered /products listing, so that's what gets indexed for
    // them instead of a URL that would just redirect elsewhere.
    const subcategories = await listSubcategoriesWithChildFlagAll();
    for (const s of subcategories as any[]) {
      const categorySlug = s.category?.slug;
      if (!categorySlug || !s.slug) continue;

      if (s.hasChildren) {
        entries.push({
          url: `${BASE_URL}/category/${categorySlug}/${s.slug}`,
          lastModified: s.updatedAt ?? now,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      } else {
        entries.push({
          url: `${BASE_URL}/products?category=${categorySlug}&subcategory=${s.slug}`,
          lastModified: s.updatedAt ?? now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  } catch (err) {
    console.error("[sitemap] category/subcategory query failed:", err);
  }

  try {
    const blogs = await Blog.find({ status: "published" })
      .select("slug updatedAt publishedAt")
      .lean();

    for (const b of blogs as any[]) {
      entries.push({
        url: `${BASE_URL}/blogs/${b.slug}`,
        lastModified: b.updatedAt ?? b.publishedAt ?? now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (err) {
    console.error("[sitemap] blog query failed:", err);
  }

  return entries;
}

/**
 * Tells Next.js how many sitemap files to generate. Product count is
 * re-checked on every regeneration, so the sitemap automatically grows an
 * extra page once the catalogue crosses another 10,000-product boundary —
 * nothing to remember to bump by hand.
 */
export async function generateSitemaps() {
  try {
    await connectDB();
    const totalActiveProducts = await Product.countDocuments({ isActive: true });
    const productChunks = Math.max(1, Math.ceil(totalActiveProducts / PRODUCTS_PER_SITEMAP));
    return Array.from({ length: productChunks + 1 }, (_, i) => ({ id: i }));
  } catch (err) {
    console.error("[sitemap] generateSitemaps failed, falling back to 1 chunk:", err);
    return [{ id: STATIC_SITEMAP_ID }];
  }
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  try {
    await connectDB();
  } catch (err) {
    console.error("[sitemap] DB connection failed:", err);
    return id === STATIC_SITEMAP_ID ? staticRoutes(now) : [];
  }

  if (id === STATIC_SITEMAP_ID) {
    const dynamicEntries = await categoryAndBlogRoutes(now);
    return [...staticRoutes(now), ...dynamicEntries];
  }

  // id 1 -> chunk 0, id 2 -> chunk 1, ...
  const chunkIndex = id - 1;
  const skip = chunkIndex * PRODUCTS_PER_SITEMAP;

  try {
    const products = await Product.find({ isActive: true })
      .select("slug updatedAt")
      .sort({ _id: 1 })
      .skip(skip)
      .limit(PRODUCTS_PER_SITEMAP)
      .lean();

    return (products as any[])
      .filter((p) => !!p.slug)
      .map((p) => ({
        url: `${BASE_URL}/products/${p.slug}`,
        lastModified: p.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (err) {
    console.error(`[sitemap] product chunk ${chunkIndex} failed:`, err);
    return [];
  }
}
