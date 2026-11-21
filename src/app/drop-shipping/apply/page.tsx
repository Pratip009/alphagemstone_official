import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import { getNavCategories } from "@/lib/getNavCategories";
import Footer from "@/components/ui/Footer";
import DropshipApplyForm from "@/components/dropship/DropshipApplyForm";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const TITLE = "Apply — Free Dropship Program | Alpha Gemstone";
const DESCRIPTION =
  "Apply to join the Alpha Gemstone Dropship Program. No membership fee, no login required.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/drop-shipping/apply` },
  robots: { index: false, follow: true },
};

export default async function DropshipApplyPage() {
  const initialCategories = await getNavCategories();
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar initialCategories={initialCategories} />
      <main className="flex-1 w-full">
        <DropshipApplyForm />
      </main>
      <Footer />
    </div>
  );
}
