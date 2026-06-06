"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  X,
  Maximize2,
  Minimize2,
  Send,
  Mic,
  MicOff,
  ChevronLeft,
  ChevronRight,
  Award,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  ChevronRight as ArrowRight,
  Layers,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface ProductCard {
  _id: string;
  name: string;
  category: string;
  shape: string;
  size: number;
  color: string;
  clarity: string;
  certification: string;
  price: number;
  images: string[];
  stock: number;
  score?: number;
}

interface CategoryCard {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  productCount?: number;
  parentId?: string;
  parentName?: string;
  parentSlug?: string;
}

interface ComparisonTable {
  attribute: string;
  valueA: string | number;
  valueB: string | number;
  winner: "A" | "B" | "tie";
}

interface ComparisonData {
  productA: ProductCard;
  productB: ProductCard;
  winner: "A" | "B" | "tie";
  reasoning: string;
  table: ComparisonTable[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ProductCard[];
  categories?: CategoryCard[];
  subcategories?: CategoryCard[];
  comparison?: ComparisonData;
  isThinking?: boolean;
  isError?: boolean;
}

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const SUGGESTED = [
  "Show me round diamonds under $5,000",
  "Best GIA certified stones right now",
  "I need an engagement ring stone",
  "What's currently in stock?",
  "What's in stock under 1 carat?",
  "Show me oval cut diamonds",
  "Compare oval vs cushion cut",
];

const SESSION_KEY = "gem_consultant_session_id";

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return crypto.randomUUID();
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/* ─────────────────────────────────────────────
   SSE parser
───────────────────────────────────────────── */
function parseSSELine(line: string): Record<string, unknown> | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────
   Markdown renderer — blue theme
───────────────────────────────────────────── */
const markdownComponents: Components = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  img: () => null,
  strong: ({ children }) => (
    <strong className="font-semibold text-blue-700">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-500" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
      {children}
    </em>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-slate-700">{children}</p>
  ),
  ul: ({ children }) => <ul className="space-y-1.5 my-2 ml-1">{children}</ul>,
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-slate-700">
      <span
        className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
      />
      <span className="flex-1">{children}</span>
    </li>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 my-2 ml-1 list-decimal list-inside">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1 className="text-sm font-bold text-blue-700 mb-2 uppercase tracking-wide">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-bold text-blue-600 mb-1.5 uppercase tracking-wider">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-slate-700 mb-1">{children}</h3>
  ),
  code: ({ children }) => (
    <code className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md font-mono">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="border-l-2 border-blue-300 pl-3 my-2 italic text-slate-500 text-[13px]"
      style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
    >
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 rounded-xl overflow-hidden border border-slate-200">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gradient-to-r from-slate-50 to-blue-50/30">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-slate-100 text-slate-700">{children}</td>
  ),
  a: ({ children }) => (
    <span className="text-blue-600 underline underline-offset-2 cursor-default">{children}</span>
  ),
  hr: () => (
    <div className="my-3 flex items-center gap-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
      <span className="text-blue-300 text-[10px]">◆</span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
    </div>
  ),
};

/* ─────────────────────────────────────────────
   Image with fallback
───────────────────────────────────────────── */
function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40">
        <span className="text-4xl opacity-20">💎</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

