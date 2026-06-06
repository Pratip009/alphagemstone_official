import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Terms & Conditions">

      <p>
        By using AlphaImports.com, customers agree to the following terms
        and conditions.
      </p>

      {/* Terms List */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Terms of Use
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>
            Product images may appear larger for display purposes.
          </li>

          <li>
            Natural gemstones may vary slightly in color, shape,
            or inclusions.
          </li>

          <li>
            Prices and availability may change without notice.
          </li>

          <li>
            Orders may be canceled in case of pricing or inventory errors.
          </li>

          <li>
            Customers are responsible for providing accurate shipping
            information.
          </li>

          <li>
            Unauthorized use of website images or content is prohibited.
          </li>

          <li>
            All disputes shall be governed under the laws of
            North Carolina, USA.
          </li>
        </ul>
      </div>

      {/* Additional Notice */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Legal Notice
        </h3>

        <p className="leading-8 text-[#4d463f]">
          Alpha Imports NY Inc. reserves the right to update or modify
          these terms at any time without prior notice. Continued use
          of the website constitutes acceptance of any revised terms.
        </p>
      </div>

    </FooterPageLayout>
  );
};

export default page;