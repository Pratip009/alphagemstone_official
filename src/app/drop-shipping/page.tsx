import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.alphagemstone.com";
const CANONICAL = `${SITE_URL}/drop-shipping`;
const TITLE = "Free Dropship Program | Alpha Gemstone";
const DESCRIPTION =
  "Sell diamonds, gemstones & jewelry without holding inventory. No membership fee, no dropship program fee — Alpha ships directly to your customer.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Alpha Gemstone",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const GOLD = "#c9a84c";
const INK = "#1a1714";
const MUTED = "#4d463f";
const BORDER = "#e8e2d9";
const CREAM = "#fffdf9";

const STEPS = [
  {
    n: "1",
    title: "Choose It",
    body: "Browse AlphaGemstone.com and choose the diamonds, gemstones or jewelry you want to offer.",
  },
  {
    n: "2",
    title: "Sell It",
    body: "Use our available product images and descriptions on your website, social media or an approved marketplace. You decide your own retail selling price.",
  },
  {
    n: "3",
    title: "Order It",
    body: 'After making the sale, submit a "DROPSHIP ORDER" through your seller portal with your customer\'s shipping information.',
  },
  {
    n: "4",
    title: "We Ship It",
    body: "Alpha prepares and ships the merchandise directly to your customer — no Alpha branding or pricing included.",
  },
];

const BENEFITS = [
  { label: "No Membership Fee", body: "There is no membership fee to participate in our standard dropship program." },
  { label: "No Dropship Program Fee", body: "We don't charge you simply for becoming an Alpha dropship customer." },
  { label: "No Large Inventory Investment", body: "You don't have to purchase hundreds of gemstones just to offer a large selection." },
  { label: "No Warehouse", body: "Let Alpha maintain the physical merchandise." },
  { label: "No Packing Department", body: "When we fulfill your dropship order, we handle the packing and shipment." },
  { label: "Thousands of Products", body: "Diamonds, colored diamonds, rubies, sapphires, emeralds, Tanzanite, gemstones, beads, pearls, jewelry and more." },
  { label: "Use Our Images & Descriptions", body: "Approved sellers may use available Alpha product photography and descriptions." },
  { label: "You Set Your Retail Price", body: "You decide the price you charge your customer." },
  { label: "Domestic & International Shipping", body: "We fulfill qualifying orders across the U.S. and many international destinations." },
  { label: "Decades of Experience", body: "Alpha Imports NY Inc. has served the gemstone and jewelry trade since 1988." },
];

const CHANNELS = [
  "Your Own Website",
  "Online Store",
  "Social Media",
  "eBay",
  "Etsy",
  "Amazon",
  "Walmart Marketplace",
  "Facebook / Instagram",
  "Google Shopping",
];

const NICHES = [
  "Natural Diamonds",
  "Fancy Color Diamonds",
  "Small Diamond Melee",
  "Rubies",
  "Sapphires",
  "Emeralds",
  "Tanzanite",
  "Birthstones",
  "Semi-Precious Gemstones",
  "Pearls & Beads",
  "Jewelry",
  "Hard-to-Find Sizes & Shapes",
  "Special Deals & Closeouts",
];

const AUDIENCES = [
  { title: "Jewelers", body: "Expand your online selection without stocking every size and gemstone." },
  { title: "Jewelry Designers", body: "Offer more gemstone choices without purchasing every stone beforehand." },
  { title: "Online Entrepreneurs", body: "Build a specialized gemstone or jewelry store." },
  { title: "eBay & Etsy Sellers", body: "Add qualifying Alpha merchandise to your mix, subject to marketplace rules." },
  { title: "Social Media Sellers", body: "Promote selected products to your followers and customers." },
  { title: "Existing Retail Stores", body: "Expand beyond the merchandise physically in your showcases." },
  { title: "New Business Owners", body: "Start small and grow as your customer base grows." },
];

function DiamondBullet() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        background: GOLD,
        transform: "rotate(45deg)",
        flexShrink: 0,
      }}
    />
  );
}

