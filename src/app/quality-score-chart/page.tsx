import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Quality Score Chart">

      <p>
        Learn about gemstone and diamond grading standards through
        educational quality references used across the jewelry industry.
      </p>

      {/* Grading Topics */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Educational Grading References
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Clarity grading</li>

          <li>Color evaluation</li>

          <li>Cut quality standards</li>

          <li>Stone shape classifications</li>

          <li>Gemstone and diamond quality levels</li>

          <li>Industry grading standards and terminology</li>
        </ul>
      </div>

      {/* Educational Chart */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-6">
          Diamond Quality Factors
        </h3>

        


      </div>

      {/* Additional Information */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Understanding Gemstone Quality
        </h3>

        <p className="leading-8 text-[#4d463f]">
          Quality grading helps customers better understand gemstone
          characteristics, value, rarity, and overall appearance.
          Learning about grading standards allows buyers to make more
          informed purchasing decisions when selecting diamonds,
          gemstones, and fine jewelry.
        </p>

      </div>

    </FooterPageLayout>
  );
};

export default page;