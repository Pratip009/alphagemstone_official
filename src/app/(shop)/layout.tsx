import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { getNavCategories } from '@/lib/getNavCategories';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const initialCategories = await getNavCategories();

  return (
    <>
      
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap"
      />
     <Navbar initialCategories={initialCategories} />
      <main>{children}</main>
      <Footer/>
    </>
  );
}