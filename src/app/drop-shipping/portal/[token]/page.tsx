import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import DropshipPortal from "@/components/dropship/DropshipPortal";

export const metadata: Metadata = {
  title: "Seller Portal | Alpha Gemstone Dropship Program",
  robots: { index: false, follow: false },
};

export default async function DropshipPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 w-full">
        <DropshipPortal token={token} />
      </main>
      <Footer />
    </div>
  );
}
