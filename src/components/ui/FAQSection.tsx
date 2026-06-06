"use client";

import { useState } from "react";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    id: 1,
    category: "Pricing",
    question: "Why are your prices so low — is something wrong?",
    answer:
      "We go straight to the source, eliminating middlemen entirely. By purchasing merchandise in bulk volumes worldwide, we gain powerful negotiating leverage and pass those savings on to you — meaning you often pay below wholesale rates.",
  },
  {
    id: 2,
    category: "Shipping",
    question: "Do you ship to South Africa and what does it cost?",
    answer:
      "Yes! We ship to South Africa. Costs start from $30 via USPS and approximately $50–$100 via FedEx. For the most current rates, please visit the international shipping section on our website.",
  },
  {
    id: 3,
    category: "Services",
    question: "Can you resize and mount a stone I purchase?",
    answer:
      "Absolutely. We can resize and mount any stone you purchase from us with perfection — for just $50.",
  },
  {
    id: 4,
    category: "Buying & Selling",
    question: "Do you buy loose gemstones from sellers?",
    answer:
      "We buy closeouts and bulk volumes. If your offering matches our requirements, we'd be interested. Note: you must have a registered business or company — we only buy through verified trade entities.",
  },
  {
    id: 5,
    category: "Products",
    question: "Are your gemstones real or synthetic/simulated?",
    answer:
      "We sell both real and synthetic/simulated products. Each product clearly states its nature in the description. Use the search bar to filter by the type you're looking for.",
  },
  {
    id: 6,
    category: "Pricing",
    question: "What currency are your products priced in?",
    answer: "All our prices are listed in US Dollars (USD).",
  },
  {
    id: 7,
    category: "Visit Us",
    question: "Can I visit your showroom in New York City?",
    answer:
      "You're very welcome! Please call us at least a day in advance at 914-310-1480 to schedule a dedicated appointment. Bring your personal and business ID (or just personal ID if you've purchased from us before and aren't NYC-based).",
  },
  {
    id: 8,
    category: "Gemology",
    question: "Are diamonds the rarest of all gemstones?",
    answer:
      "Not necessarily. De Beers controls diamond supply to maintain demand. A Ruby Spinel of exceptional quality can be rarer than an average diamond. That said, a 'D' color flawless diamond is among the rarest of all gemstones — rarity depends on color, carat, clarity, and whether a gem can be synthesized.",
  },
  {
    id: 9,
    category: "Pricing",
    question: "Are there discounts for bulk purchases?",
    answer:
      "Our prices are already significantly below market, so initial bulk orders may not see additional discounts. However, we do have substantial rebate tiers for large purchases. Check our rewards programme on the website homepage.",
  },
  {
    id: 10,
    category: "Products",
    question: "Where do your emeralds and rubies come from?",
    answer:
      "Our emeralds are sourced from both Brazil and Colombia. Rubies come from Thailand and Burma — two of the most renowned ruby-producing regions in the world.",
  },
  {
    id: 11,
    category: "Products",
    question: "What lengths do silk cord necklaces come in?",
    answer:
      "Silk cords are available in 16, 18, and 20 inch lengths. Where applicable, they feature 925 sterling silver findings.",
  },
  {
    id: 12,
    category: "Gemology",
    question: "What makes a gemstone valuable?",
    answer:
      "Value depends on beauty, rarity, durability, cut quality, demand, and color. Each factor interplays with the others — subtle color differences that seem minor to an untrained eye can translate into significant price differences on the market.",
  },
  {
    id: 13,
    category: "Gemology",
    question: "Is Spinel synthetic?",
    answer:
      "It's a common misconception! Spinel was one of the first gems to be synthesized, so people assume it's always lab-made. In fact, it occurs naturally and can be strikingly beautiful. The famous 'Black Prince's Ruby' in Britain's crown jewels is actually a natural Spinel.",
  },
  {
    id: 14,
    category: "Gemology",
    question: "Why isn't a 1-carat diamond double the price of a 0.5-carat?",
    answer:
      "Diamond pricing is driven by supply and demand, not weight alone. Larger stones are exponentially rarer — a 1-carat stone is more than twice as hard to find as a 0.5-carat. This scarcity premium makes pricing non-linear.",
  },
  {
    id: 15,
    category: "Services",
    question: "How do I find my ring size?",
    answer:
      "The most accurate method is to visit your local jeweler and have your finger professionally sized. This ensures the best fit, especially for rings with wider bands.",
  },
  {
    id: 16,
    category: "Gemology",
    question: "What is the best color for Tanzanite?",
    answer:
      "Tanzanite ranges from violet-blue to pure blue or even purple, depending on how it's cut. Color preference is personal — many are drawn to the exotic violet-blue hues, while true blues tend to be the most broadly preferred in the trade.",
  },
  {
    id: 17,
    category: "Orders",
    question: "When will my order be shipped?",
    answer:
      "Orders are shipped within 24–48 hours of payment confirmation. You'll be notified of any delays. Weekends and public holidays are not counted as business days.",
  },
  {
    id: 18,
    category: "Orders",
    question: "Which carriers do you use for shipping?",
    answer:
      "We ship via FedEx, UPS, Priority Mail, and USPS. Multiple delivery speed options are available for FedEx and UPS so you can choose what suits you best.",
  },
  {
    id: 19,
    category: "Orders",
    question: "Will I receive a tracking number?",
    answer:
      "Yes. Once your order ships, you'll receive your tracking number via email so you can monitor delivery in real time.",
  },
  {
    id: 20,
    category: "Payments",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, Amex, Discover), PayPal, cashier's checks, money orders, and secured COD — giving you maximum flexibility.",
  },
  {
    id: 21,
    category: "Payments",
    question: "Is it safe to enter my credit card online?",
    answer:
      "Yes. All transactions are secured with 128-bit SSL encryption, making online purchases as safe as — often safer than — offline transactions.",
  },
  {
    id: 22,
    category: "Payments",
    question: "Can I send my card info by fax?",
    answer: "Yes, you may fax your order to us at 212-768-0599 if you prefer not to order online.",
  },
  {
    id: 23,
    category: "Returns",
    question: "What is your return and refund policy?",
    answer:
      "We offer a 30-day risk-free, no-questions-asked full refund (minus shipping charges). International customers also have 30 days. Sale items are exchange-only. After 30 days and up to 60 days from purchase, items can be returned for replacement or exchange.",
  },
  {
    id: 24,
    category: "Orders",
    question: "What is the Wishlist feature?",
    answer:
      "My Wishlist lets you save items for later or track out-of-stock products. Add items via the 'Add to Wishlist' button on any product page. You can move items to your cart, delete them, or email your wishlist to a friend — all from the Wishlist page.",
  },
  {
    id: 25,
    category: "Shipping",
    question: "Are there customs duties for international orders?",
    answer:
      "International shipments may be subject to import/customs duties and taxes upon arrival in your country. These are the buyer's responsibility. Contact your local customs office for specific rates and regulations.",
  },
  {
    id: 26,
    category: "Gemology",
    question: "Why are colored diamonds so special?",
    answer:
      "Natural color diamonds are breathtakingly rare and expensive. Modern technology now allows colorless diamonds to be permanently color-enhanced at a fraction of the cost. These treated diamonds are stable under normal wear, though extreme heat (above 300°C) should be avoided — always inform your jeweler when resizing.",
  },
];

