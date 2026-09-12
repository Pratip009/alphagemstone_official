import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
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

export default function DropshipApplyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 w-full">
        <DropshipApplyForm />
      </main>
      <Footer />
    </div>
  );
}
