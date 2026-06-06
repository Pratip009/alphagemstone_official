import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import Link from 'next/link';

const routes = [
  '/',
  '/about',
  '/products',
  '/contact',
  '/privacy-policy',
  '/shipping-policy',
  '/return-policy',
  '/terms-and-conditions',
  '/help-center',
  '/faq',
  '/wishlist',
  '/learning-center',
  '/expert-advice',
  '/e-catalog',
];

export default function SitemapPage() {
  return (
    <FooterPageLayout title="Sitemap">

      <p>
        Browse all public pages available on Alpha Imports NY Inc.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {routes.map((route) => (
          <Link
            key={route}
            href={route}
            className="rounded-xl border border-[#e8e2d9] bg-white px-5 py-4 hover:border-[#c9a84c] transition-colors"
          >
            {route}
          </Link>
        ))}

      </div>

    </FooterPageLayout>
  );
}