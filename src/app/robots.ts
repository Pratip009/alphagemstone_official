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
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}