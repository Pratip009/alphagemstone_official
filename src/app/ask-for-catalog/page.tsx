import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Ask For Catalog">

      <p>
        Customers may request digital or printed catalogs featuring our
        latest jewelry, diamonds, and gemstone collections.
      </p>

      {/* Catalog Options */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Available Catalogs
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Latest gemstone collections</li>

          <li>Fine jewelry selections</li>

          <li>Colored diamond inventory</li>

          <li>Wholesale and bulk product catalogs</li>

          <li>Seasonal specials and featured collections</li>
        </ul>
      </div>

      {/* Request Box */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-8">

        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Request a Catalog
        </h3>

        <p className="leading-8 text-[#4d463f] mb-6">
          Contact our team to receive a digital or printed catalog
          showcasing our newest arrivals and featured gemstone selections.
        </p>

        <div className="space-y-4">

          <div>
            <p className="text-sm uppercase tracking-[0.2em] font-semibold text-[#c9a84c] mb-2">
              Email
            </p>

            <a
              href="mailto:orders@alphaimports.com"
              className="text-[#1a1714] hover:text-[#c9a84c] transition-colors"
            >
              orders@alphaimports.com
            </a>
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] font-semibold text-[#c9a84c] mb-2">
              Website
            </p>

            <a
              href="https://www.alphaimports.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a1714] hover:text-[#c9a84c] transition-colors"
            >
              www.alphaimports.com
            </a>
          </div>

        </div>

      </div>

    </FooterPageLayout>
  );
};

export default page;