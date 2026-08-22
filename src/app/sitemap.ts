import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/products/diamonds`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/products/gemstones`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/products/watches`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blogs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  return staticPages;
}