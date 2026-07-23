"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import {
  SHAPES, COLORS, CLARITIES, CERTIFICATIONS,
  WATCH_BRANDS, WATCH_MOVEMENTS, WATCH_STRAP_TYPES, WATCH_CASE_MATERIALS,
  WATCH_DIAL_COLORS, WATCH_FEATURES, WATCH_STYLES, WATCH_GENDERS, WATCH_CASE_SIZES,
} from "@/lib/productAttributes";
import { fuzzyScore, extractCarat, CARAT_MATCH_TOLERANCE } from '@/lib/search';

// ── Watch detection ───────────────────────────────────────────────────────────
const WATCH_KINDS = new Set<AttrMatch["kind"]>([
  "brand", "movement", "strap", "material", "dialcolor", "feature", "style", "gender", "size",
]);

const WATCH_BRAND_SET = new Set(WATCH_BRANDS.map((b) => b.toLowerCase()));

/** True when the free-text query clearly names a watch brand (min 3 chars to avoid false positives on short queries like "c"). */
function isWatchQuery(q: string): boolean {
  const lq = q.toLowerCase().trim();
  if (lq.length < 3) return false;
  if (WATCH_BRAND_SET.has(lq)) return true;
  for (const brand of WATCH_BRAND_SET) {
    const firstWord = brand.split(" ")[0];
    if (brand.startsWith(lq) || (firstWord.length >= 3 && lq.startsWith(firstWord))) return true;
  }
  return false;
}

/** Classify a product using the authoritative `productKind` field first, falling back to legacy category-slug guessing only for older rows that predate that field. */
function classifyKind(prod: SearchProduct): "watch" | "gemstone" | "jewelry" | "diamond" {
  if (prod.productKind) return prod.productKind;
  if (prod.category) {
    const slug = typeof prod.category === "object" ? prod.category.slug : prod.category;
    const name = typeof prod.category === "object" ? prod.category.name?.toLowerCase() : undefined;
    if (slug === "watches" || name === "watches") return "watch";
    if (slug === "jewelry" || name === "jewelry") return "jewelry";
  }
  if (prod.gemstoneName) return "gemstone";
  return "diamond";
}

// ── Attribute map ─────────────────────────────────────────────────────────────

type AttrMatch = {
  label: string;
  param: string;
  value: string;
  kind: "shape" | "color" | "clarity" | "cert" | "brand" | "movement" | "strap" | "material" | "dialcolor" | "feature" | "style" | "gender" | "size";
};

const ALL_ATTRS: AttrMatch[] = [
  ...SHAPES.map((v) => ({ label: v, param: "shape", value: v, kind: "shape" as const })),
  ...COLORS.map((v) => ({ label: v, param: "color", value: v, kind: "color" as const })),
  ...CLARITIES.map((v) => ({ label: v, param: "clarity", value: v, kind: "clarity" as const })),
  ...CERTIFICATIONS.map((v) => ({ label: v, param: "certification", value: v, kind: "cert" as const })),
  ...WATCH_BRANDS.map((v) => ({ label: v, param: "brand", value: v, kind: "brand" as const })),
  ...WATCH_MOVEMENTS.map((v) => ({ label: v, param: "movement", value: v, kind: "movement" as const })),
  ...WATCH_STRAP_TYPES.map((v) => ({ label: v, param: "strapType", value: v, kind: "strap" as const })),
  ...WATCH_CASE_MATERIALS.map((v) => ({ label: v, param: "caseMaterial", value: v, kind: "material" as const })),
  ...WATCH_DIAL_COLORS.map((v) => ({ label: v, param: "dialColor", value: v, kind: "dialcolor" as const })),
  ...WATCH_FEATURES.map((v) => ({ label: v, param: "feature", value: v, kind: "feature" as const })),
  ...WATCH_STYLES.map((v) => ({ label: v, param: "style", value: v, kind: "style" as const })),
  ...WATCH_GENDERS.map((v) => ({ label: v, param: "gender", value: v, kind: "gender" as const })),
  ...WATCH_CASE_SIZES.map((v) => ({ label: v, param: "caseSize", value: v, kind: "size" as const })),
];

const KIND_LABELS: Record<AttrMatch["kind"], string> = {
  shape: "Shape", color: "Color / Grade", clarity: "Clarity",
  cert: "Certification", brand: "Watch Brand", movement: "Movement",
  strap: "Strap", material: "Case Material", dialcolor: "Dial Color",
  feature: "Feature", style: "Style", gender: "Gender", size: "Case Size",
};

