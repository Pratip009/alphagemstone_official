"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Enums ─────────────────────────────────────────────────────────────────────

const SHAPES = ["round","oval","princess","cushion","emerald","pear","marquise","radiant","asscher","heart","other"] as const;
const COLORS = ["D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","fancy-yellow","fancy-pink","fancy-blue","fancy-green","fancy-red","other"] as const;
const CLARITIES = ["FL","IF","VVS1","VVS2","VS1","VS2","SI1","SI2","I1","I2","I3"] as const;
const CERTIFICATIONS = ["GIA","AGS","EGL","IGI","HRD","none"] as const;
const WATCH_BRANDS = ["Rolex","Omega","Cartier","Citizen","Seiko","Patek Philippe","Audemars Piguet","Vacheron Constantin","A. Lange & Söhne","Jaeger-LeCoultre","IWC","Panerai","Breitling","TAG Heuer","Richard Mille","Hublot","Zenith","Blancpain","Breguet","Tudor","Grand Seiko","Longines","Tissot","Hamilton","Frederique Constant","Fossil","Casio","other"] as const;
const WATCH_MOVEMENTS = ["Automatic","Quartz","Mechanical"] as const;
const WATCH_STRAP_TYPES = ["Metal Bracelet","Leather","Rubber / Silicone"] as const;
const WATCH_CASE_MATERIALS = ["Stainless Steel","Gold","Two-tone","Titanium"] as const;
const WATCH_DIAL_COLORS = ["Black","White","Blue","Green","Gold","Silver","Grey","Brown","Red","Orange","Pink","other"] as const;
const WATCH_FEATURES = ["Chronograph","Date Display","Water Resistant","Diamond Studded","Skeleton Dial"] as const;
const WATCH_STYLES = ["Luxury","Casual","Sport","Dress"] as const;
const WATCH_GENDERS = ["Men","Women","Unisex"] as const;
const WATCH_CASE_SIZES = ["Small","Medium","Large"] as const;

// ── Watch detection helpers ───────────────────────────────────────────────────

// Kinds that belong exclusively to watches
const WATCH_KINDS = new Set<AttrMatch["kind"]>([
  "brand","movement","strap","material","dialcolor","feature","style","gender","size",
]);

// Watch brand names lowercased for fast lookup
const WATCH_BRAND_SET = new Set(WATCH_BRANDS.map((b) => b.toLowerCase()));

/**
 * Returns true when the free-text query looks like a watch search.
 * Matches: exact brand name, brand starting with query, or query containing a brand word.
 */
function isWatchQuery(q: string): boolean {
  const lq = q.toLowerCase().trim();
  if (WATCH_BRAND_SET.has(lq)) return true;
  for (const brand of WATCH_BRAND_SET) {
    if (brand.startsWith(lq) || lq.startsWith(brand.split(" ")[0])) return true;
  }
  return false;
}

/**
 * Given a product item from the cache, determine if it belongs to watches
 * by checking its category slug or name.
 */
function isWatchProduct(prod: SearchProduct): boolean {
  if (!prod.category) return false;
  if (typeof prod.category === "object") {
    return prod.category.slug === "watches" || prod.category.name?.toLowerCase() === "watches";
  }
  return prod.category === "watches";
}

// ── Attribute map ─────────────────────────────────────────────────────────────

type AttrMatch = {
  label: string;
  param: string;
  value: string;
  kind: "shape"|"color"|"clarity"|"cert"|"brand"|"movement"|"strap"|"material"|"dialcolor"|"feature"|"style"|"gender"|"size";
};

