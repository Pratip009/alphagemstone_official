import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

export default function PrivacyPolicyPage() {
  return (
    <FooterPageLayout title="Privacy Policy">

      <p>
        At Alpha Imports NY Inc., we respect your privacy and are committed
        to protecting your personal information.
      </p>

      <div>
        <h2 className="font-semibold text-xl mb-3">
          Information We Collect
        </h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>Name</li>
          <li>Address</li>
          <li>Phone number</li>
          <li>Email address</li>
          <li>Payment details</li>
          <li>Order history</li>
          <li>IP address/browser information for security purposes</li>
        </ul>
      </div>

      <div>
        <h2 className="font-semibold text-xl mb-3">
          How We Use Your Information
        </h2>

        <ul className="list-disc pl-6 space-y-2">
          <li>Process and ship orders</li>
          <li>Customer support</li>
          <li>Fraud prevention</li>
          <li>Improve website experience</li>
          <li>Promotional offers/newsletters (optional)</li>
        </ul>
      </div>

    </FooterPageLayout>
  );
}