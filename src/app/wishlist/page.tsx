import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Wish List">

      <p>
        Customers can save their favorite jewelry and gemstone items
        to a personal Wish List for future shopping and easy product
        comparison.
      </p>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Wish List Features
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Save favorite products for later</li>

          <li>
            Easily compare gemstones, diamonds, and jewelry items
          </li>

          <li>
            Access saved items anytime through your customer account
          </li>

          <li>
            Quickly revisit products before making a purchase decision
          </li>
        </ul>
      </div>

      {/* Info Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Shop Smarter
        </h3>

        <p className="leading-8 text-[#4d463f]">
          Your Wish List helps you organize and manage products you
          love while exploring our extensive collection of fine
          diamonds, gemstones, and jewelry.
        </p>
      </div>

    </FooterPageLayout>
  );
};

export default page;