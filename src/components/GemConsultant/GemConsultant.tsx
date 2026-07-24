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
   Design tokens — "Atelier" theme
   Ivory paper, graphite ink, antique-gold accent.
   One jewel color per certification, kept muted.
───────────────────────────────────────────── */
const T = {
  ivory: "#FBF9F5",
  paper: "#FFFFFF",
  graphite: "#211E1B",
  stone: "#7A7268",
  stoneLight: "#A79E92",
  hairline: "#E9E2D5",
  hairlineSoft: "#F1ECE3",
  gold: "#B4914F",
  goldDeep: "#8A6A32",
  goldPale: "#F3E9D3",
  blush: "#F6EEE6",
};

const goldGradient = `linear-gradient(135deg, ${T.gold} 0%, ${T.goldDeep} 100%)`;
const inkGradient = `linear-gradient(135deg, #001d90 0%, #001d90 100%)`;

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
  isStreaming?: boolean;
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
   Markdown renderer — ivory & gold theme
───────────────────────────────────────────── */
const markdownComponents: Components = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  img: () => null,
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: T.goldDeep }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={{ color: T.stone, fontFamily: '"Elms Sans", sans-serif' }}>
      {children}
    </em>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed" style={{ color: T.graphite }}>
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="space-y-1.5 my-2 ml-1">{children}</ul>,
  li: ({ children }) => (
    <li className="flex items-start gap-2" style={{ color: T.graphite }}>
      <span
        className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0"
        style={{ background: T.gold }}
      />
      <span className="flex-1">{children}</span>
    </li>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 my-2 ml-1 list-decimal list-inside">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1
      className="text-sm font-bold mb-2 uppercase tracking-wide"
      style={{ color: T.goldDeep }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: T.gold }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold mb-1" style={{ color: T.graphite }}>
      {children}
    </h3>
  ),
  code: ({ children }) => (
    <code
      className="text-[11px] px-1.5 py-0.5 rounded-md font-mono border"
      style={{ background: T.goldPale, color: T.goldDeep, borderColor: T.hairline }}
    >
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="border-l-2 pl-3 my-2 italic text-[13px]"
      style={{ borderColor: T.gold, color: T.stone, fontFamily: '"Elms Sans", sans-serif' }}
    >
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 rounded-xl overflow-hidden border" style={{ borderColor: T.hairline }}>
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: T.hairlineSoft }}>{children}</thead>
  ),
  th: ({ children }) => (
    <th
      className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-[10px] border-b"
      style={{ color: T.stoneLight, borderColor: T.hairline }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b" style={{ borderColor: T.hairlineSoft, color: T.graphite }}>
      {children}
    </td>
  ),
  a: ({ children }) => (
    <span className="underline underline-offset-2 cursor-default" style={{ color: T.goldDeep }}>
      {children}
    </span>
  ),
  hr: () => (
    <div className="my-3 flex items-center gap-2">
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${T.hairline}, transparent)` }} />
      <span className="text-[10px]" style={{ color: T.gold }}>◆</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${T.hairline}, transparent)` }} />
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
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${T.ivory}, ${T.blush})` }}
      >
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
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${T.blush}, ${T.hairlineSoft})` }}
      >
        <Layers size={22} style={{ color: T.gold }} />
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
   Thinking dots — gold
