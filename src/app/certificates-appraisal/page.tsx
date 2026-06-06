import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Certificates & Appraisal">

      <p>
        Selected products from Alpha Imports NY Inc. may include
        professional certification and appraisal documentation
        for added confidence and authenticity.
      </p>

      {/* Included Documents */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Available Documentation
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Gemstone certificates</li>

          <li>Diamond grading reports</li>

          <li>Insurance appraisal documents</li>
        </ul>
      </div>

      {/* Information Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Authenticity & Verification
        </h3>

        <p className="leading-8 text-[#4d463f] mb-6">
          Certificates and appraisal reports provide detailed information
          about gemstone quality, grading characteristics, authenticity,
          and estimated value. Availability may vary depending on the
          product and stone type.
        </p>

        <div className="space-y-3">

          <a
            href="mailto:orders@alphaimports.com"
            className="block text-[#1a1714] hover:text-[#c9a84c] transition-colors"
          >
            Contact Us for Certificate Information
          </a>

          <a
            href="https://www.alphaimports.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[#1a1714] hover:text-[#c9a84c] transition-colors"
          >
            Visit AlphaImports.com
          </a>

        </div>

      </div>

    </FooterPageLayout>
  );
};

export default page;