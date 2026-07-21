// app/(main)/layout.tsx  (ShopLayout)
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { getNavCategories } from '@/lib/getNavCategories';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const initialCategories = await getNavCategories();

  return (
    <>
      <Navbar initialCategories={initialCategories} />
      <main><AnalyticsProvider />{children}</main>
      <Footer />
    </>
  );
}