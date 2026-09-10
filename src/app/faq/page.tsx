"use client";

import { useState } from "react";
import FooterPageLayout from '@/components/footer-pages/footer-page-layout';
import { faqs, type FAQItem } from "./faq-data";

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
    <FooterPageLayout title="faq">
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
    </FooterPageLayout>
    
  );
}