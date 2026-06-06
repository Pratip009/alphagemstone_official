import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Learning Center">

      <p>
        Explore educational resources and expert information about
        diamonds, gemstones, jewelry care, and industry knowledge
        through the Alpha Imports Learning Center.
      </p>

      {/* Educational Topics */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Educational Topics
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Diamonds</li>

          <li>Gemstones</li>

          <li>Jewelry care and maintenance</li>

          <li>Stone grading standards</li>

          <li>Birthstones and their meanings</li>

          <li>Jewelry trends and styles</li>

          <li>Treatments and gemstone enhancements</li>
        </ul>
      </div>

      {/* Knowledge Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Learn Before You Buy
        </h3>

        <p className="leading-8 text-[#4d463f]">
          Our Learning Center is designed to help customers,
          collectors, jewelers, and wholesale buyers make informed
          purchasing decisions by understanding gemstone quality,
          jewelry craftsmanship, grading systems, and market trends.
        </p>

      </div>

    </FooterPageLayout>
  );
};

export default page;