function CategoryImage({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <Layers size={22} className="text-blue-300" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

/* ─────────────────────────────────────────────
   Thinking dots — blue
───────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CategoryTile
───────────────────────────────────────────── */
function CategoryTile({
  category,
  onNavigate,
  onAsk,
}: {
  category: CategoryCard;
  onNavigate: (category: CategoryCard) => void;
  onAsk: (name: string) => void;
}) {
  return (
    <div
      className="flex-shrink-0 w-[148px] rounded-2xl overflow-hidden bg-white group cursor-pointer transition-all duration-200"
      style={{
        border: "1px solid rgba(59,130,246,0.15)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.5)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(29,78,216,0.14)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.15)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
      }}
    >
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
        <CategoryImage src={category.image} alt={category.name} />
        {category.productCount !== undefined && (
          <div
            className="absolute top-2 left-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
          >
            {category.productCount} items
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-2">
        <p
          className="text-slate-800 text-[11px] font-semibold leading-snug line-clamp-2"
          style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
        >
          {category.name}
        </p>
        {category.description && (
          <p className="text-[9px] text-slate-400 line-clamp-2 leading-relaxed">
            {category.description}
          </p>
        )}
        <div className="flex gap-1 pt-0.5">
          <button
            onClick={() => onNavigate(category)}
            className="flex-1 flex items-center justify-center gap-0.5 text-[9px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 rounded-lg py-1 transition-colors"
          >
            <ExternalLink size={8} />
            Browse
          </button>
          <button
            onClick={() => onAsk(category.name)}
            className="flex-1 flex items-center justify-center gap-0.5 text-[9px] font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 rounded-lg py-1 transition-colors"
          >
            <ArrowRight size={8} />
            Explore
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Scroll Carousel
───────────────────────────────────────────── */
function ScrollCarousel({ children, count }: { children: React.ReactNode; count: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "right" ? 165 : -165, behavior: "smooth" });

  return (
    <div className="mt-3 relative">
      {count > 2 && (
        <>
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-[calc(50%-16px)] z-10 w-6 h-6 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full flex items-center justify-center shadow hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft size={11} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-[calc(50%-16px)] z-10 w-6 h-6 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full flex items-center justify-center shadow hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <ChevronRight size={11} />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto py-1"
        style={{
          scrollbarWidth: "none",
          paddingLeft: count > 2 ? "1.5rem" : "0",
          paddingRight: count > 2 ? "1.5rem" : "0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   GemCard
───────────────────────────────────────────── */
function GemCard({
  product,
  onNavigate,
}: {
  product: ProductCard;
  onNavigate: (id: string) => void;
}) {
  const img = product.images?.[0];
  const certColors: Record<string, string> = {
    GIA: "bg-blue-50 text-blue-700 border-blue-200",
    AGS: "bg-violet-50 text-violet-700 border-violet-200",
    IGI: "bg-emerald-50 text-emerald-700 border-emerald-200",
    GCAL: "bg-rose-50 text-rose-700 border-rose-200",
    EGL: "bg-sky-50 text-sky-700 border-sky-200",
    HRD: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  const certClass = certColors[product.certification] ?? "bg-gray-50 text-gray-500 border-gray-200";

  return (
    <div
      onClick={() => onNavigate(product._id)}
      className="flex-shrink-0 w-[168px] rounded-2xl overflow-hidden bg-white group cursor-pointer transition-all duration-200"
      style={{
        border: "1px solid rgba(59,130,246,0.15)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.5)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(29,78,216,0.14)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.15)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
      }}
      title={`View ${product.name}`}
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
        <ProductImage src={img} alt={product.name} />
        {product.score !== undefined && (
          <div
            className="absolute top-2 right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
          >
            {product.score}%
          </div>
        )}
        <div className="absolute inset-0 bg-blue-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
          <div className="flex items-center gap-1 text-white text-[10px] font-semibold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/30">
            <ExternalLink size={9} />
            View
          </div>
        </div>
      </div>

      <div className="p-2.5 space-y-1.5">
        <p className="text-slate-800 text-[11px] font-semibold leading-snug line-clamp-2">
          {product.name}
        </p>
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.5 rounded-full font-semibold">
            {product.size}ct
          </span>
          {product.shape && (
            <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-200/70 px-1.5 py-0.5 rounded-full capitalize">
              {product.shape}
            </span>
          )}
          {product.color && product.clarity && (
            <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-200/70 px-1.5 py-0.5 rounded-full">
              {product.color}/{product.clarity}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span
            className="text-sm font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ${product.price.toLocaleString()}
          </span>
          {product.certification && product.certification !== "none" && (
            <span className={`flex items-center gap-0.5 text-[9px] border px-1.5 py-0.5 rounded-full font-semibold ${certClass}`}>
              <Award size={8} />
              {product.certification}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ComparisonView
───────────────────────────────────────────── */
function ComparisonView({ data }: { data: ComparisonData }) {
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-blue-100 text-xs bg-white">
      <div
        className="grid grid-cols-3 text-[9px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-100"
        style={{ background: "linear-gradient(135deg, #fafafa, #eff6ff)" }}
      >
        <div className="p-2.5 border-r border-slate-100" />
        <div className="p-2.5 border-r border-slate-100 text-center text-blue-700 truncate">{data.productA.name}</div>
        <div className="p-2.5 text-center text-blue-700 truncate">{data.productB.name}</div>
      </div>
      {data.table.map((row, i) => (
        <div key={i} className="grid grid-cols-3 border-t border-slate-100 hover:bg-blue-50/20 transition-colors">
          <div className="p-2 text-slate-400 border-r border-slate-100 text-[10px] font-medium">{row.attribute}</div>
          <div className={`p-2 text-center border-r border-slate-100 font-semibold ${row.winner === "A" ? "text-blue-700" : "text-slate-400"}`}>
            {String(row.valueA)}
          </div>
          <div className={`p-2 text-center font-semibold ${row.winner === "B" ? "text-blue-700" : "text-slate-400"}`}>
            {String(row.valueB)}
          </div>
        </div>
      ))}
      <div
        className="p-3 border-t border-blue-100 text-[11px] leading-relaxed text-blue-800/70 italic"
        style={{
          background: "linear-gradient(135deg, #f0f7ff, #eff6ff)",
          fontFamily: "'DM Serif Display', Georgia, serif",
        }}
      >
        {data.reasoning}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MessageBubble
───────────────────────────────────────────── */
function MessageBubble({
  msg,
  onNavigateProduct,
  onNavigateCategory,
  onAskAboutCategory,
}: {
  msg: ChatMessage;
  onNavigateProduct: (id: string) => void;
  onNavigateCategory: (category: CategoryCard) => void;
  onAskAboutCategory: (name: string) => void;
}) {
  if (msg.isThinking) {
    return (
      <div className="flex items-start gap-2.5">
        <AvatarIcon />
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-200 bg-white">
          <ThinkingDots />
        </div>
      </div>
    );
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
          style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)" }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.isError) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 bg-red-400">
          <AlertCircle size={12} />
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-red-600 leading-relaxed border border-red-100 bg-red-50">
          {msg.content}
        </div>
      </div>
    );
  }

  const hasCategories = (msg.categories?.length ?? 0) > 0;
  const hasSubcategories = (msg.subcategories?.length ?? 0) > 0;
  const hasProducts = (msg.products?.length ?? 0) > 0;

  return (
    <div className="flex items-start gap-2.5">
      <AvatarIcon />
      <div className="flex-1 min-w-0">
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm border"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
            borderColor: "rgba(59,130,246,0.15)",
            fontFamily: "'DM Serif Display', Georgia, serif",
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {msg.content}
          </ReactMarkdown>
        </div>

        {hasCategories && (
          <>
            <p className="text-[9px] text-slate-400 uppercase tracking-[0.14em] font-semibold mt-3 mb-1 px-0.5">
              Categories
            </p>
            <ScrollCarousel count={msg.categories!.length}>
              {msg.categories!.map((cat) => (
                <CategoryTile
                  key={cat._id}
                  category={cat}
                  onNavigate={onNavigateCategory}
                  onAsk={onAskAboutCategory}
                />
              ))}
            </ScrollCarousel>
          </>
        )}

        {hasSubcategories && (
          <>
            <p className="text-[9px] text-slate-400 uppercase tracking-[0.14em] font-semibold mt-3 mb-1 px-0.5">
              {msg.subcategories![0]?.parentName
                ? `${msg.subcategories![0].parentName} › Subcategories`
                : "Subcategories"}
            </p>
            <ScrollCarousel count={msg.subcategories!.length}>
              {msg.subcategories!.map((sub) => (
                <CategoryTile
                  key={sub._id}
                  category={sub}
                  onNavigate={onNavigateCategory}
                  onAsk={onAskAboutCategory}
                />
              ))}
            </ScrollCarousel>
            <p className="text-[9px] text-slate-400 text-center mt-1.5 tracking-wide">
              Tap <span className="text-blue-600">Browse</span> to open · <span className="text-slate-500">Explore</span> to ask Victoria
            </p>
          </>
        )}

        {hasProducts && (
          <>
            <ScrollCarousel count={msg.products!.length}>
              {msg.products!.map((p) => (
                <GemCard key={p._id} product={p} onNavigate={onNavigateProduct} />
              ))}
            </ScrollCarousel>
            <p className="text-[9px] text-slate-400 text-center mt-1.5 tracking-wide">
              Tap any card to view full details
            </p>
          </>
        )}

        {msg.comparison && <ComparisonView data={msg.comparison} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Avatar — blue gradient
───────────────────────────────────────────── */
function AvatarIcon() {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5"
      style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}
    >
      <Sparkles size={12} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Suggested questions
───────────────────────────────────────────── */
function SuggestedQuestions({
  onSelect,
  isLoading,
}: {
  onSelect: (q: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-slate-400 uppercase tracking-[0.15em] font-semibold px-0.5">
        Try asking
      </p>
      {SUGGESTED.map((q, i) => (
        <motion.button
          key={q}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.04 + i * 0.04 }}
          onClick={() => onSelect(q)}
          disabled={isLoading}
          className="flex items-center gap-2.5 w-full text-left text-xs text-slate-500 bg-white/80 rounded-xl px-3 py-2 hover:bg-blue-50 hover:text-blue-800 transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ border: "1px solid rgba(59,130,246,0.12)" }}
        >
          <span
            className="w-1 h-1 rounded-full flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
            style={{ background: "#3b82f6" }}
          />
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>{q}</span>
        </motion.button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAB Orbital rings — blue theme
───────────────────────────────────────────── */
function OrbitalRings() {
  return (
    <>
      {/* Glow halo */}
      <span
        className="absolute inset-[-6px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
        }}
      />
      {/* Ring 1 — slow spin with orb */}
      <motion.span
        className="absolute inset-[-10px] rounded-full pointer-events-none"
        style={{
          border: "1px solid rgba(59,130,246,0.4)",
          boxShadow: "inset 0 0 8px rgba(59,130,246,0.08)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{ background: "linear-gradient(135deg, #93c5fd, #3b82f6)" }}
        />
      </motion.span>
      {/* Ring 2 — counter-spin dashed */}
      <motion.span
        className="absolute inset-[-18px] rounded-full pointer-events-none"
        style={{ border: "1px dashed rgba(147,197,253,0.25)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute bottom-0 right-1/4 w-1 h-1 rounded-full"
          style={{ background: "rgba(96,165,250,0.55)" }}
        />
      </motion.span>
      {/* Ripple pulse 1 */}
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: "rgba(59,130,246,0.15)" }}
        animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
      />
      {/* Ripple pulse 2 */}
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: "rgba(59,130,246,0.1)" }}
        animate={{ scale: [1, 2.3], opacity: [0.4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.55 }}
      />
    </>
  );
}

/* ─────────────────────────────────────────────
   Diamond SVG icon
───────────────────────────────────────────── */
function GemFacetIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L7 8H17L12 2Z" fill="rgba(255,255,255,0.95)" />
      <path d="M7 8L2 8L6 14L12 8H7Z" fill="rgba(255,255,255,0.7)" />
      <path d="M17 8H22L18 14L12 8H17Z" fill="rgba(255,255,255,0.82)" />
      <path d="M6 14L12 22L12 14H6Z" fill="rgba(255,255,255,0.6)" />
      <path d="M18 14L12 22L12 14H18Z" fill="rgba(255,255,255,0.75)" />
      <path d="M12 14H6L12 22L18 14H12Z" fill="rgba(255,255,255,0.55)" />
      <path d="M7 8L12 8L12 14L6 14Z" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   FAB Tooltip — dark slate, blue accents
───────────────────────────────────────────── */
function FabTooltip() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 12, scale: 0.92 }}
      transition={{ delay: 2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-[72px] top-1/2 -translate-y-1/2 pointer-events-none"
    >
      <div className="relative flex flex-col items-end">
        {/* Pill */}
        <div
          className="flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            border: "1px solid rgba(59,130,246,0.28)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 0 0 1px rgba(59,130,246,0.07), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Animated dots */}
          <div className="flex gap-[3px] items-center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-[3px] h-[3px] rounded-full"
                style={{ background: "#60a5fa" }}
                animate={{ opacity: [0.3, 1, 0.3], scaleY: [0.6, 1.4, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
              />
            ))}
          </div>

          {/* Label */}
          <span
            className="text-[11px] font-semibold tracking-wide"
            style={{
              background: "linear-gradient(90deg, #e0f2fe, #93c5fd, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "'DM Serif Display', Georgia, serif",
            }}
          >
            Ask Victoria
          </span>

          {/* AI badge */}
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-widest"
            style={{
              background: "rgba(59,130,246,0.14)",
              color: "rgba(147,197,253,0.85)",
              border: "1px solid rgba(59,130,246,0.22)",
              letterSpacing: "0.12em",
            }}
          >
            AI
          </span>
        </div>

        {/* Caret */}
        <div
          className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0"
          style={{
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "6px solid rgba(59,130,246,0.28)",
          }}
        />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Live badge dot (green on blue)
───────────────────────────────────────────── */
function LiveBadgeDot({ borderColor = "#1d4ed8" }: { borderColor?: string }) {
  return (
    <motion.div
      className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full"
      style={{ border: `1.5px solid ${borderColor}` }}
      animate={{ boxShadow: ["0 0 0 0px rgba(52,211,153,0.4)", "0 0 0 4px rgba(52,211,153,0)"] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function GemConsultant() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionId] = useState<string>(() => getSessionId());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const handleNavigateToProduct = useCallback(
    (productId: string) => {
      router.push(`/products/${productId}`);
      setIsOpen(false);
    },
    [router]
  );

  const handleNavigateToCategory = useCallback(
    (category: CategoryCard) => {
      if (category.parentId) {
        const parentSlug = category.parentSlug ?? category.parentId;
        router.push(`/products?category=${parentSlug}&subcategory=${category.slug}`);
      } else {
        router.push(`/category/${category.slug}`);
      }
      setIsOpen(false);
    },
    [router]
  );

  const handleAskAboutCategory = useCallback(
    (name: string) => {
      sendMessage(`Show me ${name}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setShowSuggestions(false);

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      const thinkingMsg: ChatMessage = { id: "thinking", role: "assistant", content: "", isThinking: true };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: trimmed }),
        });

        if (!res.ok) {
          let errMsg = "Something went wrong. Please try again.";
          try {
            const errBody = await res.json();
            if (errBody.error) errMsg = errBody.error;
          } catch { /**/ }
          throw new Error(errMsg);
        }

        if (!res.body) throw new Error("No response body received.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalMsg: ChatMessage | null = null;

        const processLine = (line: string) => {
          const event = parseSSELine(line);
          if (!event) return;
          if (event.type === "response") {
            finalMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: (event.message as string) ?? "",
              products: event.products as ProductCard[] | undefined,
              categories: event.categories as CategoryCard[] | undefined,
              subcategories: event.subcategories as CategoryCard[] | undefined,
              comparison: event.comparison as ComparisonData | undefined,
            };
          } else if (event.type === "error") {
            finalMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: (event.message as string) ?? "An error occurred.",
              isError: true,
            };
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) buffer.split("\n").forEach((l) => processLine(l.trim()));
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) part.split("\n").forEach((l) => processLine(l.trim()));
        }

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== "thinking");
          return finalMsg
            ? [...filtered, finalMsg]
            : [
                ...filtered,
                {
                  id: crypto.randomUUID(),
                  role: "assistant" as const,
                  content: "I didn't receive a response. Please try again.",
                  isError: true,
                },
              ];
        });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== "thinking"),
          { id: crypto.randomUUID(), role: "assistant" as const, content: errMessage, isError: true },
        ]);
      } finally {
        setIsLoading(false);
        textareaRef.current?.focus();
      }
    },
    [isLoading, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) =>
      setInput((p: string) => p + (p ? " " : "") + e.results[0][0].transcript);
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  const hasMessages = messages.length > 0;

  const panelClass = isFullscreen
    ? "fixed inset-0 z-[9999] flex flex-col"
    : "fixed bottom-24 right-5 z-[9999] w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] flex flex-col rounded-3xl overflow-hidden";

  return (
    <>
      {/* ── FAB ── */}
      <div className="fixed bottom-5 right-5 z-[9998]" style={{ isolation: "isolate" }}>

        {/* Tooltip */}
        <AnimatePresence>
          {!isOpen && <FabTooltip />}
        </AnimatePresence>

        {/* FAB button */}
        <motion.button
          onClick={() => setIsOpen((v) => !v)}
          className="relative w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: isOpen
              ? "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)"
              : "linear-gradient(150deg, #1d4ed8 0%, #1e40af 100%)",
            boxShadow: isOpen
              ? "0 4px 20px rgba(29,78,216,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
              : "0 12px 40px rgba(29,78,216,0.45), 0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
            border: "1px solid rgba(147,197,253,0.25)",
          }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          aria-label="Open Gem Consultant"
        >
          {/* Orbital rings — only when closed */}
          {!isOpen && <OrbitalRings />}

          {/* Conic shimmer rim */}
          {!isOpen && (
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(147,197,253,0.45) 0deg, transparent 60deg, transparent 180deg, rgba(96,165,250,0.3) 240deg, transparent 300deg)",
              }}
            />
          )}

          {/* Live dot */}
          <LiveBadgeDot borderColor={isOpen ? "#1e40af" : "#1d4ed8"} />

          {/* Icon */}
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.span
                key="close"
                className="relative z-10 text-blue-200"
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <X size={18} strokeWidth={1.5} />
              </motion.span>
            ) : (
              <motion.span
                key="gem"
                className="relative z-10"
                initial={{ rotate: 30, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -30, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <GemFacetIcon size={22} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="gem-panel"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className={panelClass}
            style={{
              background: "#f8faff",
              boxShadow: "0 32px 80px rgba(29,78,216,0.12), 0 4px 16px rgba(0,0,0,0.07)",
              border: "1px solid rgba(59,130,246,0.18)",
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)",
                borderColor: "rgba(59,130,246,0.12)",
              }}
            >
              <div className="flex items-center gap-2.5">
                {hasMessages && (
                  <motion.button
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => { setMessages([]); setShowSuggestions(false); }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50/60 transition-colors"
                    title="New conversation"
                  >
                    <ArrowLeft size={14} />
                  </motion.button>
                )}
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                    style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}
                  >
                    <Sparkles size={13} />
                  </div>
                  <LiveBadgeDot borderColor="white" />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold text-slate-800 leading-none"
                    style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
                  >
                    Victoria
                  </p>
                  <p className="text-[9px] text-blue-500/80 uppercase tracking-[0.14em] mt-0.5 font-medium">
                    AI Gem Consultant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Model badge */}
                <div
                  className="hidden sm:flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-full"
                  style={{
                    background: "rgba(59,130,246,0.08)",
                    color: "#1d4ed8",
                    border: "1px solid rgba(59,130,246,0.2)",
                  }}
                >
                  <motion.span
                    className="w-1 h-1 rounded-full bg-blue-400"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  GPT-4o
                </div>
                <button
                  onClick={() => setIsFullscreen((v) => !v)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              style={{ background: "#eef3fc" }}
            >
              {/* Welcome screen */}
              {!hasMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4"
                >
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "linear-gradient(135deg, #fff 0%, #f0f7ff 100%)",
                      border: "1px solid rgba(59,130,246,0.15)",
                    }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                      >
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.14em] mb-1.5">
                          Victoria · AI Gem Consultant
                        </p>
                        <p
                          className="text-sm text-slate-600 leading-relaxed"
                          style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
                        >
                          Good day. I&apos;m Victoria — your personal gemologist at GMStone.
                          Whether you seek the perfect engagement diamond, a rare coloured stone, or
                          expert guidance on value, I&apos;m at your service.
                        </p>
                      </div>
                    </div>
                    <div className="ml-11 flex items-center gap-1.5">
                      <div className="flex -space-x-1">
                        {["💎", "💍", "✨"].map((e, i) => (
                          <span
                            key={i}
                            className="w-5 h-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[9px]"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                      <p
                        className="text-[10px] text-slate-400 italic"
                        style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
                      >
                        Every recommendation drawn from live inventory
                      </p>
                    </div>
                  </div>
                  <SuggestedQuestions onSelect={sendMessage} isLoading={isLoading} />
                </motion.div>
              )}

              {/* Conversation messages */}
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i === messages.length - 1 ? 0 : 0 }}
                >
                  <MessageBubble
                    msg={msg}
                    onNavigateProduct={handleNavigateToProduct}
                    onNavigateCategory={handleNavigateToCategory}
                    onAskAboutCategory={handleAskAboutCategory}
                  />
                </motion.div>
              ))}

              {/* Show suggestions toggle */}
              {hasMessages && !isLoading && !showSuggestions && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowSuggestions(true)}
                  className="text-[9px] text-slate-400 hover:text-blue-500 block mx-auto transition-colors tracking-wide"
                >
                  ◆ show suggestions
                </motion.button>
              )}

              {/* Inline suggestions panel */}
              <AnimatePresence>
                {showSuggestions && hasMessages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] text-slate-400 uppercase tracking-[0.15em] font-semibold">
                          Suggestions
                        </p>
                        <button
                          onClick={() => setShowSuggestions(false)}
                          className="text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <SuggestedQuestions
                        onSelect={(q) => { setShowSuggestions(false); sendMessage(q); }}
                        isLoading={isLoading}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div
              className="px-3 pb-3 pt-2 flex-shrink-0 border-t"
              style={{ background: "#ffffff", borderColor: "rgba(59,130,246,0.1)" }}
            >
              <div
                className="flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all focus-within:border-blue-300 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                style={{ background: "#f8faff", borderColor: "rgba(59,130,246,0.12)" }}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about gemstones, categories, pricing…"
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-300 resize-none outline-none leading-relaxed disabled:opacity-50"
                  style={{
                    maxHeight: 120,
                    minHeight: 22,
                    fontFamily: "'DM Serif Display', Georgia, serif",
                  }}
                />
                <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                  <motion.button
                    onClick={toggleVoice}
                    whileTap={{ scale: 0.9 }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isListening
                        ? "text-blue-500 bg-blue-50"
                        : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </motion.button>
                  <motion.button
                    onClick={() => sendMessage(input)}
                    disabled={isLoading || !input.trim()}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                  >
                    <Send size={14} />
                  </motion.button>
                </div>
              </div>
              <p className="text-[8px] text-slate-300 text-center mt-1 tracking-wider">
                ↵ send · ⇧↵ new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}