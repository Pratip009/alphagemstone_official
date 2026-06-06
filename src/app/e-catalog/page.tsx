import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="E-Catalog">

      <p>
        Explore our digital product catalogs featuring the latest
        jewelry, diamonds, and gemstone collections from
        Alpha Imports NY Inc.
      </p>

      {/* Catalog Features */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Featured Catalog Collections
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>New arrivals</li>

          <li>Featured jewelry collections</li>

          <li>Sale and promotional items</li>

          <li>Seasonal specials</li>

          <li>Wholesale product selections</li>
        </ul>
      </div>

      {/* Digital Catalog Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Browse Our Digital Catalogs
        </h3>

        <p className="leading-8 text-[#4d463f] mb-6">
          Our E-Catalog provides convenient access to a wide range of
          gemstones, colored diamonds, jewelry collections, and wholesale
          inventory available for customers, retailers, and designers
          worldwide.
        </p>

        <div className="space-y-3">

          <a
            href="https://www.alphaimports.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[#1a1714] hover:text-[#c9a84c] transition-colors"
          >
            Visit AlphaImports.com
          </a>

          <a
            href="mailto:orders@alphaimports.com"
            className="block text-[#1a1714] hover:text-[#c9a84c] transition-colors"
          >
            Request Catalog Information
          </a>

        </div>

      </div>

    </FooterPageLayout>
  );
};

export default page;