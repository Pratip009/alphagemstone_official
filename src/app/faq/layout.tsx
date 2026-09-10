import type { Metadata } from "next";
import { faqs } from "./faq-data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";

const TITLE = "Frequently Asked Questions | Alpha Gemstone";
const DESCRIPTION =
  "Answers to common questions about pricing, shipping, certification, custom orders, and more at Alpha Gemstone.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/faq`,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Alpha Gemstone",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  // FAQPage structured data is one of the highest-value schema types for
  // organic real estate — Google renders eligible entries as expandable
  // rich results directly in the SERP. Every Q&A pair on the page is
  // included since none are gated behind interaction.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}