const ALL_ATTRS: AttrMatch[] = [
  ...SHAPES.map((v)          => ({ label: v, param: "shape",        value: v, kind: "shape"     as const })),
  ...COLORS.map((v)          => ({ label: v, param: "color",        value: v, kind: "color"     as const })),
  ...CLARITIES.map((v)       => ({ label: v, param: "clarity",      value: v, kind: "clarity"   as const })),
  ...CERTIFICATIONS.map((v)  => ({ label: v, param: "certification",value: v, kind: "cert"      as const })),
  ...WATCH_BRANDS.map((v)    => ({ label: v, param: "brand",        value: v, kind: "brand"     as const })),
  ...WATCH_MOVEMENTS.map((v) => ({ label: v, param: "movement",     value: v, kind: "movement"  as const })),
  ...WATCH_STRAP_TYPES.map((v)     => ({ label: v, param: "strapType",    value: v, kind: "strap"     as const })),
  ...WATCH_CASE_MATERIALS.map((v)  => ({ label: v, param: "caseMaterial", value: v, kind: "material"  as const })),
  ...WATCH_DIAL_COLORS.map((v)     => ({ label: v, param: "dialColor",    value: v, kind: "dialcolor" as const })),
  ...WATCH_FEATURES.map((v)  => ({ label: v, param: "feature",     value: v, kind: "feature"   as const })),
  ...WATCH_STYLES.map((v)    => ({ label: v, param: "style",        value: v, kind: "style"     as const })),
  ...WATCH_GENDERS.map((v)   => ({ label: v, param: "gender",       value: v, kind: "gender"    as const })),
  ...WATCH_CASE_SIZES.map((v)=> ({ label: v, param: "caseSize",     value: v, kind: "size"      as const })),
];

const KIND_LABELS: Record<AttrMatch["kind"], string> = {
  shape: "Shape", color: "Color / Grade", clarity: "Clarity",
  cert: "Certification", brand: "Watch Brand", movement: "Movement",
  strap: "Strap", material: "Case Material", dialcolor: "Dial Color",
  feature: "Feature", style: "Style", gender: "Gender", size: "Case Size",
};

