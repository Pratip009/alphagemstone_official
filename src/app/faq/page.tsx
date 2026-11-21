import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import FAQContent from './FAQContent';

// Server wrapper so FooterPageLayout can fetch the navbar categories on the
// server; the interactive FAQ list stays a client component.
export default function FAQPage() {
  return (
    <FooterPageLayout title="faq">
      <FAQContent />
    </FooterPageLayout>
  );
}