const KIND_COLORS: Record<AttrMatch["kind"], { bg: string; color: string }> = {
  shape: { bg: "#ede9fe", color: "#5b21b6" },
  color: { bg: "#fef3c7", color: "#92400e" },
  clarity: { bg: "#d1fae5", color: "#065f46" },
  cert: { bg: "#dbeafe", color: "#1e40af" },
  brand: { bg: "#fce7f3", color: "#9d174d" },
  movement: { bg: "#f0fdf4", color: "#166534" },
  strap: { bg: "#fff7ed", color: "#9a3412" },
  material: { bg: "#f1f5f9", color: "#334155" },
  dialcolor: { bg: "#fdf4ff", color: "#7e22ce" },
  feature: { bg: "#ecfeff", color: "#155e75" },
  style: { bg: "#fff1f2", color: "#9f1239" },
  gender: { bg: "#f0f9ff", color: "#0c4a6e" },
  size: { bg: "#f7fee7", color: "#3f6212" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchSubcategory { _id: string; name: string; slug: string; isActive?: boolean }
interface SearchCategory { _id: string; name: string; slug: string; isActive?: boolean; subcategories: SearchSubcategory[] }
interface SearchProduct {
  _id: string; name: string; slug?: string; price?: number; images?: string[]; image?: string;
  category?: string | { name: string; slug: string };
  isActive?: boolean;
  productKind?: "diamond" | "gemstone" | "watch" | "jewelry";
  watchBrand?: string; watchModel?: string; gemstoneName?: string; legacySku?: string; description?: string;
  size?: number; shape?: string[]; color?: string[]; clarity?: string[]; certification?: string[];
}

type MatchedField = "name" | "brand" | "model" | "gem" | "sku" | "carat";

type ResultItem =
  | { type: "category"; item: SearchCategory }
  | { type: "subcategory"; item: SearchSubcategory; parent: SearchCategory }
  | { type: "product"; item: SearchProduct; score: number; matchedOn: string; matchedField: MatchedField }
  | { type: "attr"; match: AttrMatch };

// ── Category cache (bounded, small — safe to keep in memory client-side) ─────

let _cats: SearchCategory[] | null = null;
let _catsPromise: Promise<void> | null = null;

async function loadCategories() {
  if (_cats) return;
  if (_catsPromise) return _catsPromise;
  _catsPromise = (async () => {
    const cr = await fetch("/api/categories?withSubcategories=true");
    const cd = await cr.json();
    const cl: SearchCategory[] = Array.isArray(cd) ? cd : (cd?.data ?? cd?.categories ?? []);
    _cats = cl.filter((c) => c.isActive !== false).map((c) => ({
      ...c,
      subcategories: (c.subcategories ?? []).filter((s) => s.isActive !== false),
    }));
  })().catch((err) => {
    _catsPromise = null; // let the next attempt retry instead of caching a failure forever
    throw err;
  });
  return _catsPromise;
}

// ── Product search (server-backed) ────────────────────────────────────────────
// Products are NOT cached client-side anymore. The old approach fetched a
// single page of up to 500 products once and searched only inside that page —
// anything outside it (which, on a catalog this size, is most of it) was
// silently unsearchable. Every keystroke now asks the database directly via
// /api/products/search, which has no such cap.

async function fetchProducts(q: string, signal: AbortSignal): Promise<SearchProduct[]> {
  const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}&limit=24`, { signal });
  if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
  const data = await res.json();
  const list: SearchProduct[] = Array.isArray(data) ? data : (data?.data ?? []);
  return list.filter((p) => p.isActive !== false);
}

/** Rank a single product against the query across every searchable field, including carat weight. */
function scoreProduct(prod: SearchProduct, lq: string, carat: number | null): { score: number; matchedOn: string; matchedField: MatchedField } | null {
  const candidates: { field: MatchedField; text: string | undefined; weight: number }[] = [
    { field: "name", text: prod.name, weight: 1 },
    { field: "brand", text: prod.watchBrand, weight: 0.95 },
    { field: "model", text: prod.watchModel, weight: 0.9 },
    { field: "gem", text: prod.gemstoneName, weight: 0.85 },
    { field: "sku", text: prod.legacySku, weight: 0.6 },
  ];
  let best: { matchedField: MatchedField; score: number; matchedOn: string } | null = null;
  for (const c of candidates) {
    const s = fuzzyScore(c.text, lq) * c.weight;
    if (s > 0 && (!best || s > best.score)) best = { matchedField: c.field, score: s, matchedOn: c.text as string };
  }
  // Carat is numeric, not textual — "0.35 Carat" won't literally appear in any
  // field, so it's matched by proximity to `size` instead of substring search.
  if (carat !== null && prod.size != null) {
    const diff = Math.abs(prod.size - carat);
    if (diff <= CARAT_MATCH_TOLERANCE) {
      const caratScore = 96 - diff * 200; // exact weight ranks above a merely-close one
      if (!best || caratScore > best.score) best = { matchedField: "carat", score: caratScore, matchedOn: `${prod.size} ct` };
    }
  }
  return best;
}

/** Instant, synchronous results from the small bounded lists — categories, subcategories, and the attribute vocabulary. No network call needed. */
function searchLocal(q: string): { cats: ResultItem[]; attrs: ResultItem[] } {
  const lq = q.toLowerCase().trim();
  const catResults: ResultItem[] = [];
  (_cats ?? []).forEach((cat) => {
    if (cat.name.toLowerCase().includes(lq)) catResults.push({ type: "category", item: cat });
    cat.subcategories.forEach((sub) => {
      if (sub.name.toLowerCase().includes(lq)) catResults.push({ type: "subcategory", item: sub, parent: cat });
    });
  });
  const attrScored = ALL_ATTRS
    .map((attr) => ({ attr, score: fuzzyScore(attr.label, lq) }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score);
  const attrResults: ResultItem[] = attrScored.map((a) => ({ type: "attr", match: a.attr }));
  return { cats: catResults, attrs: attrResults };
}

function mergeResults(local: { cats: ResultItem[]; attrs: ResultItem[] }, products: ResultItem[]): ResultItem[] {
  const strong = products.filter((r) => r.type === "product" && r.score >= 70);
  const weak = products.filter((r) => r.type === "product" && r.score < 70);
  return [...strong, ...local.cats, ...local.attrs, ...weak];
}

// ── Highlight ─────────────────────────────────────────────────────────────────

function Hi({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="sb-mark">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoGrid = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IcoTag = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M2 2h5.586a1 1 0 01.707.293l5.414 5.414a2 2 0 010 2.828l-3.172 3.172a2 2 0 01-2.828 0L2.293 8.293A1 1 0 012 7.586V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="5" cy="5" r="1" fill="currentColor" />
  </svg>
);
const IcoGem = () => (
  <svg width="11" height="11" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
    <polygon points="16,3 29,12 16,29 3,12" stroke="currentColor" strokeWidth="2" fill="none" />
    <polygon points="16,3 29,12 16,15 3,12" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
  </svg>
);
const IcoWatch = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="7" y="4" width="10" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M9 20v1.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V20" stroke="currentColor" strokeWidth="1.2" />
    <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoRing = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="15" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 9l3-6 3 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IcoBox = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1 7h14" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5.5 1.5L3 4M10.5 1.5L13 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const IcoFilter = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IcoClock = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoTrend = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M1.5 12.5l4-4.5 3 3 5.5-6.5M14 4.5h-3.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoArrow = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoX = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function kindMeta(kind: "watch" | "gemstone" | "jewelry" | "diamond") {
  switch (kind) {
    case "watch": return { label: "Watch", icon: <IcoWatch />, iconClass: "watch", badgeClass: "watch" };
    case "jewelry": return { label: "Jewelry", icon: <IcoRing />, iconClass: "jewelry", badgeClass: "jewelry" };
    case "gemstone": return { label: "Gemstone", icon: <IcoGem />, iconClass: "gem", badgeClass: "gem" };
    default: return { label: "Diamond", icon: <IcoBox />, iconClass: "prod", badgeClass: "diamond" };
  }
}

// ── Recent searches (localStorage-backed; this is a real app, not a sandboxed artifact) ──

const RECENT_KEY = "sb_recent_searches";
const RECENT_MAX = 6;

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (!trimmed) return;
  try {
    const cur = getRecent().filter((r) => r.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...cur].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, etc) — recent search history is a nice-to-have, fail silently
  }
}

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
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [drawerTop, setDrawerTop] = useState(120);
  const [recent, setRecent] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => setRecent(getRecent()), []);

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

  // Global "/" and "⌘K / Ctrl+K" shortcuts to jump into search, like most modern apps
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const typing = activeTag === "input" || activeTag === "textarea" || (document.activeElement as HTMLElement)?.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleFocus = useCallback(async () => {
    setFocused(true);
    setOpen(true);
    if (!_cats) await loadCategories().catch(() => {});
  }, []);

  // Debounced search: categories/attrs resolve instantly from the local cache;
  // products come from the server and get patched in once they arrive, so the
  // drawer never sits blank while a request is in flight.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();

    if (!q) {
      setResults([]);
      setActiveIdx(-1);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    const local = searchLocal(q);
    setResults(mergeResults(local, []));
    setOpen(true);
    setActiveIdx(-1);
    setLoading(true);

    debounce.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const myReq = ++reqIdRef.current;
      const carat = extractCarat(q);
      const lq = q.toLowerCase();

      fetchProducts(q, controller.signal)
        .then((prods) => {
          if (myReq !== reqIdRef.current) return; // a newer keystroke already superseded this request
          const scored: ResultItem[] = prods
            .map((p) => {
              const s = scoreProduct(p, lq, carat);
              return s ? ({ type: "product", item: p, score: s.score, matchedOn: s.matchedOn, matchedField: s.matchedField } as ResultItem) : null;
            })
            .filter((r): r is ResultItem => r !== null)
            .sort((a, b) => (b as any).score - (a as any).score);
          setResults(mergeResults(local, scored));
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          if (myReq !== reqIdRef.current) return;
          setLoading(false); // keep showing the category/attribute results already on screen
        });
    }, 150);

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

  // ── Navigation ────────────────────────────────────────────────────────────
  const go = useCallback((r: ResultItem) => {
    setOpen(false); setActiveIdx(-1); inputRef.current?.blur();

    if (r.type === "category") {
      setQuery("");
      router.push(`/products?category=${r.item.slug}`);

    } else if (r.type === "subcategory") {
      setQuery("");
      router.push(`/products?category=${r.parent.slug}&subcategory=${r.item.slug}`);

    } else if (r.type === "product") {
      setQuery("");
      if (r.item.slug) {
        router.push(`/products/${r.item.slug}`);
      } else {
        const kind = classifyKind(r.item);
        const catParam = kind === "watch" ? "&category=watches" : kind === "jewelry" ? "&category=jewelry" : "";
        router.push(`/products?search=${encodeURIComponent(r.item.name)}${catParam}`);
      }

    } else if (r.type === "attr") {
      setQuery("");
      const catParam = WATCH_KINDS.has(r.match.kind) ? "&category=watches" : "";
      router.push(`/products?${r.match.param}=${encodeURIComponent(r.match.value)}${catParam}`);
    }
  }, [router]);

  // Free-text submit — detect watch brand names in the query
  const submit = useCallback((raw?: string) => {
    const q = (raw ?? query).trim();
    if (!q) return;
    setOpen(false);
    pushRecent(q);
    setRecent(getRecent());
    const catParam = isWatchQuery(q) ? "&category=watches" : "";
    router.push(`/products?search=${encodeURIComponent(q)}${catParam}`);
    setQuery("");
  }, [query, router]);

  const clearRecent = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (typeof window !== "undefined") window.localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }, []);

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
  const cats = results.filter((r) => r.type === "category");
  const subs = results.filter((r) => r.type === "subcategory");
  const prods = results.filter((r) => r.type === "product") as Extract<ResultItem, { type: "product" }>[];
  const attrs = results.filter((r) => r.type === "attr") as { type: "attr"; match: AttrMatch }[];

  const attrsByKind = attrs.reduce<Record<string, { type: "attr"; match: AttrMatch }[]>>((acc, r) => {
    const k = r.match.kind;
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  const hasQuery = query.trim().length > 0;
  const hasResults = results.length > 0;
  const isDesktop = variant === "desktop";

  const showCatCol = cats.length > 0 || subs.length > 0;
  const showProdCol = prods.length > 0 || loading;
  const showAttrCol = attrs.length > 0;
  const colCount = [showCatCol, showProdCol, showAttrCol].filter(Boolean).length || 1;

  const trendingCats = useMemo(() => (_cats ?? []).slice(0, 6), [open]);
  const showEmptyPanel = open && !hasQuery && (recent.length > 0 || trendingCats.length > 0);

  return (
    <>
      <style>{`
        .sb-wrap { position: relative; font-family: "Elms Sans", sans-serif; }
        .sb-input-row {
          display: flex; align-items: center; gap: 8px;
          background: #faf9ff; border: 1.5px solid #e2e0f0;
          border-radius: 10px; padding: 0 14px; height: 40px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .sb-input-row.mobile { height: 44px; }
        .sb-input-row.focused {
          border-color: #0f3460;
          box-shadow: 0 0 0 3px rgba(15,52,96,0.08);
          background: #fff;
        }
        .sb-input {
          flex: 1; border: none; background: transparent;
          font-family: "Elms Sans", sans-serif; font-size: 13px;
          color: #1a1a2e; outline: none; min-width: 0;
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
          border-radius: 4px; padding: 2px 6px; flex-shrink: 0;
          font-family: "Elms Sans", sans-serif; font-weight: 500;
          white-space: nowrap;
        }
        .sb-scrim {
          position: fixed; inset: 0; z-index: 9998;
          background: rgba(26,26,46,0.18); backdrop-filter: blur(2px);
          animation: sbFade .15s ease both;
        }
        @keyframes sbFade { from { opacity: 0; } to { opacity: 1; } }
        .sb-drawer {
          position: fixed; left: 2vw; right: 2vw;
          max-width: 1280px; margin-left: auto; margin-right: auto;
          background: #fff; border: 1px solid #e8e4f8;
          border-top: 3px solid #0f3460;
          border-radius: 0 0 16px 16px;
          box-shadow: 0 24px 80px rgba(79,70,229,0.13), 0 4px 20px rgba(0,0,0,0.07);
          z-index: 9999; overflow: hidden;
          animation: sbIn 0.16s cubic-bezier(.2,.7,.3,1) both;
        }
        @keyframes sbIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sb-body {
          max-height: 54vh; overflow-y: auto;
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
          font-family: "Elms Sans", sans-serif; position: sticky; top: 0;
          background: #fff; z-index: 2; border-bottom: 1px solid #f8f6ff;
        }
        .sb-sec-label:not(:first-child) { border-top: 1px solid #f0eeff; }
        .sb-sec-label .sb-clear-link {
          margin-left: auto; font-size: 10px; font-weight: 600; letter-spacing: 0;
          text-transform: none; color: #b0aecb; cursor: pointer; background: none; border: none;
        }
        .sb-sec-label .sb-clear-link:hover { color: #0f3460; text-decoration: underline; }
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
        .sb-icon.watch { background: linear-gradient(135deg,#fdf4ff,#e9d5ff); color:#7c3aed; overflow:hidden; }
        .sb-icon.watch img { width:100%; height:100%; object-fit:cover; }
        .sb-icon.jewelry { background: linear-gradient(135deg,#fff1f2,#fecdd3); color:#9f1239; overflow:hidden; }
        .sb-icon.jewelry img { width:100%; height:100%; object-fit:cover; }
        .sb-icon.gem { background: linear-gradient(135deg,#ecfeff,#a5f3fc); color:#155e75; overflow:hidden; }
        .sb-icon.gem img { width:100%; height:100%; object-fit:cover; }
        .sb-text { flex:1; min-width:0; }
        .sb-name {
          font-size: 13px; font-weight: 500; color: #1a1a2e;
          font-family: "Elms Sans", sans-serif;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sb-meta { font-size: 11px; color: #9f9fc0; font-family: "Elms Sans", sans-serif; margin-top:1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-mark { background: #fde68a; color: #1a1a2e; border-radius: 2px; padding: 0 1px; }
        .sb-badge {
          font-size: 9px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 2px 6px; border-radius: 4px;
          flex-shrink: 0;
        }
        .sb-badge.watch { background: #f3e8ff; color: #7c3aed; }
        .sb-badge.diamond { background: #dbeafe; color: #1d4ed8; }
        .sb-badge.jewelry { background: #ffe4e6; color: #9f1239; }
        .sb-badge.gem { background: #cffafe; color: #155e75; }
        .sb-arrow { color: #c4b5fd; flex-shrink:0; transition: color .15s, transform .15s; }
        .sb-row:hover .sb-arrow, .sb-row.active .sb-arrow { color: #0f3460; transform: translateX(2px); }
        .sb-attr-chips, .sb-chip-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px 10px; }
        .sb-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 20px; font-size: 12px;
          font-weight: 500; font-family: "Elms Sans", sans-serif;
          cursor: pointer; border: 1px solid transparent;
          transition: filter .15s, transform .1s; white-space: nowrap;
        }
        .sb-chip:hover { filter: brightness(0.93); transform: translateY(-1px); }
        .sb-chip.plain { background: #f5f3ff; color: #4c1d95; }
        .sb-chip.plain:hover { background: #ede9fe; }
        .sb-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 14px; border-top: 1px solid #f0eeff; background: #faf9ff;
        }
        .sb-hint { font-size: 11px; color: #b0aecb; font-family: "Elms Sans", sans-serif; }
        .sb-all {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; color: #0f3460;
          font-family: "Elms Sans", sans-serif; cursor: pointer;
          background: transparent; border: none; padding: 4px 8px;
          border-radius: 6px; transition: background .12s;
        }
        .sb-all:hover { background: #ede9fe; }
        .sb-empty { padding: 28px 20px; text-align: center; font-size: 13px; color: #9f9fc0; font-family: "Elms Sans", sans-serif; }
        .sb-empty strong { color: #1a1a2e; display: block; margin-bottom: 4px; font-size: 14px; }
        .sb-skel-row { display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
        .sb-skel { border-radius: 6px; background: linear-gradient(90deg,#f0eeff 25%,#f8f7ff 37%,#f0eeff 63%); background-size: 400% 100%; animation: sbShimmer 1.4s ease infinite; }
        @keyframes sbShimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

        /* Modern mobile treatment: stack columns instead of squeezing them side by side */
        @media (max-width: 720px) {
          .sb-drawer { left: 0; right: 0; border-radius: 0; max-height: 100vh; }
          .sb-body { grid-template-columns: 1fr !important; max-height: calc(100vh - 96px); }
          .sb-col + .sb-col { border-left: none; border-top: 1px solid #f0eeff; }
        }
      `}</style>

      <div
        ref={containerRef}
        className="sb-wrap"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-owns={open ? listboxId : undefined}
        style={{
          flex: isDesktop ? "1 1 auto" : undefined,
          maxWidth: isDesktop ? "340px" : undefined,
          minWidth: isDesktop ? "180px" : undefined,
          width: !isDesktop ? "100%" : undefined,
        }}
      >
        {/* ── Input row ── */}
        <div className={["sb-input-row", !isDesktop ? "mobile" : "", focused ? "focused" : ""].filter(Boolean).join(" ")}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
            style={{ color: focused ? "#0f3460" : "#9f9fc0", flexShrink: 0, transition: "color .2s" }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
            role="searchbox"
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
          />

          {query && (
            <button className="sb-clear" tabIndex={-1} aria-label="Clear search"
              onMouseDown={(e) => { e.preventDefault(); setQuery(""); setResults([]); inputRef.current?.focus(); }}>
              <IcoX />
            </button>
          )}
          {!query && isDesktop && <span className="sb-kbd">⌘K</span>}
        </div>

        {/* ── Drawer ── */}
        {open && !isDesktop && <div className="sb-scrim" onClick={() => { setOpen(false); setFocused(false); }} />}
        {open && (
          <div className="sb-drawer" style={{ top: drawerTop }} id={listboxId} role="listbox">
            {hasQuery && !hasResults && !loading ? (
              <div className="sb-empty">
                <strong>No results for &ldquo;{query}&rdquo;</strong>
                Try a gem name, carat weight (e.g. "0.35 carat"), shape, brand, or clarity grade
              </div>
            ) : !hasQuery ? (
              showEmptyPanel ? (
                <div className="sb-body" style={{ gridTemplateColumns: "1fr" }}>
                  {recent.length > 0 && (
                    <div className="sb-col">
                      <p className="sb-sec-label">
                        <IcoClock /> Recent searches
                        <button className="sb-clear-link" onMouseDown={clearRecent}>Clear</button>
                      </p>
                      <div className="sb-chip-row">
                        {recent.map((r) => (
                          <button key={r} className="sb-chip plain" onMouseDown={(e) => { e.preventDefault(); submit(r); }}>
                            <IcoClock /> {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {trendingCats.length > 0 && (
                    <div className="sb-col">
                      <p className="sb-sec-label"><IcoTrend /> Popular categories</p>
                      {trendingCats.map((cat) => (
                        <button key={cat._id} className="sb-row"
                          onMouseDown={(e) => { e.preventDefault(); go({ type: "category", item: cat }); }}>
                          <div className="sb-icon cat"><IcoGrid /></div>
                          <div className="sb-text">
                            <div className="sb-name">{cat.name}</div>
                            <div className="sb-meta">{cat.subcategories.length} subcategories</div>
                          </div>
                          <span className="sb-arrow"><IcoArrow /></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sb-empty">
                  <strong>Start typing to search</strong>
                  Gems, carat weights, shapes, watch brands, clarity grades, and more
                </div>
              )
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
                              <button key={cat._id} id={`${listboxId}-opt-${idx}`} role="option" aria-selected={activeIdx === idx}
                                className={`sb-row${activeIdx === idx ? " active" : ""}`}
                                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                                onMouseEnter={() => setActiveIdx(idx)}>
                                <div className="sb-icon cat"><IcoGrid /></div>
                                <div className="sb-text">
                                  <div className="sb-name"><Hi text={cat.name} q={query} /></div>
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
                              <button key={sub.item._id} id={`${listboxId}-opt-${idx}`} role="option" aria-selected={activeIdx === idx}
                                className={`sb-row${activeIdx === idx ? " active" : ""}`}
                                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                                onMouseEnter={() => setActiveIdx(idx)}>
                                <div className="sb-icon sub"><IcoTag /></div>
                                <div className="sb-text">
                                  <div className="sb-name"><Hi text={sub.item.name} q={query} /></div>
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
                        const idx = results.indexOf(r);
                        const prod = r.item;
                        const img = prod.images?.[0] ?? prod.image ?? null;
                        const kind = classifyKind(prod);
                        const meta = kindMeta(kind);
                        const catName = typeof prod.category === "object" ? prod.category?.name : prod.category;
                        const matchNote =
                          r.matchedField === "brand" ? `Brand: ${r.matchedOn}` :
                          r.matchedField === "model" ? `Model: ${r.matchedOn}` :
                          r.matchedField === "gem" ? `Stone: ${r.matchedOn}` :
                          r.matchedField === "sku" ? `SKU: ${r.matchedOn}` :
                          r.matchedField === "carat" ? `Carat: ${r.matchedOn}` : null;
                        return (
                          <button key={prod._id} id={`${listboxId}-opt-${idx}`} role="option" aria-selected={activeIdx === idx}
                            className={`sb-row${activeIdx === idx ? " active" : ""}`}
                            onMouseDown={(e) => { e.preventDefault(); go(r); }}
                            onMouseEnter={() => setActiveIdx(idx)}>
                            <div className={`sb-icon ${meta.iconClass}`}>
                              {img ? <img src={img} alt={prod.name} loading="lazy" /> : meta.icon}
                            </div>
                            <div className="sb-text">
                              <div className="sb-name"><Hi text={prod.name} q={query} /></div>
                              <div className="sb-meta">
                                {matchNote ?? (
                                  <>
                                    {prod.price != null && `$${prod.price.toLocaleString()}`}
                                    {catName && prod.price != null && " · "}{catName}
                                  </>
                                )}
                              </div>
                            </div>
                            <span className={`sb-badge ${meta.badgeClass}`}>{meta.label}</span>
                            <span className="sb-arrow"><IcoArrow /></span>
                          </button>
                        );
                      })}
                      {loading && prods.length === 0 && (
                        <>
                          {[0, 1, 2].map((i) => (
                            <div className="sb-skel-row" key={i}>
                              <div className="sb-skel" style={{ width: 28, height: 28 }} />
                              <div style={{ flex: 1 }}>
                                <div className="sb-skel" style={{ width: "70%", height: 10, marginBottom: 6 }} />
                                <div className="sb-skel" style={{ width: "40%", height: 8 }} />
                              </div>
                            </div>
                          ))}
                        </>
                      )}
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
                              color: "#b0aecb", fontFamily: '"Elms Sans", sans-serif',
                            }}>
                              {KIND_LABELS[k]}
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
                                  <Hi text={r.match.label} q={query} />
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