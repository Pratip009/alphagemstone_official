import GemsPromise from "@/components/ui/GemsPromise";
import HeroCarousel from "@/components/ui/Herocarousel";
import ShopByCategory from "@/components/ui/Shopbycategory";
import TrustBadges from "@/components/ui/TrustBadges";
import Testimonials from "@/components/ui/Testimonials";
import SpecialsMarquee from "@/components/ui/Specialsmarquee";
import FeaturedInNews from "@/components/ui/FeaturedInNews";
import JewelryModal from "@/components/ui/Jewelrymodal";
import { connectDB } from "@/lib/db";
import HeroSlide from "@/models/HeroSlide";
import BestSellersMarquee from "@/components/ui/BestSellersMarquee";
import WorldShipping from "@/components/ui/WorldShipping";
import BirthstoneCarousel from "@/components/ui/BirthstoneCarousel";
import AwardsAccolades from "@/components/ui/AwardsAccolades";
import DiamondStudsSection from "@/components/ui/DiamondStudsSection";

// Statically generate this page (ISR): built once, served from cache, and
// silently regenerated in the background at most once every 5 minutes.
// Visitors always get a pre-rendered HTML response with the hero image
// URL already in it — no per-request DB round trip — while edits made in
// /admin/hero-slides still show up within ~5 min without a redeploy.
export const revalidate = 300;

// Pre-fetch hero slides at build/revalidation time so the carousel renders
// immediately with data — no client-side loading skeleton on first paint.
async function getHeroSlides() {
  try {
    await connectDB();
    const slides = await HeroSlide.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    // lean() returns POJO but _id / dates aren't serialisable — convert to plain JSON
    return JSON.parse(JSON.stringify(slides));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const initialSlides = await getHeroSlides();

  return (
    <main className="w-full">
      <section className="overflow-hidden">
        <HeroCarousel initialSlides={initialSlides} />
      </section>
      <TrustBadges />
      <ShopByCategory />
      <WorldShipping/>
      <GemsPromise />
      <BirthstoneCarousel/>
      <AwardsAccolades/>
      <SpecialsMarquee />
      <DiamondStudsSection videoSrc="/video/shop.mp4" />
      <Testimonials />
      <FeaturedInNews />
      <JewelryModal />
    </main>
  );
}