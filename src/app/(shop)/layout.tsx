import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
     <Navbar/>
      <main>{children}</main>
      <Footer/>
    </>
  );
}
