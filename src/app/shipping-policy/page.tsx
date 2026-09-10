import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const CANONICAL = `${SITE_URL}/shipping-policy`;
const TITLE = "Shipping Policy | Alpha Gemstone";
const DESCRIPTION =
  "Worldwide shipping partners, delivery timelines, and policies for jewelry and gemstone orders at Alpha Gemstone.";

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
    <FooterPageLayout title="Shipping Policy">

      <p>
        We ship worldwide using trusted carriers to ensure safe and reliable
        delivery of your jewelry and gemstones.
      </p>

      {/* Shipping Partners */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Shipping Partners
        </h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>FedEx</li>
          <li>UPS</li>
          <li>USPS</li>
        </ul>
      </div>

      {/* Important Notes */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Important Notes
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Orders ship after payment verification.</li>

          <li>
            Tracking information will be emailed after shipment.
          </li>

          <li>
            Delivery times may vary depending on destination and customs
            clearance.
          </li>

          <li>
            International buyers are responsible for local duties and taxes.
          </li>
        </ul>
      </div>

    </FooterPageLayout>
  );
};

export default page;