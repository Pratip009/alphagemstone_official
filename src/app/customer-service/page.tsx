import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Customer Service Center">

      <p>
        Our customer service team is available to assist with product
        inquiries, order updates, shipping support, and wholesale services.
      </p>

      {/* Contact Information */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-6">
          Contact Information
        </h2>

        <div className="space-y-6">

          {/* Company */}
          <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
            <h3 className="text-lg font-semibold text-[#1a1714] mb-2">
              Alpha Imports NY Inc.
            </h3>

            <p className="text-[#4d463f] leading-7">
              Raleigh, North Carolina, USA
            </p>
          </div>

          {/* Emails */}
          <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
            <h3 className="text-lg font-semibold text-[#1a1714] mb-4">
              Email
            </h3>

            <div className="flex flex-col gap-3">
              <a
                href="mailto:balkhatod@gmail.com"
                className="text-[#1a1714] hover:text-[#c9a84c] transition-colors"
              >
                balkhatod@gmail.com
              </a>

              <a
                href="mailto:orders@alphaimports.com"
                className="text-[#1a1714] hover:text-[#c9a84c] transition-colors"
              >
                orders@alphaimports.com
              </a>
            </div>
          </div>

          {/* Website */}
          <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
            <h3 className="text-lg font-semibold text-[#1a1714] mb-4">
              Website
            </h3>

            <a
              href="https://www.alphaimports.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a1714] hover:text-[#c9a84c] transition-colors"
            >
              www.alphaimports.com
            </a>
          </div>

          {/* Support Hours */}
          <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
            <h3 className="text-lg font-semibold text-[#1a1714] mb-4">
              Support Hours
            </h3>

            <p className="text-[#4d463f] leading-7">
              Monday – Friday
              <br />
              10:00 AM – 6:00 PM EST
            </p>
          </div>

        </div>
      </div>

    </FooterPageLayout>
  );
};

export default page;