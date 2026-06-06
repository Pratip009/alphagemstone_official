import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Where Is My Order?">

      <p>
        Customers can easily track their orders using their shipment
        details or account information.
      </p>

      {/* Tracking Options */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Track Your Order
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Tracking number provided after shipment</li>

          <li>
            Order confirmation email with shipment details
          </li>

          <li>
            Customer account login for order history and updates
          </li>
        </ul>
      </div>

      {/* Assistance Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Need Assistance?
        </h3>

        <p className="leading-8 text-[#4d463f]">
          If you need help locating your order or tracking shipment
          information, please contact our support team.
        </p>

        <div className="mt-5">
          <p className="text-sm uppercase tracking-[0.2em] font-semibold text-[#c9a84c] mb-2">
            Support Email
          </p>

          <a
            href="mailto:orders@alphaimports.com"
            className="text-[#1a1714] font-medium hover:text-[#c9a84c] transition-colors"
          >
            orders@alphaimports.com
          </a>
        </div>
      </div>

    </FooterPageLayout>
  );
};

export default page;