export default function DropshipLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 w-full">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden" style={{ background: INK }}>
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(${GOLD}55 1px, transparent 1px), linear-gradient(90deg, ${GOLD}55 1px, transparent 1px)`,
              backgroundSize: "44px 44px",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 15% 20%, ${GOLD}22, transparent 45%), radial-gradient(circle at 85% 80%, ${GOLD}18, transparent 40%)`,
            }}
          />

          <div className="relative max-w-6xl mx-auto px-6 lg:px-12 pt-24 pb-20 lg:pt-32 lg:pb-28 text-center">
            <p
              className="uppercase tracking-[0.35em] text-[11px] font-bold mb-6"
              style={{ color: GOLD }}
            >
              💎 Alpha Gemstone Dropship Program
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] mb-7">
              Your Store. Our Inventory.
              <br />
              We Ship. You Profit.
            </h1>
            <p className="max-w-2xl mx-auto text-white/60 text-base lg:text-lg leading-8 mb-10">
              Start or grow a diamond, gemstone &amp; jewelry business — without
              investing in inventory. Sell diamonds, precious and
              semi-precious gemstones, beads, pearls and jewelry online. You
              sell it. Alpha ships it.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {["No Membership Fee", "No Inventory Commitment", "Alpha Ships Directly"].map(
                (chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/85 border rounded-full px-4 py-2"
                    style={{ borderColor: `${GOLD}55`, background: "rgba(255,255,255,0.04)" }}
                  >
                    <DiamondBullet />
                    {chip}
                  </span>
                )
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/drop-shipping/apply"
                className="inline-flex items-center justify-center rounded-md px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#1a1714] transition-transform hover:-translate-y-0.5"
                style={{ background: GOLD }}
              >
                Start Dropshipping With Alpha
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md px-8 py-4 text-sm font-bold uppercase tracking-wider text-white border border-white/25 transition-colors hover:border-white/50"
              >
                Explore Products To Sell
              </Link>
            </div>
          </div>
        </section>

        {/* ── What is Alpha Dropshipping ── */}
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-20 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl mb-6" style={{ color: INK }}>
            What Is Alpha Dropshipping?
          </h2>
          <p className="leading-8 mb-4" style={{ color: MUTED }}>
            Dropshipping gives you a simple way to sell Alpha products without
            keeping them in your own inventory. You choose products from
            AlphaGemstone.com, market them to your customers, decide your own
            retail price, and make the sale.
          </p>
          <p className="leading-8" style={{ color: MUTED }}>
            Once you have the order, submit it to Alpha with your customer's
            shipping information.{" "}
            <strong style={{ color: INK }}>
              We prepare it, we pack it, we ship it directly to your customer.
            </strong>{" "}
            You never need to physically handle the merchandise.
          </p>
        </section>

        {/* ── 4 Steps ── */}
        <section className="py-20" style={{ background: CREAM, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <h2 className="font-serif text-2xl sm:text-3xl text-center mb-14" style={{ color: INK }}>
              Start In 4 Simple Steps
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="bg-white rounded-2xl p-7 border"
                  style={{ borderColor: BORDER }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-serif text-lg mb-5"
                    style={{ background: `${GOLD}18`, color: GOLD }}
                  >
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-lg mb-3" style={{ color: INK }}>
                    {s.title}
                  </h3>
                  <p className="text-[14px] leading-7" style={{ color: MUTED }}>
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-center mt-12 text-sm uppercase tracking-widest font-semibold" style={{ color: GOLD }}>
              You build the business. We handle the fulfillment.
            </p>
          </div>
        </section>

        {/* ── Sell where your customers shop ── */}
        <section className="max-w-5xl mx-auto px-6 lg:px-12 py-20 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl mb-5" style={{ color: INK }}>
            Sell Where Your Customers Shop
          </h2>
          <p className="max-w-xl mx-auto leading-7 mb-8" style={{ color: MUTED }}>
            Build your business through your own website, social media, or an
            approved online marketplace. You choose where and how.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {CHANNELS.map((c) => (
              <span
                key={c}
                className="text-[13px] font-medium rounded-full px-4 py-2 border"
                style={{ borderColor: BORDER, color: INK }}
              >
                {c}
              </span>
            ))}
          </div>
          <p className="text-[13px] max-w-lg mx-auto" style={{ color: "#9c9388" }}>
            Sellers are responsible for following the current rules and
            dropshipping policies of each marketplace or platform they use.
          </p>
        </section>

        {/* ── Why Sell With Alpha ── */}
        <section className="py-20" style={{ background: INK }}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <h2 className="font-serif text-2xl sm:text-3xl text-center text-white mb-14">
              Why Sell With Alpha?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENEFITS.map((b) => (
                <div
                  key={b.label}
                  className="rounded-xl p-6 border"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                >
                  <p className="font-semibold mb-2" style={{ color: GOLD }}>
                    💎 {b.label}
                  </p>
                  <p className="text-[13px] leading-6 text-white/55">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Profit Example ── */}
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-20">
          <h2 className="font-serif text-2xl sm:text-3xl text-center mb-4" style={{ color: INK }}>
            Your Price. Your Margin.
          </h2>
          <p className="text-center max-w-xl mx-auto leading-7 mb-10" style={{ color: MUTED }}>
            One of the biggest advantages of dropshipping is that you control
            your selling price.
          </p>
          <div
            className="rounded-2xl border p-8 sm:p-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center"
            style={{ borderColor: BORDER, background: CREAM }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-2" style={{ color: "#9c9388" }}>
                Alpha Price
              </p>
              <p className="font-serif text-3xl" style={{ color: INK }}>$100</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-2" style={{ color: "#9c9388" }}>
                You Sell For
              </p>
              <p className="font-serif text-3xl" style={{ color: INK }}>$175</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-semibold mb-2" style={{ color: GOLD }}>
                Gross Margin
              </p>
              <p className="font-serif text-3xl" style={{ color: GOLD }}>$75</p>
            </div>
          </div>
          <p className="text-center text-[12px] mt-6" style={{ color: "#9c9388" }}>
            Illustration only. Your actual profit depends on your selling
            price, shipping costs, marketplace fees, payment-processing fees,
            taxes, returns and other expenses.
          </p>
        </section>

        {/* ── Your customer stays your customer ── */}
        <section className="py-20" style={{ background: CREAM, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl mb-6" style={{ color: INK }}>
              Your Customer Stays Your Customer
            </h2>
            <p className="leading-8" style={{ color: MUTED }}>
              This is extremely important to us. When Alpha fulfills an
              approved dropship order, we work behind the scenes as your
              supplier. We do not include Alpha promotional flyers or Alpha
              retail pricing in the package. Your customer purchased from{" "}
              <strong style={{ color: INK }}>you</strong> — and we respect
              that relationship.
            </p>
          </div>
        </section>

        {/* ── Niches ── */}
        <section className="max-w-5xl mx-auto px-6 lg:px-12 py-20 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl mb-5" style={{ color: INK }}>
            Find Your Niche
          </h2>
          <p className="max-w-xl mx-auto leading-7 mb-8" style={{ color: MUTED }}>
            You don't have to sell everything. Pick your specialty — or offer
            them all.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {NICHES.map((n) => (
              <span
                key={n}
                className="text-[13px] font-medium rounded-full px-4 py-2"
                style={{ background: `${GOLD}12`, color: INK }}
              >
                {n}
              </span>
            ))}
          </div>
        </section>

        {/* ── Who is this for ── */}
        <section className="py-20" style={{ background: CREAM, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <h2 className="font-serif text-2xl sm:text-3xl text-center mb-14" style={{ color: INK }}>
              Who Is This Program For?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {AUDIENCES.map((a) => (
                <div key={a.title} className="bg-white rounded-xl p-6 border" style={{ borderColor: BORDER }}>
                  <h3 className="font-semibold mb-2" style={{ color: INK }}>{a.title}</h3>
                  <p className="text-[13px] leading-6" style={{ color: MUTED }}>{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cost / Returns ── */}
        <section className="max-w-5xl mx-auto px-6 lg:px-12 py-20 grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div className="rounded-2xl border p-8" style={{ borderColor: BORDER }}>
            <h3 className="font-serif text-xl mb-4" style={{ color: INK }}>What Does It Cost To Join?</h3>
            <ul className="space-y-2 mb-4">
              {["$0 Membership Fee", "$0 Standard Dropship Program Fee", "$0 Fee To Use Approved Alpha Images"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm font-semibold" style={{ color: INK }}>
                  <DiamondBullet /> {t}
                </li>
              ))}
            </ul>
            <p className="text-[13px] leading-6" style={{ color: MUTED }}>
              You pay Alpha for the merchandise you order, plus applicable
              shipping, taxes, duties or other charges. No need to buy a
              large inventory just to get started.
            </p>
          </div>
          <div className="rounded-2xl border p-8" style={{ borderColor: BORDER }}>
            <h3 className="font-serif text-xl mb-4" style={{ color: INK }}>Returns &amp; Exchanges</h3>
            <p className="text-[13px] leading-6 mb-4" style={{ color: MUTED }}>
              All dropship purchases are covered according to the current
              AlphaGemstone.com return, refund and exchange policy applicable
              to the merchandise purchased. Certain special-order or clearance
              merchandise may have different conditions.
            </p>
            <Link
              href="/return-policy"
              className="text-sm font-semibold underline underline-offset-4"
              style={{ color: GOLD }}
            >
              View Current Return Policy →
            </Link>
          </div>
        </section>

        {/* ── Availability note ── */}
        <section className="max-w-3xl mx-auto px-6 lg:px-12 pb-20">
          <div
            className="rounded-2xl p-7 border-l-4"
            style={{ background: "#fffbeb", borderColor: "#f59e0b" }}
          >
            <p className="font-semibold mb-2 text-[13px] uppercase tracking-wide" style={{ color: "#78350f" }}>
              Important: Confirm Availability
            </p>
            <p className="text-[13px] leading-6" style={{ color: "#78350f" }}>
              Gemstones are not always mass-produced. Some Alpha items —
              particularly unusual gemstones, larger stones, special colors,
              closeouts and one-of-a-kind pieces — may be available in very
              limited quantities. Please confirm availability before promising
              a limited item to your customer.
            </p>
          </div>
        </section>

        {/* ── Why Alpha ── */}
        <section className="py-20" style={{ background: INK }}>
          <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl text-white mb-6">
              Since 1988. Your Partner, Not Just Your Supplier.
            </h2>
            <p className="text-white/55 leading-8 mb-4">
              Dropshipping is only as good as the supplier standing behind the
              seller. Alpha brings decades of experience sourcing and
              supplying diamonds, gemstones and jewelry. Our goal isn't
              simply to sell you a gemstone — it's to become a dependable
              source behind your business.
            </p>
            <p className="text-white/55 leading-8">
              If you make one sale, we want to help you make the next one. If
              you start small, we want to be there as you grow.
            </p>
          </div>
        </section>

        {/* ── Talk to a real person ── */}
        <section className="max-w-3xl mx-auto px-6 lg:px-12 py-20 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl mb-4" style={{ color: INK }}>
            Questions? Talk To A Real Gemstone Person.
          </h2>
          <p className="leading-7 mb-6" style={{ color: MUTED }}>
            Sometimes you don't want another form, chatbot or automated
            answer. You want to talk to someone who understands gemstones.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6 text-sm font-semibold" style={{ color: INK }}>
            <a href="tel:+19143101480" className="hover:underline">Call Mr. Balu — 914-310-1480</a>
            <a href="mailto:balu@alphaimports.com" className="hover:underline">balu@alphaimports.com</a>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative overflow-hidden py-24" style={{ background: INK }}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 0%, ${GOLD}22, transparent 55%)` }}
          />
          <div className="relative max-w-3xl mx-auto px-6 lg:px-12 text-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-white mb-4">
              Ready To Build Your Business?
            </h2>
            <p className="text-white/60 mb-10 leading-7">
              Don't buy the inventory first. Find the customer first — then
              let Alpha help you fulfill the order.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link
                href="/drop-shipping/apply"
                className="inline-flex items-center justify-center rounded-md px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#1a1714]"
                style={{ background: GOLD }}
              >
                Join The Free Dropship Program
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md px-8 py-4 text-sm font-bold uppercase tracking-wider text-white border border-white/25"
              >
                Browse Products To Sell
              </Link>
            </div>
            <p className="text-white/35 text-[12px] uppercase tracking-widest">
              No Membership Fee &nbsp;·&nbsp; No Large Inventory Commitment &nbsp;·&nbsp; Alpha Ships To Your Customer
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
