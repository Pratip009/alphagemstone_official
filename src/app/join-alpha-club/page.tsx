import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Subscribe to Alpha Bargains">

      <p>
        Join our mailing list to receive exclusive offers, new arrivals,
        and the latest updates from Alpha Imports NY Inc.
      </p>

      {/* Subscriber Benefits */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Subscriber Benefits
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Exclusive discounts and special offers</li>

          <li>Early access to new arrivals</li>

          <li>Special promotions and limited-time deals</li>

          <li>Holiday sales and seasonal savings</li>

          <li>Jewelry and gemstone industry news</li>
        </ul>
      </div>

      {/* Subscription Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Stay Updated
        </h3>

        <p className="leading-8 text-[#4d463f] mb-6">
          Subscribe to receive updates about gemstone collections,
          colored diamonds, jewelry trends, wholesale specials,
          and exclusive promotions directly in your inbox.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">

          <input
            type="email"
            placeholder="Enter your email address"
            className="flex-1 h-12 px-4 rounded-xl border border-[#ddd5c9] bg-white outline-none focus:border-[#c9a84c] transition-colors"
          />

          <button
            className="h-12 px-6 rounded-xl bg-[#1a1714] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Subscribe
          </button>

        </div>

      </div>

    </FooterPageLayout>
  );
};

export default page;