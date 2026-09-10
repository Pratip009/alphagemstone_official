import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/api/",
          "/cart",
          "/checkout",
          "/login",
          "/signup",
          "/forgot-password",
          "/wishlist",
          "/compare",
          "/orders",
          // Faceted/filter query strings on the product listing create
          // near-infinite low-value URL combinations (sort order, pagination
          // noise, price sliders). The canonical + noindex meta on those
          // pages already keeps them out of the index; blocking the noisiest
          // params here too just saves crawl budget for pages worth ranking.
          "/products?*sortBy=*",
          "/products?*page=*",
          "/*?*utm_",
        ],
      },
    ],
    // NOT /sitemap.xml — that literal path collides with the sitemap.ts
    // metadata-route convention itself (see sitemap-index.xml/route.ts for
    // why) and breaks the production build. Crawlers only need this
    // robots.txt directive to find it; the filename doesn't matter to them.
    sitemap: `${BASE_URL}/sitemap-index.xml`,
    host: BASE_URL,
  };
}