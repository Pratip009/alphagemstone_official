import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Volume Discount Program">

      <p>
        Alpha Gemstone NY Inc. offers special pricing programs for
        wholesale customers and large quantity purchases.
      </p>

      {/* Eligible Customers */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Special Pricing Available For
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Bulk orders</li>

          <li>Jewelry manufacturers</li>

          <li>Retail stores</li>

          <li>Wholesale buyers</li>
        </ul>
      </div>

      {/* Pricing Information */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Quantity Pricing
        </h3>

        <p className="leading-8 text-[#4d463f] mb-6">
          We provide competitive pricing and customized volume discounts
          based on order quantity, product selection, and business needs.
          Please contact our team directly for personalized pricing
          information.
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