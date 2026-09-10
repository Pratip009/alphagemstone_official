import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const TITLE = "Customer Info & Policies | Alpha Gemstone";
const DESCRIPTION =
  "Shipping, returns, certification, and other customer information for shopping with Alpha Gemstone.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/info` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/info`,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Alpha Gemstone",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
