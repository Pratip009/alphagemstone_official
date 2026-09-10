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
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}