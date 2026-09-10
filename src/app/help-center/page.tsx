import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const CANONICAL = `${SITE_URL}/help-center`;
const TITLE = "Help Center | Alpha Gemstone";
const DESCRIPTION =
  "Get support with product questions, shipping updates, returns, and wholesale inquiries at Alpha Gemstone.";

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
    <FooterPageLayout title="Help Center">

      <p>
        Our customer support team is available to assist you with
        product information, shipping updates, returns, wholesale
        inquiries, and technical assistance.
      </p>

      {/* Support Services */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          How We Can Help
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Product questions and recommendations</li>

          <li>Shipping and delivery inquiries</li>

          <li>Returns and exchanges assistance</li>

          <li>Order status updates</li>

          <li>Wholesale and bulk purchase inquiries</li>

          <li>Technical website support</li>
        </ul>
      </div>

      {/* Customer Support Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Customer Support
        </h3>

        <p className="leading-8 text-[#4d463f]">
          Our team is committed to providing fast, reliable, and
          professional support to ensure a smooth shopping experience
          for all customers worldwide.
        </p>
      </div>

    </FooterPageLayout>
  );
};

export default page;