import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

const page = () => {
  return (
    <FooterPageLayout title="Drop Shipping Program">

      <p>
        We offer professional drop shipping services for jewelers,
        online sellers, and retailers worldwide.
      </p>

      {/* Benefits */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1a1714] mb-4">
          Benefits
        </h2>

        <ul className="list-disc pl-6 space-y-3">
          <li>Blind shipping available</li>

          <li>
            No pricing information included inside packages
          </li>

          <li>Worldwide shipping services</li>

          <li>Professional and secure packaging</li>

          <li>
            Access to a large inventory selection of gemstones and jewelry
          </li>
        </ul>
      </div>

      {/* Additional Info */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-[#fffdf9] p-6">
        <h3 className="text-xl font-semibold text-[#1a1714] mb-3">
          Partner With Alpha Gemstone
        </h3>

        <p className="leading-8 text-[#4d463f]">
          Our drop shipping program is designed to help businesses expand
          their product offerings without maintaining large inventories.
          We handle secure packaging and worldwide delivery while helping
          you provide a professional customer experience.
        </p>
      </div>

    </FooterPageLayout>
  );
};

export default page;