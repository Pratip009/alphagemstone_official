import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import Blog from "@/models/Blog";
import { listSubcategoriesWithChildFlagAll } from "@/services/category.service";
import {
  PRODUCTS_PER_SITEMAP,
  STATIC_SITEMAP_ID,
  getSitemapChunkCount,
} from "@/lib/sitemapConfig";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

/**
 * Next.js's sitemap XML serializer does NOT escape special characters in
 * the `url` field before writing it into `<loc>...</loc>` — confirmed in
 * production, where the unescaped "&" in the
 * /products?category=X&subcategory=Y URLs (built for leaf subcategories
 * below) broke the XML at that exact entry and silently truncated
 * everything after it for any parser reading the file top to bottom,
 * Googlebot included. "&" is perfectly valid inside a URL itself, just not
 * as raw text inside XML, so every url gets run through this before it's
 * returned.
 */
function escapeXmlUrl(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function withEscapedUrls(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return entries.map((entry) => ({ ...entry, url: escapeXmlUrl(entry.url) }));
}

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
 * Tells Next.js how many sitemap files to generate. Delegates the actual
 * count to getSitemapChunkCount() (shared with the /sitemap.xml index
 * route below) so the two can never disagree about how many chunks exist.
 */
export async function generateSitemaps() {
  const chunkCount = await getSitemapChunkCount();
  return Array.from({ length: chunkCount }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Next.js's route param plumbing passes `id` through as a string at
  // runtime (it comes off a URL segment) even though generateSitemaps()
  // returns it as a number and our own type signature above says `number`.
  // Comparing the raw value against STATIC_SITEMAP_ID with strict equality
  // silently misclassified id="0" as a product chunk (falling through to
  // chunkIndex = "0" - 1 = -1, then a negative, DB-rejected `skip`) instead
  // of the static/category/blog chunk. Coercing explicitly here is what
  // actually fixes it — the arithmetic below only works correctly once
  // `numericId` is guaranteed to be a real number.
  const numericId = typeof id === "string" ? parseInt(id, 10) : id;

  try {
    await connectDB();
  } catch (err) {
    console.error("[sitemap] DB connection failed:", err);
    return withEscapedUrls(numericId === STATIC_SITEMAP_ID ? staticRoutes(now) : []);
  }

  if (numericId === STATIC_SITEMAP_ID) {
    const dynamicEntries = await categoryAndBlogRoutes(now);
    return withEscapedUrls([...staticRoutes(now), ...dynamicEntries]);
  }

  // id 1 -> chunk 0, id 2 -> chunk 1, ...
  const chunkIndex = numericId - 1;
  if (chunkIndex < 0) {
    console.error(`[sitemap] received unexpected id "${id}" (numeric ${numericId}), refusing to query with a negative skip`);
    return [];
  }
  const skip = chunkIndex * PRODUCTS_PER_SITEMAP;

  try {
    const products = await Product.find({ isActive: true })
      .select("slug updatedAt")
      .sort({ _id: 1 })
      .skip(skip)
      .limit(PRODUCTS_PER_SITEMAP)
      .lean();

    return withEscapedUrls(
      (products as any[])
        .filter((p) => !!p.slug)
        .map((p) => ({
          url: `${BASE_URL}/products/${p.slug}`,
          lastModified: p.updatedAt ?? now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    );
  } catch (err) {
    console.error(`[sitemap] product chunk ${chunkIndex} failed:`, err);
    return [];
  }
}