const categories = ["All", ...Array.from(new Set(faqs.map((f) => f.category)))];

const categoryColors: Record<string, string> = {
  Pricing: "bg-blue-100 text-[#112c52]",
  Shipping: "bg-sky-100 text-sky-800",
  Services: "bg-indigo-100 text-indigo-800",
  "Buying & Selling": "bg-cyan-100 text-cyan-800",
  Products: "bg-blue-50 text-blue-800",
  "Visit Us": "bg-slate-100 text-slate-700",
  Gemology: "bg-[#112c52]/10 text-[#112c52]",
  Orders: "bg-teal-100 text-teal-800",
  Payments: "bg-emerald-100 text-emerald-800",
  Returns: "bg-orange-100 text-orange-800",
};

function FAQCard({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`group relative bg-white rounded-2xl border transition-all duration-300 cursor-pointer
        ${open ? "border-[#112c52] shadow-lg shadow-[#112c52]/10" : "border-slate-200 hover:border-[#112c52]/40 hover:shadow-md hover:shadow-[#112c52]/5"}
      `}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={() => setOpen(!open)}
    >
      {/* Accent line */}
      <div
        className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full transition-all duration-300 ${open ? "bg-[#112c52]" : "bg-transparent group-hover:bg-[#112c52]/30"}`}
      />

      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span
              className={`inline-block text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full mb-2 ${categoryColors[item.category] ?? "bg-slate-100 text-slate-600"}`}
            >
              {item.category}
            </span>
            <p
              className={`font-semibold text-sm leading-snug transition-colors duration-200 ${open ? "text-[#112c52]" : "text-slate-800 group-hover:text-[#112c52]"}`}
            >
              {item.question}
            </p>
          </div>

          {/* Toggle icon */}
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 mt-0.5
              ${open ? "bg-[#112c52] rotate-180" : "bg-slate-100 group-hover:bg-[#112c52]/10"}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-colors duration-300 ${open ? "text-white" : "text-slate-500"}`}
            >
              <path
                d="M2 4L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Answer — pure CSS max-height transition, no JS measurement needed */}
        <div
          style={{
            maxHeight: open ? "600px" : "0px",
            overflow: "hidden",
            transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <p className="text-slate-600 text-sm leading-relaxed pt-3 border-t border-slate-100 mt-3">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FAQSection() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = faqs.filter((f) => {
    const matchCat = activeCategory === "All" || f.category === activeCategory;
    const matchSearch =
      search === "" ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Split into two columns
  const col1 = filtered.filter((_, i) => i % 2 === 0);
  const col2 = filtered.filter((_, i) => i % 2 === 1);

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 font-[system-ui]">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-[#112c52] px-6 py-20 text-center">
        {/* Background decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5 pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/80 text-xs font-medium tracking-wide uppercase">Help Center</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
            Frequently Asked
            <br />
            <span className="text-blue-300">Questions</span>
          </h1>
          <p className="text-white/60 text-base max-w-md mx-auto leading-relaxed">
            Everything you need to know about our gemstones, shipping, payments, and more.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-md mx-auto">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 tracking-wide
                ${activeCategory === cat
                  ? "bg-[#112c52] text-white shadow-md shadow-[#112c52]/20"
                  : "bg-slate-100 text-slate-600 hover:bg-[#112c52]/10 hover:text-[#112c52]"
                }`}
            >
              {cat}
              {cat === "All" && (
                <span className="ml-1.5 opacity-60 font-normal">({faqs.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-slate-500 text-lg font-medium">No results found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Column 1 */}
            <div className="flex flex-col gap-4">
              {col1.map((item, i) => (
                <FAQCard key={item.id} item={item} index={i * 2} />
              ))}
            </div>
            {/* Column 2 */}
            <div className="flex flex-col gap-4">
              {col2.map((item, i) => (
                <FAQCard key={item.id} item={item} index={i * 2 + 1} />
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col items-center gap-3 bg-[#112c52]/5 border border-[#112c52]/10 rounded-2xl px-8 py-6">
            <div className="w-10 h-10 rounded-full bg-[#112c52] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-[#112c52] font-semibold text-sm">Still have questions?</p>
              <p className="text-slate-500 text-xs mt-0.5">Call us at <span className="font-medium text-[#112c52]">914-310-1480</span> or fax <span className="font-medium text-[#112c52]">212-768-0599</span></p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
}