───────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: T.gold }}
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
        border: `1px solid ${T.hairline}`,
        boxShadow: "0 2px 14px rgba(33,30,27,0.05)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.gold;
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 26px rgba(138,106,50,0.16)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.hairline;
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 14px rgba(33,30,27,0.05)";
      }}
    >
      <div className="relative h-28 overflow-hidden" style={{ background: T.ivory }}>
        <CategoryImage src={category.image} alt={category.name} />
        {category.productCount !== undefined && (
          <div
            className="absolute top-2 left-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10"
            style={{ background: inkGradient }}
          >
            {category.productCount} items
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-2">
        <p
          className="text-[11px] font-semibold leading-snug line-clamp-2"
          style={{ color: T.graphite, fontFamily: '"Elms Sans", sans-serif' }}
        >
          {category.name}
        </p>
        {category.description && (
          <p className="text-[9px] line-clamp-2 leading-relaxed" style={{ color: T.stoneLight }}>
            {category.description}
          </p>
        )}
        <div className="flex gap-1 pt-0.5">
          <button
            onClick={() => onNavigate(category)}
            className="flex-1 flex items-center justify-center gap-0.5 text-[9px] font-semibold rounded-lg py-1 transition-colors"
            style={{ color: T.goldDeep, background: T.goldPale, border: `1px solid ${T.hairline}` }}
          >
            <ExternalLink size={8} />
            Browse
          </button>
          <button
            onClick={() => onAsk(category.name)}
            className="flex-1 flex items-center justify-center gap-0.5 text-[9px] font-semibold rounded-lg py-1 transition-colors"
            style={{ color: T.stone, background: T.hairlineSoft, border: `1px solid ${T.hairline}` }}
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
            className="absolute left-0 top-[calc(50%-16px)] z-10 w-6 h-6 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow transition-colors"
            style={{ border: `1px solid ${T.hairline}`, color: T.stone }}
          >
            <ChevronLeft size={11} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-[calc(50%-16px)] z-10 w-6 h-6 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow transition-colors"
            style={{ border: `1px solid ${T.hairline}`, color: T.stone }}
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
  // Muted jewel tones for certification chips — desaturated, editorial.
  const certColors: Record<string, { bg: string; fg: string; bd: string }> = {
    GIA: { bg: "#F3E9D3", fg: T.goldDeep, bd: T.hairline },
    AGS: { bg: "#EFE8F1", fg: "#6B4E77", bd: "#E1D3E5" },
    IGI: { bg: "#E7EFE7", fg: "#4C6B4E", bd: "#D6E4D6" },
    GCAL: { bg: "#F3E4E1", fg: "#93534A", bd: "#E8D3CE" },
    EGL: { bg: "#E4EDEF", fg: "#4C6E76", bd: "#D3E2E5" },
    HRD: { bg: "#E9E7F1", fg: "#5A5488", bd: "#DAD6E9" },
  };
  const cert = certColors[product.certification] ?? { bg: "#F1EFEC", fg: T.stone, bd: T.hairline };

  return (
    <div
      onClick={() => onNavigate(product._id)}
      className="flex-shrink-0 w-[168px] rounded-2xl overflow-hidden bg-white group cursor-pointer transition-all duration-200"
      style={{
        border: `1px solid ${T.hairline}`,
        boxShadow: "0 2px 14px rgba(33,30,27,0.05)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.gold;
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 26px rgba(138,106,50,0.16)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.hairline;
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 14px rgba(33,30,27,0.05)";
      }}
      title={`View ${product.name}`}
    >
      <div className="relative h-36 overflow-hidden" style={{ background: T.ivory }}>
        <ProductImage src={img} alt={product.name} />
        {product.score !== undefined && (
          <div
            className="absolute top-2 right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10"
            style={{ background: goldGradient }}
          >
            {product.score}%
          </div>
        )}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10"
          style={{ background: "rgba(26,24,21,0.38)" }}
        >
          <div className="flex items-center gap-1 text-white text-[10px] font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/25">
            <ExternalLink size={9} />
            View
          </div>
        </div>
      </div>

      <div className="p-2.5 space-y-1.5">
        <p className="text-[11px] font-semibold leading-snug line-clamp-2" style={{ color: T.graphite }}>
          {product.name}
        </p>
        <div className="flex flex-wrap gap-1">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: T.goldPale, color: T.goldDeep, border: `1px solid ${T.hairline}` }}
          >
            {product.size}ct
          </span>
          {product.shape && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full capitalize"
              style={{ background: T.hairlineSoft, color: T.stone, border: `1px solid ${T.hairline}` }}
            >
              {product.shape}
            </span>
          )}
          {product.color && product.clarity && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: T.hairlineSoft, color: T.stone, border: `1px solid ${T.hairline}` }}
            >
              {product.color}/{product.clarity}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: T.graphite, fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            ${product.price.toLocaleString()}
          </span>
          {product.certification && product.certification !== "none" && (
            <span
              className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: cert.bg, color: cert.fg, border: `1px solid ${cert.bd}` }}
            >
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
    <div
      className="mt-3 rounded-2xl overflow-hidden text-xs bg-white"
      style={{ border: `1px solid ${T.hairline}` }}
    >
      <div
        className="grid grid-cols-3 text-[9px] uppercase tracking-wider font-bold border-b"
        style={{ background: T.blush, borderColor: T.hairline, color: T.stoneLight }}
      >
        <div className="p-2.5 border-r" style={{ borderColor: T.hairline }} />
        <div
          className="p-2.5 border-r text-center truncate"
          style={{ borderColor: T.hairline, color: T.goldDeep }}
        >
          {data.productA.name}
        </div>
        <div className="p-2.5 text-center truncate" style={{ color: T.goldDeep }}>
          {data.productB.name}
        </div>
      </div>
      {data.table.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-3 border-t transition-colors"
          style={{ borderColor: T.hairlineSoft }}
        >
          <div
            className="p-2 border-r text-[10px] font-medium"
            style={{ borderColor: T.hairlineSoft, color: T.stoneLight }}
          >
            {row.attribute}
          </div>
          <div
            className="p-2 text-center border-r font-semibold"
            style={{
              borderColor: T.hairlineSoft,
              color: row.winner === "A" ? T.goldDeep : T.stoneLight,
            }}
          >
            {String(row.valueA)}
          </div>
          <div
            className="p-2 text-center font-semibold"
            style={{ color: row.winner === "B" ? T.goldDeep : T.stoneLight }}
          >
            {String(row.valueB)}
          </div>
        </div>
      ))}
      <div
        className="p-3 border-t text-[11px] leading-relaxed italic"
        style={{
          background: T.blush,
          borderColor: T.hairline,
          color: T.stone,
          fontFamily: '"Elms Sans", sans-serif',
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
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white"
          style={{ border: `1px solid ${T.hairline}` }}
        >
          <ThinkingDots />
        </div>
      </div>
    );
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] text-[#F6EEE6] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
          style={{ background: inkGradient }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.isError) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 bg-[#B25A4E]">
          <AlertCircle size={12} />
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
          style={{ color: "#93534A", border: "1px solid #E8D3CE", background: "#F8EEEC" }}
        >
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
            background: T.paper,
            borderColor: T.hairline,
            fontFamily: '"Elms Sans", sans-serif',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {msg.content}
          </ReactMarkdown>
          {msg.isStreaming && (
            <motion.span
              className="inline-block w-[2px] h-[13px] align-middle ml-0.5"
              style={{ background: T.gold }}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        {hasCategories && (
          <>
            <p
              className="text-[9px] uppercase tracking-[0.14em] font-semibold mt-3 mb-1 px-0.5"
              style={{ color: T.stoneLight }}
            >
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
            <p
              className="text-[9px] uppercase tracking-[0.14em] font-semibold mt-3 mb-1 px-0.5"
              style={{ color: T.stoneLight }}
            >
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
            <p className="text-[9px] text-center mt-1.5 tracking-wide" style={{ color: T.stoneLight }}>
              Tap <span style={{ color: T.goldDeep }}>Browse</span> to open ·{" "}
              <span style={{ color: T.stone }}>Explore</span> to ask Victoria
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
            <p className="text-[9px] text-center mt-1.5 tracking-wide" style={{ color: T.stoneLight }}>
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
   Avatar — gold gradient
───────────────────────────────────────────── */
function AvatarIcon() {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5"
      style={{ background: goldGradient }}
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
      <p className="text-[9px] uppercase tracking-[0.15em] font-semibold px-0.5" style={{ color: T.stoneLight }}>
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
          className="flex items-center gap-2.5 w-full text-left text-xs bg-white rounded-xl px-3 py-2 transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ border: `1px solid ${T.hairline}`, color: T.stone }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = T.blush;
            (e.currentTarget as HTMLButtonElement).style.color = T.goldDeep;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = T.paper;
            (e.currentTarget as HTMLButtonElement).style.color = T.stone;
          }}
        >
          <span
            className="w-1 h-1 rounded-full flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
            style={{ background: T.gold }}
          />
          <span style={{ fontFamily: '"Elms Sans", sans-serif' }}>{q}</span>
        </motion.button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAB halo — one restrained pulse, not a swarm of rings
───────────────────────────────────────────── */
function FabHalo() {
  return (
    <>
      <span
        className="absolute inset-[-7px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(180,145,79,0.22) 0%, transparent 72%)" }}
      />
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: "rgba(180,145,79,0.16)" }}
        animate={{ scale: [1, 1.85], opacity: [0.5, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
      />
    </>
  );
}

/* ─────────────────────────────────────────────
   Diamond SVG icon — warm gold facets
───────────────────────────────────────────── */
function GemFacetIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L7 8H17L12 2Z" fill="rgba(255,255,255,0.97)" />
      <path d="M7 8L2 8L6 14L12 8H7Z" fill="rgba(255,255,255,0.78)" />
      <path d="M17 8H22L18 14L12 8H17Z" fill="rgba(255,255,255,0.88)" />
      <path d="M6 14L12 22L12 14H6Z" fill="rgba(255,255,255,0.66)" />
      <path d="M18 14L12 22L12 14H18Z" fill="rgba(255,255,255,0.8)" />
      <path d="M12 14H6L12 22L18 14H12Z" fill="rgba(255,255,255,0.6)" />
      <path d="M7 8L12 8L12 14L6 14Z" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   FAB Tooltip — ink & gold
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   FAB Tooltip — compact pill above the button
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   FAB Tooltip — compact pill, left of the button
───────────────────────────────────────────── */
function FabTooltip() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 8, scale: 0.92 }}
      transition={{ delay: 2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="hidden sm:block absolute right-full top-2/3 -translate-y-1/2 mr-3 pointer-events-none"
    >
      <div className="relative">
        <div
          className="flex items-center gap-1.5 whitespace-nowrap pl-2.5 pr-3 py-1.5 rounded-full"
          style={{
            background: inkGradient,
            border: "1px solid rgba(92,163,255,0.35)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
          }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "#5ca3ff" }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <span
            className="text-[11px] font-medium"
            style={{ color: "#EAF2FF", fontFamily: '"Elms Sans", sans-serif' }}
          >
            Ask Victoria
          </span>
        </div>

        <div
          className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0"
          style={{
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "5px solid #0b174a",
          }}
        />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Live badge dot
───────────────────────────────────────────── */
function LiveBadgeDot({ borderColor = "#1A1815" }: { borderColor?: string }) {
  return (
    <motion.div
      className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full"
      style={{ border: `1.5px solid ${borderColor}` }}
      animate={{ boxShadow: ["0 0 0 0px rgba(16,185,129,0.35)", "0 0 0 4px rgba(16,185,129,0)"] }}
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

        // Live-streamed text accumulates here so the person sees Victoria's
        // answer appear token-by-token instead of staring at a spinner
        // until the entire multi-step tool-calling turn finishes.
        let streamingText = "";
        let hasStreamed = false;

        const processLine = (line: string) => {
          const event = parseSSELine(line);
          if (!event) return;

          if (event.type === "delta") {
            const chunk = (event.text as string) ?? "";
            if (!chunk) return;
            streamingText += chunk;
            if (!hasStreamed) {
              hasStreamed = true;
              setMessages((prev) => [
                ...prev.filter((m) => m.id !== "thinking" && m.id !== "streaming"),
                { id: "streaming", role: "assistant", content: streamingText, isStreaming: true },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === "streaming" ? { ...m, content: streamingText } : m))
              );
            }
          } else if (event.type === "tool_call") {
            // Victoria is looking things up (e.g. querying live inventory).
            // If no text has streamed yet, keep the thinking indicator up.
            if (!hasStreamed) {
              setMessages((prev) =>
                prev.some((m) => m.id === "thinking")
                  ? prev
                  : [...prev, { id: "thinking", role: "assistant", content: "", isThinking: true }]
              );
            }
          } else if (event.type === "response") {
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
          const filtered = prev.filter((m) => m.id !== "thinking" && m.id !== "streaming");
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
        <AnimatePresence>{!isOpen && <FabTooltip />}</AnimatePresence>

        <motion.button
  onClick={() => setIsOpen((v) => !v)}
  className="relative w-14 h-14 rounded-full flex items-center justify-center"
  style={{
    background: isOpen
      ? "linear-gradient(135deg, #163b8a 0%, #0b174a 100%)"
      : "linear-gradient(160deg, #5ca3ff 0%, #2661e0 42%, #1710a2 100%)",
    boxShadow: isOpen
      ? "0 4px 20px rgba(22, 68, 138, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)"
      : "0 14px 40px rgba(16, 72, 162, 0.38), 0 4px 14px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,0.55), inset 0 -6px 10px rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.25)",
  }}
  whileHover={{ scale: 1.06 }}
  whileTap={{ scale: 0.94 }}
  aria-label="Open Gem Consultant"
>
  {!isOpen && <FabHalo />}

  <LiveBadgeDot borderColor={isOpen ? "#0b3a4a" : "#1052a2"} />

  <AnimatePresence mode="wait">
    {isOpen ? (
      <motion.span
        key="close"
        className="relative z-10"
        style={{ color: "#FFE8E8" }}
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
              background: T.ivory,
              boxShadow: "0 32px 80px rgba(33,30,27,0.10), 0 4px 16px rgba(0,0,0,0.05)",
              border: `1px solid ${T.hairline}`,
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
              style={{ background: T.paper, borderColor: T.hairline }}
            >
              <div className="flex items-center gap-2.5">
                {hasMessages && (
                  <motion.button
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => { setMessages([]); setShowSuggestions(false); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: T.stoneLight }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.goldDeep; (e.currentTarget as HTMLButtonElement).style.background = T.blush; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.stoneLight; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    title="New conversation"
                  >
                    <ArrowLeft size={14} />
                  </motion.button>
                )}
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                    style={{ background: goldGradient }}
                  >
                    <Sparkles size={13} />
                  </div>
                  <LiveBadgeDot borderColor="white" />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold leading-none"
                    style={{ color: T.graphite, fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    Victoria
                  </p>
                  <p
                    className="text-[9px] uppercase tracking-[0.14em] mt-0.5 font-medium"
                    style={{ color: T.gold }}
                  >
                    AI Gem Consultant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div
                  className="hidden sm:flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: T.goldPale, color: T.goldDeep, border: `1px solid ${T.hairline}` }}
                >
                  <motion.span
                    className="w-1 h-1 rounded-full"
                    style={{ background: T.gold }}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  GPT-4o
                </div>
                <button
                  onClick={() => setIsFullscreen((v) => !v)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: T.stoneLight }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.graphite; (e.currentTarget as HTMLButtonElement).style.background = T.hairlineSoft; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.stoneLight; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: T.stoneLight }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.graphite; (e.currentTarget as HTMLButtonElement).style.background = T.hairlineSoft; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.stoneLight; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: T.ivory }}>
              {/* Welcome screen */}
              {!hasMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4"
                >
                  <div
                    className="rounded-2xl p-4 bg-white"
                    style={{ border: `1px solid ${T.hairline}` }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: goldGradient }}
                      >
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <p
                          className="text-[9px] font-bold uppercase tracking-[0.14em] mb-1.5"
                          style={{ color: T.gold }}
                        >
                          Victoria · AI Gem Consultant
                        </p>
                        <p
                          className="text-sm leading-relaxed"
                          style={{ color: T.stone, fontFamily: '"Elms Sans", sans-serif' }}
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
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px]"
                            style={{ background: T.goldPale, border: `1px solid ${T.hairline}` }}
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                      <p
                        className="text-[10px] italic"
                        style={{ color: T.stoneLight, fontFamily: '"Elms Sans", sans-serif' }}
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
                  className="text-[9px] block mx-auto transition-colors tracking-wide"
                  style={{ color: T.stoneLight }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.goldDeep; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = T.stoneLight; }}
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
                        <p
                          className="text-[9px] uppercase tracking-[0.15em] font-semibold"
                          style={{ color: T.stoneLight }}
                        >
                          Suggestions
                        </p>
                        <button
                          onClick={() => setShowSuggestions(false)}
                          className="transition-colors"
                          style={{ color: T.stoneLight }}
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
              style={{ background: T.paper, borderColor: T.hairline }}
            >
              <div
                className="flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all"
                style={{ background: T.ivory, borderColor: T.hairline }}
                onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = T.gold; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(180,145,79,0.1)"; }}
                onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = T.hairline; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about gemstones, categories, pricing…"
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed disabled:opacity-50"
                  style={{
                    maxHeight: 120,
                    minHeight: 22,
                    color: T.graphite,
                    fontFamily: '"Elms Sans", sans-serif',
                  }}
                />
                <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                  <motion.button
                    onClick={toggleVoice}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      color: isListening ? T.goldDeep : T.stoneLight,
                      background: isListening ? T.goldPale : "transparent",
                    }}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </motion.button>
                  <motion.button
                    onClick={() => sendMessage(input)}
                    disabled={isLoading || !input.trim()}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: goldGradient }}
                  >
                    <Send size={14} />
                  </motion.button>
                </div>
              </div>
              <p className="text-[8px] text-center mt-1 tracking-wider" style={{ color: T.stoneLight }}>
                ↵ send · ⇧↵ new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}