import FooterPageLayout from '@/components/footer-pages/footer-page-layout';

export default function ReturnPolicyPage() {
  return (
    <FooterPageLayout title="Return Policy">

      <p>
        Customer satisfaction is important to us.
      </p>

      <div>
      

        <ul className="list-disc pl-6 space-y-2">
          <li>Returns accepted within 10 days of delivery unless otherwise specified.</li>
          <li>Item must be unused and in original condition.</li>
          <li>Custom orders and special-cut stones are non-returnable.</li>
          <li>Shipping charges are non-refundable.</li>
          <li>Return authorization is required before sending any package back.</li>
          <li>Order history.</li>
          <li>Refunds are processed after inspection of returned merchandise.</li>
        </ul>
      </div>


    </FooterPageLayout>
  );
}