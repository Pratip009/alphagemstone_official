import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const CANONICAL = `${SITE_URL}/return-policy`;
const TITLE = "Return Policy | Alpha Gemstone";
const DESCRIPTION =
  "Alpha Gemstone's return and exchange policy — eligibility windows, conditions, and how to start a return.";

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

export default function ReturnPolicyPage() {
  return (
    <FooterPageLayout title="Return Policy">

      <p>
        Customer satisfaction is important to us.
      </p>

      <div>
      

        <ul className="list-disc pl-6 space-y-2">
          <li>Returns accepted within 10 days of delivery unless otherwise specified.</li>
          <li>Item must be unused and in original condition.</li>
          <li>Custom orders and special-cut stones are non-returnable.</li>
          <li>Shipping charges are non-refundable.</li>
          <li>Return authorization is required before sending any package back.</li>
          <li>Order history.</li>
          <li>Refunds are processed after inspection of returned merchandise.</li>
        </ul>
      </div>


    </FooterPageLayout>
  );
}