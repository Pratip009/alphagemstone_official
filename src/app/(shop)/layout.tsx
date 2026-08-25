import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { getNavCategories } from '@/lib/getNavCategories';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const initialCategories = await getNavCategories();

  return (
    <>
      
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&family=Elsie:wght@400;900&display=swap"
      />
     <Navbar initialCategories={initialCategories} />
      <main>{children}</main>
      <Footer/>
    </>
  );
}