import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const CANONICAL = `${SITE_URL}/expert-advice`;
const TITLE = "Expert Advice | Alpha Gemstone";
const DESCRIPTION =
  "Professional guidance from Alpha Gemstone for customers, jewelers, designers, and wholesale buyers worldwide.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Alpha Gemstone",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const page = () => {
  return (
    <FooterPageLayout title="Expert Advice">

      <p>
        Alpha Gemstone NY Inc. provides professional guidance and
        personalized assistance for customers, jewelers, designers,
        and wholesale buyers worldwide.
      </p>

      {/* Services */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Professional Assistance For
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Jewelry designers</li>

          <li>Stone matching services</li>

          <li>Custom jewelry projects</li>

          <li>Wholesale buying assistance</li>

          <li>Gemstone recommendations</li>
        </ul>
      </div>

      {/* Consultation Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Personalized Guidance
        </h3>

        <p className="leading-8 text-[#4d463f] mb-6">
          Our experienced team can help you select the right gemstones,
          match stones for jewelry projects, source wholesale inventory,
          and provide recommendations tailored to your business or
          personal requirements.
        </p>

        <div className="space-y-3">

          <a
            href="mailto:orders@alphaimports.com"
            className="block text-[#1a1714] hover:text-[#c9a84c] transition-colors"
          >
            orders@alphaimports.com
          </a>

          <a
            href="mailto:balkhatod@gmail.com"
            className="block text-[#1a1714] hover:text-[#c9a84c] transition-colors"
          >
            balkhatod@gmail.com
          </a>

        </div>

      </div>

    </FooterPageLayout>
  );
};

export default page;