const KIND_COLORS: Record<AttrMatch["kind"], { bg: string; color: string }> = {
  shape:     { bg: "#ede9fe", color: "#5b21b6" },
  color:     { bg: "#fef3c7", color: "#92400e" },
  clarity:   { bg: "#d1fae5", color: "#065f46" },
  cert:      { bg: "#dbeafe", color: "#1e40af" },
  brand:     { bg: "#fce7f3", color: "#9d174d" },
  movement:  { bg: "#f0fdf4", color: "#166534" },
  strap:     { bg: "#fff7ed", color: "#9a3412" },
  material:  { bg: "#f1f5f9", color: "#334155" },
  dialcolor: { bg: "#fdf4ff", color: "#7e22ce" },
  feature:   { bg: "#ecfeff", color: "#155e75" },
  style:     { bg: "#fff1f2", color: "#9f1239" },
  gender:    { bg: "#f0f9ff", color: "#0c4a6e" },
  size:      { bg: "#f7fee7", color: "#3f6212" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchSubcategory { _id: string; name: string; slug: string; isActive?: boolean }
interface SearchCategory    { _id: string; name: string; slug: string; isActive?: boolean; subcategories: SearchSubcategory[] }
interface SearchProduct     { _id: string; name: string; slug?: string; price?: number; images?: string[]; image?: string; category?: string | { name: string; slug: string }; isActive?: boolean }

type ResultItem =
  | { type: "category";    item: SearchCategory }
  | { type: "subcategory"; item: SearchSubcategory; parent: SearchCategory }
  | { type: "product";     item: SearchProduct }
  | { type: "attr";        match: AttrMatch };

// ── Module-level cache ────────────────────────────────────────────────────────

let _cats: SearchCategory[] | null = null;
let _prods: SearchProduct[] | null = null;
let _promise: Promise<void> | null = null;

async function loadData() {
  if (_cats && _prods) return;
  if (_promise) return _promise;
  _promise = (async () => {
    const [cr, pr] = await Promise.all([
      fetch("/api/categories?withSubcategories=true"),
      fetch("/api/products?limit=500"),
    ]);
    const cd = await cr.json();
    const pd = await pr.json();
    const cl: SearchCategory[] = Array.isArray(cd) ? cd : (cd?.data ?? cd?.categories ?? []);
    _cats = cl.filter((c) => c.isActive !== false).map((c) => ({
      ...c,
      subcategories: (c.subcategories ?? []).filter((s) => s.isActive !== false),
    }));
    const pl: SearchProduct[] = Array.isArray(pd) ? pd : (pd?.data ?? []);
    _prods = pl.filter((p) => p.isActive !== false);
  })();
  return _promise;
}

// ── Search function ───────────────────────────────────────────────────────────

function search(q: string): ResultItem[] {
  const lq = q.toLowerCase().trim();
  if (!lq) return [];

  // Products — split into strong (starts with) vs partial matches
  const prodsStrong: ResultItem[] = [];
  const prodsWeak: ResultItem[] = [];
  (_prods ?? []).forEach((prod) => {
    if (prod.name.toLowerCase().includes(lq)) {
      if (prod.name.toLowerCase().startsWith(lq)) {
        prodsStrong.push({ type: "product", item: prod });
      } else {
        prodsWeak.push({ type: "product", item: prod });
      }
    }
  });

  // Categories & subcategories
  const catResults: ResultItem[] = [];
  (_cats ?? []).forEach((cat) => {
    if (cat.name.toLowerCase().includes(lq)) catResults.push({ type: "category", item: cat });
    cat.subcategories.forEach((sub) => {
      if (sub.name.toLowerCase().includes(lq)) catResults.push({ type: "subcategory", item: sub, parent: cat });
    });
  });

  // Attribute matches
  const attrResults: ResultItem[] = [];
  ALL_ATTRS.forEach((attr) => {
    if (attr.label.toLowerCase().includes(lq)) attrResults.push({ type: "attr", match: attr });
  });

  // Strong product matches float to top, weak ones go after categories/attrs
  return [...prodsStrong, ...catResults, ...attrResults, ...prodsWeak];
}

// ── Highlight ─────────────────────────────────────────────────────────────────

function Hi({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: "#fbbf24", color: "#1a1a2e", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoGrid = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const IcoTag = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M2 2h5.586a1 1 0 01.707.293l5.414 5.414a2 2 0 010 2.828l-3.172 3.172a2 2 0 01-2.828 0L2.293 8.293A1 1 0 012 7.586V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="5" cy="5" r="1" fill="currentColor"/>
  </svg>
);
const IcoGem = () => (
  <svg width="11" height="11" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
    <polygon points="16,3 29,12 16,29 3,12" stroke="currentColor" strokeWidth="2" fill="none"/>
    <polygon points="16,3 29,12 16,15 3,12" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5"/>
  </svg>
);
const IcoWatch = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="7" y="4" width="10" height="16" rx="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M9 20v1.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V20" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoBox = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1 7h14" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M5.5 1.5L3 4M10.5 1.5L13 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IcoFilter = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IcoArrow = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialCategories?: SearchCategory[];
  placeholder?: string;
  variant?: "desktop" | "mobile";
}

export default function SearchBar({
  initialCategories = [],
  placeholder = "Search gems, shapes, brands…",
  variant = "desktop",
}: Props) {
  const router = useRouter();
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<ResultItem[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [focused, setFocused]     = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [drawerTop, setDrawerTop] = useState(120);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounce     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed SSR categories into cache
  useEffect(() => {
    if (initialCategories.length > 0 && !_cats) {
      _cats = initialCategories
        .filter((c) => c.isActive !== false)
        .map((c) => ({
          ...c,
          subcategories: (c.subcategories ?? []).filter((s) => s.isActive !== false),
        }));
    }
  }, []); // eslint-disable-line

  // Keep drawerTop in sync with navbar bottom
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector("nav");
      if (nav) setDrawerTop(nav.getBoundingClientRect().bottom);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);

  const handleFocus = useCallback(async () => {
    setFocused(true);
    if (!_cats || !_prods) {
      setLoading(true);
      await loadData().catch(() => {});
      setLoading(false);
      if (query.trim()) { setResults(search(query)); setOpen(true); }
    }
  }, [query]);

  // Debounced search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setOpen(false); setActiveIdx(-1); return; }
    debounce.current = setTimeout(() => {
      setResults(search(query));
      setOpen(true);
      setActiveIdx(-1);
    }, 100);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  // Click outside
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setFocused(false); setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Navigation: the core of the fix ──────────────────────────────────────
  const go = useCallback((r: ResultItem) => {
    setOpen(false); setQuery(""); setActiveIdx(-1); inputRef.current?.blur();

    if (r.type === "category") {
      router.push(`/products?category=${r.item.slug}`);

    } else if (r.type === "subcategory") {
      router.push(`/products?category=${r.parent.slug}&subcategory=${r.item.slug}`);

    } else if (r.type === "product") {
      if (r.item.slug) {
        // Individual product page — no category injection needed
        router.push(`/products/${r.item.slug}`);
      } else {
        // Search results page — inject category so sidebar is correct
        const catParam = isWatchProduct(r.item) ? "&category=watches" : "";
        router.push(`/products?search=${encodeURIComponent(r.item.name)}${catParam}`);
      }

    } else if (r.type === "attr") {
      // Watch-exclusive attributes always go to the watches category
      const catParam = WATCH_KINDS.has(r.match.kind) ? "&category=watches" : "";
      router.push(`/products?${r.match.param}=${encodeURIComponent(r.match.value)}${catParam}`);
    }
  }, [router]);

  // Free-text submit — detect watch brand names in the query
  const submit = useCallback(() => {
    if (!query.trim()) return;
    setOpen(false);
    const catParam = isWatchQuery(query.trim()) ? "&category=watches" : "";
    router.push(`/products?search=${encodeURIComponent(query.trim())}${catParam}`);
    setQuery("");
  }, [query, router]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false); setActiveIdx(-1); inputRef.current?.blur(); return;
    }
    if (!open || results.length === 0) { if (e.key === "Enter") submit(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); activeIdx >= 0 ? go(results[activeIdx]) : submit(); }
  };

  // Partition results for display columns
  const cats  = results.filter((r) => r.type === "category");
  const subs  = results.filter((r) => r.type === "subcategory");
  const prods = results.filter((r) => r.type === "product");
  const attrs = results.filter((r) => r.type === "attr") as { type: "attr"; match: AttrMatch }[];

  // Group attrs by kind
  const attrsByKind = attrs.reduce<Record<string, { type: "attr"; match: AttrMatch }[]>>((acc, r) => {
    const k = r.match.kind;
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  const hasResults = results.length > 0;
  const isDesktop  = variant === "desktop";

  const showCatCol  = cats.length > 0 || subs.length > 0;
  const showProdCol = prods.length > 0;
  const showAttrCol = attrs.length > 0;
  const colCount    = [showCatCol, showProdCol, showAttrCol].filter(Boolean).length || 1;

  return (
    <>
      <style>{`
        .sb-wrap { position: relative; font-family: 'Poppins', sans-serif; }
        .sb-input-row {
          display: flex; align-items: center; gap: 8px;
          background: #faf9ff; border: 1.5px solid #e2e0f0;
          border-radius: 10px; padding: 0 14px; height: 40px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .sb-input-row.mobile { height: 44px; }
        .sb-input-row.focused {
          border-color: #0f3460;
          box-shadow: 0 0 0 3px rgba(15,52,96,0.08);
          background: #fff;
        }
        .sb-input {
          flex: 1; border: none; background: transparent;
          font-family: 'Poppins', sans-serif; font-size: 13px;
          color: #1a1a2e; outline: none;
        }
        .sb-input::placeholder { color: #b0aecb; }
        .sb-clear {
          background: transparent; border: none; cursor: pointer;
          color: #b0aecb; display: flex; align-items: center;
          padding: 2px; border-radius: 4px;
          transition: color .15s, background .15s; flex-shrink: 0;
        }
        .sb-clear:hover { color: #1a1a2e; background: #f0eeff; }
        .sb-kbd {
          font-size: 10px; color: #b0aecb; background: #f0eeff;
          border-radius: 4px; padding: 2px 5px; flex-shrink: 0;
          font-family: 'Poppins', sans-serif; font-weight: 500;
        }
        .sb-drawer {
          position: fixed; left: 2vw; right: 2vw;
          max-width: 1280px; margin-left: auto; margin-right: auto;
          background: #fff; border: 1px solid #e8e4f8;
          border-top: 3px solid #0f3460;
          border-radius: 0 0 16px 16px;
          box-shadow: 0 24px 80px rgba(79,70,229,0.13), 0 4px 20px rgba(0,0,0,0.07);
          z-index: 9999; overflow: hidden;
          animation: sbIn 0.15s ease both;
        }
        @keyframes sbIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sb-body {
          max-height: 50vh; overflow-y: auto;
          overscroll-behavior: contain; display: grid;
        }
        .sb-body::-webkit-scrollbar { width: 4px; }
        .sb-body::-webkit-scrollbar-track { background: transparent; }
        .sb-body::-webkit-scrollbar-thumb { background: #e2e0f0; border-radius: 4px; }
        .sb-body::-webkit-scrollbar-thumb:hover { background: #c4b5fd; }
        .sb-col { min-width: 0; }
        .sb-col + .sb-col { border-left: 1px solid #f0eeff; }
        .sb-sec-label {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px 5px; font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: #9f9fc0;
          font-family: 'Poppins', sans-serif; position: sticky; top: 0;
          background: #fff; z-index: 2; border-bottom: 1px solid #f8f6ff;
        }
        .sb-sec-label:not(:first-child) { border-top: 1px solid #f0eeff; }
        .sb-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 14px; cursor: pointer; border: none;
          background: transparent; width: 100%; text-align: left;
          transition: background .1s;
        }
        .sb-row:hover, .sb-row.active { background: #f5f3ff; }
        .sb-icon {
          width: 28px; height: 28px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sb-icon.cat   { background: linear-gradient(135deg,#e0e7ff,#c7d2fe); color:#3730a3; }
        .sb-icon.sub   { background: linear-gradient(135deg,#f0fdf4,#bbf7d0); color:#166534; }
        .sb-icon.prod  { background: linear-gradient(135deg,#1a1a2e,#0f3460); color:#a5b4fc; overflow:hidden; }
        .sb-icon.prod img { width:100%; height:100%; object-fit:cover; }
        .sb-icon.watch { background: linear-gradient(135deg,#fdf4ff,#e9d5ff); color:#7c3aed; }
        .sb-text { flex:1; min-width:0; }
        .sb-name {
          font-size: 13px; font-weight: 500; color: #1a1a2e;
          font-family: 'Poppins', sans-serif;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sb-meta { font-size: 11px; color: #9f9fc0; font-family: 'Poppins', sans-serif; margin-top:1px; }
        .sb-badge {
          font-size: 9px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 2px 6px; border-radius: 4px;
          flex-shrink: 0;
        }
        .sb-badge.watch { background: #f3e8ff; color: #7c3aed; }
        .sb-badge.diamond { background: #dbeafe; color: #1d4ed8; }
        .sb-arrow { color: #c4b5fd; flex-shrink:0; transition: color .15s, transform .15s; }
        .sb-row:hover .sb-arrow, .sb-row.active .sb-arrow { color: #0f3460; transform: translateX(2px); }
        .sb-attr-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px 10px; }
        .sb-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 20px; font-size: 12px;
          font-weight: 500; font-family: 'Poppins', sans-serif;
          cursor: pointer; border: 1px solid transparent;
          transition: filter .15s, transform .1s; white-space: nowrap;
        }
        .sb-chip:hover { filter: brightness(0.93); transform: translateY(-1px); }
        .sb-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 14px; border-top: 1px solid #f0eeff; background: #faf9ff;
        }
        .sb-hint { font-size: 11px; color: #b0aecb; font-family: 'Poppins', sans-serif; }
        .sb-all {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; color: #0f3460;
          font-family: 'Poppins', sans-serif; cursor: pointer;
          background: transparent; border: none; padding: 4px 8px;
          border-radius: 6px; transition: background .12s;
        }
        .sb-all:hover { background: #ede9fe; }
        .sb-empty { padding: 28px 20px; text-align: center; font-size: 13px; color: #9f9fc0; font-family: 'Poppins', sans-serif; }
        .sb-empty strong { color: #1a1a2e; display: block; margin-bottom: 4px; font-size: 14px; }
        .sb-dots { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 24px; }
        .sb-dots span { width:6px; height:6px; border-radius:50%; background:#c4b5fd; animation: sdot 1.2s ease infinite; }
        .sb-dots span:nth-child(2){animation-delay:.15s}
        .sb-dots span:nth-child(3){animation-delay:.3s}
        @keyframes sdot { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }
        mark { background: none; }
      `}</style>

      <div
        ref={containerRef}
        className="sb-wrap"
        style={{
          flex:     isDesktop ? "1 1 auto" : undefined,
          maxWidth: isDesktop ? "340px"    : undefined,
          minWidth: isDesktop ? "180px"    : undefined,
          width:    !isDesktop ? "100%"    : undefined,
        }}
      >
        {/* ── Input row ── */}
        <div className={["sb-input-row", !isDesktop ? "mobile" : "", focused ? "focused" : ""].filter(Boolean).join(" ")}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
            style={{ color: focused ? "#0f3460" : "#9f9fc0", flexShrink: 0, transition: "color .2s" }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>

          <input
            ref={inputRef}
            className="sb-input"
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setFocused(false)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
          />

          {query && (
            <button className="sb-clear" tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {!query && isDesktop && <span className="sb-kbd">⏎</span>}
        </div>

        {/* ── Drawer ── */}
        {open && (
          <div className="sb-drawer" style={{ top: drawerTop }}>
            {loading ? (
              <div className="sb-dots"><span/><span/><span/></div>
            ) : !hasResults ? (
              <div className="sb-empty">
                <strong>No results for &ldquo;{query}&rdquo;</strong>
                Try a gem name, shape, brand, or clarity grade
              </div>
            ) : (
              <>
                <div className="sb-body" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}>

                  {/* ── Col 1: Categories + Subcategories ── */}
                  {showCatCol && (
                    <div className="sb-col">
                      {cats.length > 0 && (
                        <>
                          <p className="sb-sec-label"><IcoGrid /> Categories</p>
                          {cats.map((r) => {
                            const idx = results.indexOf(r);
                            const cat = (r as { type: "category"; item: SearchCategory }).item;
                            return (
                              <button key={cat._id} className={`sb-row${activeIdx === idx ? " active" : ""}`}
                                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                                onMouseEnter={() => setActiveIdx(idx)}>
                                <div className="sb-icon cat"><IcoGrid /></div>
                                <div className="sb-text">
                                  <div className="sb-name"><Hi text={cat.name} q={query}/></div>
                                  <div className="sb-meta">{cat.subcategories.length} subcategories</div>
                                </div>
                                <span className="sb-arrow"><IcoArrow /></span>
                              </button>
                            );
                          })}
                        </>
                      )}
                      {subs.length > 0 && (
                        <>
                          <p className="sb-sec-label"><IcoTag /> Subcategories</p>
                          {subs.map((r) => {
                            const idx = results.indexOf(r);
                            const sub = r as { type: "subcategory"; item: SearchSubcategory; parent: SearchCategory };
                            return (
                              <button key={sub.item._id} className={`sb-row${activeIdx === idx ? " active" : ""}`}
                                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                                onMouseEnter={() => setActiveIdx(idx)}>
                                <div className="sb-icon sub"><IcoTag /></div>
                                <div className="sb-text">
                                  <div className="sb-name"><Hi text={sub.item.name} q={query}/></div>
                                  <div className="sb-meta">in {sub.parent.name}</div>
                                </div>
                                <span className="sb-arrow"><IcoArrow /></span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Col 2: Products ── */}
                  {showProdCol && (
                    <div className="sb-col">
                      <p className="sb-sec-label"><IcoGem /> Products</p>
                      {prods.map((r) => {
                        const idx  = results.indexOf(r);
                        const prod = (r as { type: "product"; item: SearchProduct }).item;
                        const img  = prod.images?.[0] ?? prod.image ?? null;
                        const isWatch = isWatchProduct(prod);
                        const catName = typeof prod.category === "object"
                          ? prod.category?.name
                          : prod.category;
                        return (
                          <button key={prod._id} className={`sb-row${activeIdx === idx ? " active" : ""}`}
                            onMouseDown={(e) => { e.preventDefault(); go(r); }}
                            onMouseEnter={() => setActiveIdx(idx)}>
                            {/* Use watch icon style for watches, gem icon for diamonds */}
                            <div className={`sb-icon ${isWatch ? "watch" : "prod"}`}>
                              {img
                                ? <img src={img} alt={prod.name}/>
                                : isWatch ? <IcoWatch /> : <IcoBox />
                              }
                            </div>
                            <div className="sb-text">
                              <div className="sb-name"><Hi text={prod.name} q={query}/></div>
                              <div className="sb-meta">
                                {prod.price != null && `$${prod.price.toLocaleString()}`}
                                {catName && prod.price != null && " · "}{catName}
                              </div>
                            </div>
                            {/* Badge showing product type */}
                            <span className={`sb-badge ${isWatch ? "watch" : "diamond"}`}>
                              {isWatch ? "Watch" : "Diamond"}
                            </span>
                            <span className="sb-arrow"><IcoArrow /></span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Col 3: Attribute chips ── */}
                  {showAttrCol && (
                    <div className="sb-col">
                      <p className="sb-sec-label"><IcoFilter /> Filter by</p>
                      {Object.entries(attrsByKind).map(([kind, rows]) => {
                        const k = kind as AttrMatch["kind"];
                        const { bg, color } = KIND_COLORS[k];
                        return (
                          <div key={kind}>
                            <div style={{
                              padding: "6px 14px 2px", fontSize: 10, fontWeight: 700,
                              letterSpacing: "0.08em", textTransform: "uppercase",
                              color: "#b0aecb", fontFamily: "'Poppins', sans-serif",
                            }}>
                              {KIND_LABELS[k]}
                              {/* Show a subtle watch indicator for watch-exclusive filters */}
                              {WATCH_KINDS.has(k) && (
                                <span style={{ marginLeft: 6, fontSize: 9, color: "#7c3aed", fontWeight: 600 }}>
                                  · WATCH
                                </span>
                              )}
                            </div>
                            <div className="sb-attr-chips">
                              {rows.map((r) => (
                                <button
                                  key={r.match.value}
                                  className="sb-chip"
                                  style={{ background: bg, color }}
                                  onMouseDown={(e) => { e.preventDefault(); go(r); }}
                                >
                                  <Hi text={r.match.label} q={query}/>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="sb-footer">
                  <span className="sb-hint">↑↓ navigate · ↵ select · esc close</span>
                  <button className="sb-all" onMouseDown={(e) => { e.preventDefault(); submit(); }}>
                    All results <IcoArrow />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}