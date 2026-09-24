"use client";

/**
 * CompleteSourceClient — homepage "Your complete gemstone source" section
 * with a full product finder.
 *
 * Top: the gem ruler (real cuts at relative scale, ½ mm → 20 mm). Each stone
 * is a button: tapping it shops that shape in that size range.
 * Below: a finder over the WHOLE catalogue — text search, category tabs,
 * shape and color pickers, and an "All filters" panel (gem type, size in mm
 * or carats, price, grade, wholesale lots). Every option shows a live count.
 * Results load 12 at a time with "Show more".
 *
 * Data comes from /api/products/finder (src/lib/finder.ts).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FacetValue, FinderProduct, FinderResult, FinderSort } from "@/lib/finder";
import { gemOutline } from "./gemShapes";

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  initial: FinderResult | null;
  shopGemstonesHref?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const RULER: { mm: number; shape: string; color: string; name: string }[] = [
  { mm: 0.5, shape: "round",    color: "#E6ECF7", name: "Diamond melee" },
  { mm: 1,   shape: "round",    color: "#E6ECF7", name: "Diamond melee" },
  { mm: 1.5, shape: "round",    color: "#E6ECF7", name: "Diamond" },
  { mm: 2,   shape: "round",    color: "#3F6FE2", name: "Sapphire" },
  { mm: 3,   shape: "round",    color: "#D2344F", name: "Ruby" },
  { mm: 4,   shape: "princess", color: "#E6ECF7", name: "Diamond" },
  { mm: 5,   shape: "heart",    color: "#E98BB2", name: "Pink sapphire" },
  { mm: 6,   shape: "trillion", color: "#9DC940", name: "Peridot" },
  { mm: 7,   shape: "oval",     color: "#6C5BD8", name: "Tanzanite" },
  { mm: 8,   shape: "cushion",  color: "#E8AA2C", name: "Citrine" },
  { mm: 10,  shape: "pear",     color: "#7CCFE0", name: "Aquamarine" },
  { mm: 12,  shape: "emerald",  color: "#1F9B69", name: "Emerald" },
  { mm: 14,  shape: "marquise", color: "#9463D1", name: "Amethyst" },
  { mm: 17,  shape: "oval",     color: "#C23B4B", name: "Rubellite" },
  { mm: 20,  shape: "cushion",  color: "#2F57C4", name: "Sapphire" },
];
const TICKS = [0.5, 2, 5, 10, 20];

const SWATCH: Record<string, string> = {
  red: "radial-gradient(circle at 35% 30%, #ff8a9a, #c01f3c 60%, #7d0f24)",
  pink: "radial-gradient(circle at 35% 30%, #ffd0e2, #e883ad 60%, #b24a7a)",
  orange: "radial-gradient(circle at 35% 30%, #ffc995, #ee7b2c 60%, #a8480f)",
  yellow: "radial-gradient(circle at 35% 30%, #fff1a8, #e8b52c 60%, #a87708)",
  green: "radial-gradient(circle at 35% 30%, #a6f0c6, #1f9b69 60%, #0c5a3b)",
  blue: "radial-gradient(circle at 35% 30%, #a9c6ff, #2f5fd8 60%, #15307c)",
  purple: "radial-gradient(circle at 35% 30%, #dcc2ff, #8a55d0 60%, #4d2587)",
  white: "radial-gradient(circle at 35% 30%, #ffffff, #dfe6f2 60%, #aab6cc)",
  black: "radial-gradient(circle at 35% 30%, #8a8f9c, #3a3e48 60%, #111318)",
  brown: "radial-gradient(circle at 35% 30%, #e8b98a, #9a5b2c 60%, #56300f)",
  multi: "conic-gradient(#e0405a, #ee9b2c, #e8d12c, #3fb36b, #2f7fe0, #8a55d0, #e0405a)",
};

const CATEGORY_ORDER = [/^diamonds?$/i, /alternative/i, /^precious/i, /^semi/i, /^jewel/i, /^watch/i];

const SORT_LABEL: Record<FinderSort, string> = {
  relevance: "Best match",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  size_desc: "Carat: high to low",
  size_asc: "Carat: low to high",
};

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under $25", max: 25 },
  { label: "$25–$100", min: 25, max: 100 },
  { label: "$100–$500", min: 100, max: 500 },
  { label: "$500–$2,500", min: 500, max: 2500 },
  { label: "$2,500+", min: 2500 },
];
const MM_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Melee, up to 2 mm", max: 2 },
  { label: "2–4 mm", min: 2, max: 4 },
  { label: "4–6 mm", min: 4, max: 6 },
  { label: "6–9 mm", min: 6, max: 9 },
  { label: "9–13 mm", min: 9, max: 13 },
  { label: "13 mm+", min: 13 },
];
const CT_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under 0.5 ct", max: 0.5 },
  { label: "0.5–1 ct", min: 0.5, max: 1 },
  { label: "1–3 ct", min: 1, max: 3 },
  { label: "3–10 ct", min: 3, max: 10 },
  { label: "10 ct+", min: 10 },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const int = new Intl.NumberFormat("en-US");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const productHref = (p: FinderProduct) => `/products/${p.slug || p._id}`;

// ─── Filter state ────────────────────────────────────────────────────────────
interface Filters {
  q: string;
  category: string | null;
  lots: boolean;
  gems: string[];
  shapes: string[];
  colors: string[];
  grades: string[];
  unit: "mm" | "ct";
  sizeMin: string;
  sizeMax: string;
  priceMin: string;
  priceMax: string;
  sort: FinderSort | "";
}

const EMPTY: Filters = {
  q: "", category: null, lots: false, gems: [], shapes: [], colors: [], grades: [],
  unit: "mm", sizeMin: "", sizeMax: "", priceMin: "", priceMax: "", sort: "",
};

function toQuery(f: Filters, page: number): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.category) sp.set("category", f.category);
  if (f.lots) sp.set("lots", "1");
  if (f.gems.length) sp.set("gems", f.gems.join(","));
  if (f.shapes.length) sp.set("shapes", f.shapes.join(","));
  if (f.colors.length) sp.set("colors", f.colors.join(","));
  if (f.grades.length) sp.set("grades", f.grades.join(","));
  const pre = f.unit === "mm" ? "mm" : "ct";
  if (f.sizeMin) sp.set(`${pre}Min`, f.sizeMin);
  if (f.sizeMax) sp.set(`${pre}Max`, f.sizeMax);
  if (f.priceMin) sp.set("priceMin", f.priceMin);
  if (f.priceMax) sp.set("priceMax", f.priceMax);
  if (f.sort) sp.set("sort", f.sort);
  sp.set("page", String(page));
  sp.set("limit", String(PAGE_SIZE));
  return sp.toString();
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// ─── Small pieces ────────────────────────────────────────────────────────────
function GemIcon({ shape, size = 26, color = "currentColor" }: { shape: string; size?: number; color?: string }) {
  const o = gemOutline(shape, size - 4);
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true">
      <path d={o.d} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={o.d} transform="scale(0.5)" fill="none" stroke={color} strokeWidth={1.6} opacity={0.55} />
    </svg>
  );
}

function Sep() {
  return (
    <svg className="cs-sep" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M5 0L10 5L5 10L0 5Z" />
    </svg>
  );
}

function GemRuler({ onPick }: { onPick: (shape: string, mm: number, name: string) => void }) {
  const layout = useMemo(() => {
    const PX = 4.4, GAP = 15;
    let x = 0;
    const items = RULER.map((g) => {
      const o = gemOutline(g.shape, Math.max(g.mm * PX, 2.2));
      const cx = x + o.w / 2;
      x += o.w + GAP;
      return { ...g, ...o, cx };
    });
    return { items, width: x - GAP, maxH: Math.max(...items.map((i) => i.h)) };
  }, []);
  const { items, width, maxH } = layout;
  const axisY = maxH / 2 + 12;

  return (
    <figure className="cs-ruler">
      <svg viewBox={`-6 ${-maxH / 2 - 6} ${width + 12} ${axisY + 28 + maxH / 2}`}>
        {items.map((g, i) => (
          <g key={i} transform={`translate(${g.cx.toFixed(2)},0)`}>
            <g
              className="cs-gem"
              style={{ animationDelay: `${i * 55}ms` }}
              role="button"
              tabIndex={0}
              aria-label={`Shop ${g.shape} stones around ${g.mm} mm`}
              onClick={() => onPick(g.shape, g.mm, g.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(g.shape, g.mm, g.name);
                }
              }}
            >
              <title>{`${g.name} · ${g.shape} · ${g.mm} mm — tap to shop this size`}</title>
              {/* generous invisible hit area so even the ½ mm dot is tappable */}
              <rect x={-Math.max(g.w, 16) / 2} y={-maxH / 2} width={Math.max(g.w, 16)} height={maxH} fill="transparent" />
              <path d={g.d} fill={g.color} stroke="rgba(8,14,40,0.55)" strokeWidth={0.6} />
              {g.mm >= 2 && (
                <path d={g.d} transform="scale(0.52)" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth={0.8} />
              )}
            </g>
          </g>
        ))}
        <line x1={0} x2={width} y1={axisY} y2={axisY} stroke="rgba(226,232,246,0.28)" strokeWidth={1} />
        {items.map((g, i) =>
          TICKS.includes(g.mm) ? (
            <g key={`t${i}`} className={g.mm === 2 ? "cs-tick-minor" : undefined}>
              <line x1={g.cx} x2={g.cx} y1={axisY - 4} y2={axisY + 4} stroke="rgba(226,232,246,0.5)" strokeWidth={1} />
              <text x={g.cx} y={axisY + 17} textAnchor="middle" className="cs-tick">
                {g.mm === 0.5 ? "½ mm" : `${g.mm} mm`}
              </text>
            </g>
          ) : null,
        )}
      </svg>
      <figcaption className="cs-ruler-cap">Shown at relative size. Tap a stone to shop that shape and size.</figcaption>
    </figure>
  );
}

function ProductCard({ p }: { p: FinderProduct }) {
  const [imgFailed, setImgFailed] = useState(false);
  const specs = [
    p.shape?.[0] && p.shape[0] !== "other" ? cap(p.shape[0]) : null,
    p.mm ? `${p.mm} mm` : null,
    p.carat ? `${p.carat} ct` : null,
    p.grade || null,
  ].filter(Boolean);
  return (
    <li className="cs-card">
      <Link href={productHref(p)} className="cs-card-link">
        <span className="cs-card-img">
          {p.image && !imgFailed ? (
            <img src={p.image} alt="" loading="lazy" decoding="async" onError={() => setImgFailed(true)} />
          ) : (
            <GemIcon shape={p.shape?.[0] ?? "round"} size={34} color="#B9C0D4" />
          )}
        </span>
        <span className="cs-card-body">
          {p.gemstoneName && <span className="cs-card-gem">{p.gemstoneName}</span>}
          <span className="cs-card-name">{p.name}</span>
          {specs.length > 0 && <span className="cs-card-specs">{specs.join(" · ")}</span>}
          <span className="cs-card-price">{p.price != null ? usd.format(p.price) : "Price on request"}</span>
        </span>
      </Link>
    </li>
  );
}

function CheckList({
  items, selected, onToggle, emptyText,
}: { items: FacetValue[]; selected: string[]; onToggle: (v: string) => void; emptyText: string }) {
  if (items.length === 0) return <p className="cs-muted-sm">{emptyText}</p>;
  return (
    <ul className="cs-checklist">
      {items.map((it) => (
        <li key={it.value}>
          <label className={it.count === 0 && !selected.includes(it.value) ? "is-empty" : undefined}>
            <input type="checkbox" checked={selected.includes(it.value)} onChange={() => onToggle(it.value)} />
            <span className="cs-check-label">{it.label}</span>
            <span className="cs-check-count">{int.format(it.count)}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function CompleteSourceClient({ initial, shopGemstonesHref = "/products/gemstones" }: Props) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [data, setData] = useState<FinderResult | null>(initial);
  const [products, setProducts] = useState<FinderProduct[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "more" | "error">(initial ? "idle" : "loading");
  const [panelOpen, setPanelOpen] = useState(false);
  const [gemQuery, setGemQuery] = useState("");
  const finderRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef<AbortController | null>(null);
  // Shorter search placeholder on phones (set after mount, so SSR markup matches).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const baseQuery = useMemo(() => toQuery(f, 1), [f]);

  /** Products are listed only once the visitor searches or picks a filter. */
  const searching =
    f.q.trim().length >= 2 || !!f.category || f.lots || f.gems.length > 0 || f.shapes.length > 0 ||
    f.colors.length > 0 || f.grades.length > 0 || !!f.sizeMin || !!f.sizeMax || !!f.priceMin || !!f.priceMax;

  const load = useCallback(async (query: string, append: boolean) => {
    reqRef.current?.abort();
    const ctrl = new AbortController();
    reqRef.current = ctrl;
    setStatus(append ? "more" : "loading");
    try {
      const res = await fetch(`/api/products/finder?${query}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const json: FinderResult = await res.json();
      setData(json);
      setProducts((prev) => {
        if (!append) return json.products;
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...json.products.filter((p) => !seen.has(p._id))];
      });
      setStatus("idle");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setStatus("error");
    }
  }, []);

  // Refetch page 1 whenever filters change (debounced for typing). With no
  // search or filter active, nothing is listed: the server-rendered counts
  // are reused and no request is made.
  useEffect(() => {
    setPage(1);
    if (!searching && initial) {
      reqRef.current?.abort();
      setData(initial);
      setProducts([]);
      setStatus("idle");
      return;
    }
    const t = setTimeout(() => load(baseQuery, false), 250);
    return () => clearTimeout(t);
  }, [baseQuery, searching, load, initial]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(toQuery(f, next), true);
  };

  const scrollToFinder = () =>
    finderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const pickFromRuler = (shape: string, mm: number) => {
    const min = mm <= 1 ? 0 : Math.round(mm * 0.8 * 10) / 10;
    const max = mm <= 1 ? 1.2 : Math.round(mm * 1.2 * 10) / 10;
    setF({ ...EMPTY, shapes: [shape], unit: "mm", sizeMin: String(min), sizeMax: String(max) });
    scrollToFinder();
  };

  // ── Derived facet views ──
  const facets = data?.facets;
  const categories = useMemo(() => {
    const cats = (facets?.categories ?? []).filter((c) => !/voucher|gift card/i.test(c.label));
    const rank = (label: string) => {
      const i = CATEGORY_ORDER.findIndex((rx) => rx.test(label));
      return i === -1 ? 99 : i;
    };
    return [...cats].sort((a, b) => rank(a.label) - rank(b.label) || b.count - a.count);
  }, [facets?.categories]);
  // Includes hidden categories (e.g. vouchers) so it always equals the unfiltered total.
  const allCount = (facets?.categories ?? []).reduce((s, c) => s + c.count, 0);

  const gemList = useMemo(() => {
    const list = facets?.gems ?? [];
    const needle = gemQuery.trim().toLowerCase();
    const filtered = needle ? list.filter((g) => g.label.toLowerCase().includes(needle)) : list;
    const selectedMissing = f.gems
      .filter((g) => !filtered.some((x) => x.value === g))
      .map((g) => ({ value: g, label: g, count: 0 }));
    return [...selectedMissing, ...filtered];
  }, [facets?.gems, gemQuery, f.gems]);

  const sizePresets = f.unit === "mm" ? MM_PRESETS : CT_PRESETS;
  const sizeUnitLabel = f.unit === "mm" ? "mm" : "ct";

  // ── Active filter pills ──
  const pills: { key: string; label: string; clear: () => void }[] = [];
  if (f.q.trim()) pills.push({ key: "q", label: `“${f.q.trim()}”`, clear: () => set("q", "") });
  if (f.category) {
    const c = categories.find((x) => x.value === f.category);
    pills.push({ key: "cat", label: c?.label ?? "Category", clear: () => set("category", null) });
  }
  if (f.lots) pills.push({ key: "lots", label: "Wholesale lots", clear: () => set("lots", false) });
  f.shapes.forEach((s) => pills.push({ key: `s-${s}`, label: cap(s), clear: () => set("shapes", f.shapes.filter((x) => x !== s)) }));
  f.colors.forEach((c) => {
    const label = facets?.colors.find((x) => x.value === c)?.label ?? c;
    pills.push({ key: `c-${c}`, label, clear: () => set("colors", f.colors.filter((x) => x !== c)) });
  });
  f.gems.forEach((g) => pills.push({ key: `g-${g}`, label: g, clear: () => set("gems", f.gems.filter((x) => x !== g)) }));
  f.grades.forEach((g) => pills.push({ key: `gr-${g}`, label: `Grade ${g}`, clear: () => set("grades", f.grades.filter((x) => x !== g)) }));
  if (f.sizeMin || f.sizeMax) {
    const label = f.sizeMin && f.sizeMax ? `${f.sizeMin}–${f.sizeMax} ${sizeUnitLabel}`
      : f.sizeMin ? `${f.sizeMin} ${sizeUnitLabel}+` : `Up to ${f.sizeMax} ${sizeUnitLabel}`;
    pills.push({ key: "size", label, clear: () => setF((p) => ({ ...p, sizeMin: "", sizeMax: "" })) });
  }
  if (f.priceMin || f.priceMax) {
    const label = f.priceMin && f.priceMax ? `${usd.format(+f.priceMin)}–${usd.format(+f.priceMax)}`
      : f.priceMin ? `${usd.format(+f.priceMin)}+` : `Under ${usd.format(+f.priceMax)}`;
    pills.push({ key: "price", label, clear: () => setF((p) => ({ ...p, priceMin: "", priceMax: "" })) });
  }
  const panelFilterCount = f.gems.length + f.grades.length + (f.sizeMin || f.sizeMax ? 1 : 0) + (f.priceMin || f.priceMax ? 1 : 0);

  const total = data?.total ?? 0;
  const busy = status === "loading";
  const hasMore = products.length < total;

  return (
    <section className="cs" aria-labelledby="cs-title">
      <style>{CSS}</style>

      {/* ═════════ Hero ═════════ */}
      <div className="cs-hero">
        <div className="cs-hero-inner">
          <GemRuler onPick={pickFromRuler} />

          <h1 id="cs-title" className="cs-title">
            <span className="cs-brand">Alpha Gemstone</span>
            <span className="cs-headline">Your complete gemstone source</span>
          </h1>

          <p className="cs-tagline">
            {["Any gem", "Any size", "Any shape", "One source"].map((t, i) => (
              <span key={t} className="cs-tag-item">
                {i > 0 && <Sep />}
                {t}
              </span>
            ))}
          </p>

          <p className="cs-sub">
            From ½&nbsp;mm melee to rare collector gemstones — virtually every color, shape, size and price point.
          </p>

          <div className="cs-actions">
            <Link href={shopGemstonesHref} className="cs-btn cs-btn--primary">Shop gemstones</Link>
            <button type="button" className="cs-btn" onClick={() => { setPanelOpen(true); scrollToFinder(); }}>
              Advanced search
            </button>
            <button type="button" className="cs-btn" onClick={() => { setF({ ...EMPTY, lots: true }); scrollToFinder(); }}>
              Wholesale deals
            </button>
          </div>

          <p className="cs-since">Serving jewelers, designers, collectors &amp; gemstone buyers since 1988</p>
        </div>
      </div>

      {/* ═════════ Finder ═════════ */}
      <div className="cs-finder-wrap">
        <div className="cs-finder" ref={finderRef}>
          {/* Search + sort */}
          <div className="cs-searchrow">
            <label className="cs-field">
              <svg className="cs-field-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={f.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder={
                  allCount > 1000
                    ? `Search ${int.format(Math.floor(allCount / 100) * 100)}+ items${narrow ? "" : ": gem, shape, size, SKU…"}`
                    : "Search by gem, shape, size or SKU"
                }
                aria-label="Search all products"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className={`cs-filters-btn${panelOpen ? " is-open" : ""}`}
              aria-expanded={panelOpen}
              aria-controls="cs-panel"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              All filters
              {panelFilterCount > 0 && <span className="cs-badge">{panelFilterCount}</span>}
            </button>
          </div>

          {/* Category tabs */}
          <div className="cs-tabs" role="group" aria-label="Category">
            <button type="button" className="cs-tab" aria-pressed={!f.category && !f.lots}
              onClick={() => setF((p) => ({ ...p, category: null, lots: false }))}>
              All <span>{int.format(allCount)}</span>
            </button>
            {categories.map((c) => (
              <button key={c.value} type="button" className="cs-tab" aria-pressed={f.category === c.value}
                onClick={() => setF((p) => ({ ...p, category: p.category === c.value ? null : c.value }))}>
                {c.label} <span>{int.format(c.count)}</span>
              </button>
            ))}
            <button type="button" className="cs-tab cs-tab--lots" aria-pressed={f.lots}
              onClick={() => set("lots", !f.lots)}>
              Wholesale lots <span>{int.format(facets?.lots ?? 0)}</span>
            </button>
          </div>

          {/* Shapes */}
          {(facets?.shapes.length ?? 0) > 0 && (
            <div className="cs-row">
              <p className="cs-row-label">Shape</p>
              <div className="cs-shapes" role="group" aria-label="Shape">
                {facets!.shapes.map((s) => {
                  const on = f.shapes.includes(s.value);
                  return (
                    <button key={s.value} type="button" className="cs-shape" aria-pressed={on}
                      disabled={s.count === 0 && !on}
                      onClick={() => set("shapes", toggle(f.shapes, s.value))}>
                      <GemIcon shape={s.value} size={30} />
                      <span className="cs-shape-name">{cap(s.label)}</span>
                      <span className="cs-shape-count">{int.format(s.count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Colors */}
          {facets && (
            <div className="cs-row">
              <p className="cs-row-label">Color</p>
              <div className="cs-colors" role="group" aria-label="Color">
                {facets.colors.map((c) => {
                  const on = f.colors.includes(c.value);
                  return (
                    <button key={c.value} type="button" className="cs-color" aria-pressed={on}
                      disabled={c.count === 0 && !on}
                      aria-label={`${c.label}, ${int.format(c.count)} items`}
                      onClick={() => set("colors", toggle(f.colors, c.value))}>
                      <span className="cs-swatch" style={{ background: SWATCH[c.value] }} />
                      <span className="cs-color-name">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All-filters panel */}
          {panelOpen && (
            <div id="cs-panel" className="cs-panel">
              <div className="cs-panel-col">
                <p className="cs-panel-title">Gem type</p>
                <input className="cs-mini-input" type="search" placeholder="Find a gem…" value={gemQuery}
                  onChange={(e) => setGemQuery(e.target.value)} aria-label="Find a gem type" />
                <CheckList items={gemList} selected={f.gems} emptyText="No gem types match."
                  onToggle={(v) => set("gems", toggle(f.gems, v))} />
              </div>

              <div className="cs-panel-col">
                <p className="cs-panel-title">Size</p>
                <div className="cs-seg" role="group" aria-label="Size unit">
                  {(["mm", "ct"] as const).map((u) => (
                    <button key={u} type="button" aria-pressed={f.unit === u}
                      onClick={() => setF((p) => ({ ...p, unit: u, sizeMin: "", sizeMax: "" }))}>
                      {u === "mm" ? "Millimeters" : "Carats"}
                    </button>
                  ))}
                </div>
                <div className="cs-presets">
                  {sizePresets.map((pr) => {
                    const on = f.sizeMin === (pr.min?.toString() ?? "") && f.sizeMax === (pr.max?.toString() ?? "");
                    return (
                      <button key={pr.label} type="button" className="cs-preset" aria-pressed={on}
                        onClick={() => setF((p) => on ? { ...p, sizeMin: "", sizeMax: "" }
                          : { ...p, sizeMin: pr.min?.toString() ?? "", sizeMax: pr.max?.toString() ?? "" })}>
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
                <div className="cs-range">
                  <label>Min<input inputMode="decimal" value={f.sizeMin} placeholder="0"
                    onChange={(e) => set("sizeMin", e.target.value.replace(/[^\d.]/g, ""))} /><span>{sizeUnitLabel}</span></label>
                  <label>Max<input inputMode="decimal" value={f.sizeMax} placeholder="Any"
                    onChange={(e) => set("sizeMax", e.target.value.replace(/[^\d.]/g, ""))} /><span>{sizeUnitLabel}</span></label>
                </div>
              </div>

              <div className="cs-panel-col">
                <p className="cs-panel-title">Price</p>
                <div className="cs-presets">
                  {PRICE_PRESETS.map((pr) => {
                    const on = f.priceMin === (pr.min?.toString() ?? "") && f.priceMax === (pr.max?.toString() ?? "");
                    return (
                      <button key={pr.label} type="button" className="cs-preset" aria-pressed={on}
                        onClick={() => setF((p) => on ? { ...p, priceMin: "", priceMax: "" }
                          : { ...p, priceMin: pr.min?.toString() ?? "", priceMax: pr.max?.toString() ?? "" })}>
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
                <div className="cs-range">
                  <label>Min<span className="cs-pre">$</span><input inputMode="decimal" value={f.priceMin} placeholder="0"
                    onChange={(e) => set("priceMin", e.target.value.replace(/[^\d.]/g, ""))} /></label>
                  <label>Max<span className="cs-pre">$</span><input inputMode="decimal" value={f.priceMax} placeholder="Any"
                    onChange={(e) => set("priceMax", e.target.value.replace(/[^\d.]/g, ""))} /></label>
                </div>
              </div>

              <div className="cs-panel-col">
                <p className="cs-panel-title">Grade</p>
                <CheckList items={facets?.grades ?? []} selected={f.grades} emptyText="No grades for this selection."
                  onToggle={(v) => set("grades", toggle(f.grades, v))} />
              </div>

              <div className="cs-panel-foot">
                <button type="button" className="cs-link-btn" onClick={() => setF((p) => ({ ...EMPTY, q: p.q }))}>
                  Reset filters
                </button>
                <button type="button" className="cs-show-btn" onClick={() => setPanelOpen(false)}>
                  {searching ? `Show ${int.format(total)} ${total === 1 ? "result" : "results"}` : "Close"}
                </button>
              </div>
            </div>
          )}

          {!searching ? (
            <p className="cs-hint">
              Type a gem, shape, size or SKU above, or choose a category, shape or color, to see matching products.
            </p>
          ) : (
          <>
          {/* Status bar */}
          <div className="cs-status">
            <p className="cs-count" aria-live="polite">
              <strong>{int.format(total)}</strong> {total === 1 ? "match" : "matches"}
              {busy && <span className="cs-spinner" aria-hidden="true" />}
            </p>
            <label className="cs-sort">
              Sort
              <select value={f.sort || (f.q.trim() ? "relevance" : "newest")}
                onChange={(e) => set("sort", e.target.value as FinderSort)}>
                {(Object.keys(SORT_LABEL) as FinderSort[])
                  .filter((s) => s !== "relevance" || f.q.trim())
                  .map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
              </select>
            </label>
          </div>

          {pills.length > 0 && (
            <div className="cs-pills">
              {pills.map((p) => (
                <button key={p.key} type="button" className="cs-pill" onClick={p.clear} aria-label={`Remove filter ${p.label}`}>
                  {p.label}
                  <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
              ))}
              <button type="button" className="cs-link-btn" onClick={() => setF(EMPTY)}>Clear all</button>
            </div>
          )}

          {/* Results */}
          {status === "error" && products.length === 0 ? (
            <div className="cs-empty">
              <p>Results couldn’t load. Check your connection, then try again.</p>
              <button type="button" className="cs-show-btn" onClick={() => load(baseQuery, false)}>Try again</button>
            </div>
          ) : !busy && total === 0 && data ? (
            <div className="cs-empty">
              <p>No products match all of these filters. Remove one to widen the search.</p>
              <button type="button" className="cs-show-btn" onClick={() => setF(EMPTY)}>Clear all filters</button>
            </div>
          ) : (
            <ul className={`cs-grid${busy ? " is-busy" : ""}`}>
              {products.length === 0 && busy
                ? Array.from({ length: 8 }, (_, i) => <li key={i} className="cs-card cs-skel" />)
                : products.map((p) => <ProductCard key={p._id} p={p} />)}
            </ul>
          )}

          {hasMore && products.length > 0 && (
            <div className="cs-more">
              <button type="button" className="cs-more-btn" onClick={loadMore} disabled={status === "more"}>
                {status === "more" ? "Loading…" : `Show ${Math.min(PAGE_SIZE, total - products.length)} more`}
              </button>
              <p className="cs-muted-sm">
                Showing {int.format(products.length)} of {int.format(total)}
              </p>
            </div>
          )}
          {status === "error" && products.length > 0 && (
            <p className="cs-muted-sm cs-center">More results couldn’t load. <button type="button" className="cs-link-btn" onClick={loadMore}>Try again</button></p>
          )}
          </>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Styles (scoped by the .cs prefix) ───────────────────────────────────────
const CSS = `
.cs {
  --navy: #0E1A40; --navy-2: #16275C; --ink: #141A33; --ink-2: #4B5270; --ink-3: #7A8199;
  --line: #E4E7EF; --paper: #F4F5F9; --gold: #C9A84C; --gold-2: #E2C878; --gold-ink: #7A5E17;
  --on-navy: #F2F4FA; --on-navy-2: rgba(226,232,246,0.72); --on-navy-3: rgba(226,232,246,0.5);
  font-family: "Elms Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--paper); color: var(--ink);
}
.cs :where(button, input, select) { font: inherit; }

/* ── Hero ── */
.cs-hero { background: linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%); color: var(--on-navy);
  padding: clamp(40px, 6vw, 68px) 20px 120px; }
.cs-hero-inner { max-width: 980px; margin: 0 auto; text-align: center; }
.cs-ruler { margin: 0 auto 26px; max-width: 720px; }
.cs-ruler svg { display: block; width: 100%; height: auto; overflow: visible; }
.cs-tick { font-size: 11px; fill: rgba(226,232,246,0.62); font-family: inherit; }
.cs-ruler-cap { margin-top: 2px; font-size: 12px; color: var(--on-navy-3); }
.cs-gem { transform-box: fill-box; transform-origin: center; cursor: pointer; outline: none;
  animation: cs-pop 520ms cubic-bezier(.2,.8,.2,1) both; transition: transform 180ms ease, filter 180ms ease; }
.cs-gem:hover, .cs-gem:focus-visible { transform: translateY(-4px) scale(1.12); filter: drop-shadow(0 6px 10px rgba(0,0,0,0.45)); }
.cs-gem:focus-visible path:first-of-type { stroke: var(--gold-2); stroke-width: 2px; }
@keyframes cs-pop { from { opacity: 0; transform: scale(0.35); } to { opacity: 1; transform: scale(1); } }

.cs-title { margin: 0; display: flex; flex-direction: column; gap: 6px; color: var(--on-navy); letter-spacing: normal; }
.cs-brand { font-size: 15px; font-weight: 600; color: var(--gold-2); letter-spacing: 0.04em; }
.cs-headline { color: var(--on-navy); font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600;
  font-size: clamp(36px, 5.6vw, 64px); line-height: 1.04; letter-spacing: -0.01em; }
.cs-tagline { margin: 14px 0 0; font-size: clamp(15px, 1.9vw, 19px); font-weight: 600; letter-spacing: 0.02em;
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 12px; }
.cs-tag-item { display: inline-flex; align-items: center; gap: 12px; white-space: nowrap; }
.cs-sep { width: 7px; height: 7px; fill: var(--gold); }
.cs-sub { margin: 10px auto 0; max-width: 56ch; font-size: 15.5px; line-height: 1.6; color: var(--on-navy-2); }
.cs-actions { margin: 28px 0 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.cs-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 190px; padding: 14px 24px;
  border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--on-navy); background: transparent; text-decoration: none; cursor: pointer;
  border: 1px solid rgba(226,232,246,0.4); transition: border-color 160ms, color 160ms, background-color 160ms; }
.cs-btn:hover { border-color: var(--gold-2); color: var(--gold-2); }
.cs-btn--primary { background: var(--gold); border-color: var(--gold); color: #151B36; }
.cs-btn--primary:hover { background: var(--gold-2); border-color: var(--gold-2); color: #151B36; }
.cs-since { margin: 22px 0 0; font-size: 14px; color: var(--on-navy-2); }

/* ── Finder card ── */
.cs-finder-wrap { padding: 0 16px clamp(40px, 5vw, 64px); }
.cs-finder { position: relative; max-width: 1240px; margin: -84px auto 0; background: #fff; border-radius: 18px;
  padding: clamp(16px, 2.4vw, 28px); box-shadow: 0 24px 60px rgba(14,26,64,0.18), 0 2px 6px rgba(14,26,64,0.06);
  scroll-margin-top: 90px; }

.cs-searchrow { display: flex; gap: 10px; }
.cs-field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; border: 1.5px solid var(--line);
  border-radius: 12px; padding: 0 16px; background: #fff; transition: border-color 160ms, box-shadow 160ms; }
.cs-field:focus-within { border-color: var(--gold); box-shadow: 0 0 0 4px rgba(201,168,76,0.18); }
.cs-field-icon { width: 20px; height: 20px; color: var(--ink-3); flex: none; }
.cs-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px;
  color: var(--ink); padding: 15px 0; }
.cs-field input::placeholder { color: var(--ink-3); }
.cs-filters-btn { flex: none; display: inline-flex; align-items: center; gap: 8px; padding: 0 18px; border-radius: 12px;
  border: 1.5px solid var(--line); background: #fff; color: var(--ink); font-weight: 600; font-size: 15px; cursor: pointer; }
.cs-filters-btn svg { width: 18px; height: 18px; }
.cs-filters-btn:hover, .cs-filters-btn.is-open { border-color: var(--ink); }
.cs-badge { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--navy); color: #fff;
  font-size: 12px; display: inline-flex; align-items: center; justify-content: center; }

.cs-tabs { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 6px; }
.cs-tabs::-webkit-scrollbar { display: none; }
.cs-tab { flex: none; border: 1px solid transparent; background: var(--paper); color: var(--ink); cursor: pointer;
  border-radius: 999px; padding: 9px 15px; font-size: 14px; font-weight: 600; white-space: nowrap; }
.cs-tab span { font-weight: 500; color: var(--ink-3); margin-left: 4px; font-size: 13px; }
.cs-tab:hover { border-color: var(--line); background: #fff; }
.cs-tab[aria-pressed="true"] { background: var(--navy); color: #fff; }
.cs-tab[aria-pressed="true"] span { color: rgba(255,255,255,0.7); }
.cs-tab--lots[aria-pressed="false"] { background: #FBF6E8; color: var(--gold-ink); }

.cs-row { margin-top: 18px; display: grid; grid-template-columns: 64px 1fr; align-items: start; gap: 12px; }
.cs-row-label { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--ink-2); }
.cs-shapes, .cs-colors { display: flex; flex-wrap: wrap; gap: 6px; }
.cs-shape { flex: none; width: 82px; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 9px 4px 8px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff; color: var(--ink-2); cursor: pointer;
  transition: border-color 140ms, background-color 140ms, color 140ms; }
.cs-shape:hover:not(:disabled) { border-color: var(--ink-3); color: var(--ink); }
.cs-shape[aria-pressed="true"] { border-color: var(--navy); background: #EEF2FC; color: var(--navy); }
.cs-shape:disabled { opacity: 0.35; cursor: default; }
.cs-shape-name { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.cs-shape-count { font-size: 11px; color: var(--ink-3); }
.cs-color { flex: none; display: flex; flex-direction: column; align-items: center; gap: 5px; width: 70px; padding: 6px 2px;
  border: 0; background: none; cursor: pointer; border-radius: 10px; }
.cs-swatch { width: 34px; height: 34px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);
  transition: transform 140ms, box-shadow 140ms; }
.cs-color:hover:not(:disabled) .cs-swatch { transform: scale(1.08); }
.cs-color[aria-pressed="true"] .cs-swatch { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--navy); }
.cs-color:disabled { opacity: 0.3; cursor: default; }
.cs-color-name { font-size: 11.5px; color: var(--ink-2); text-align: center; line-height: 1.25; }

.cs-panel { margin-top: 20px; border: 1px solid var(--line); border-radius: 14px; background: #FBFBFD;
  display: grid; grid-template-columns: 1.2fr 1fr 1fr 0.9fr; }
.cs-panel-col { padding: 18px; min-width: 0; }
.cs-panel-col + .cs-panel-col { border-left: 1px solid var(--line); }
.cs-panel-title { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
.cs-mini-input { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
  font: inherit; font-size: 14px; margin-bottom: 8px; background: #fff; }
.cs-mini-input:focus { outline: 2px solid var(--gold); outline-offset: 0; }
.cs-checklist { list-style: none; margin: 0; padding: 0; max-height: 230px; overflow-y: auto; }
.cs-checklist label { display: flex; align-items: center; gap: 9px; padding: 6px 4px; border-radius: 6px; cursor: pointer; font-size: 14px; }
.cs-checklist label:hover { background: #F1F2F7; }
.cs-checklist label.is-empty { opacity: 0.45; }
.cs-checklist input { width: 16px; height: 16px; accent-color: var(--navy); flex: none; }
.cs-check-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-check-count { font-size: 12px; color: var(--ink-3); }
.cs-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; padding: 2px; background: #fff; margin-bottom: 10px; }
.cs-seg button { border: 0; background: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.cs-seg button[aria-pressed="true"] { background: var(--navy); color: #fff; }
.cs-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.cs-preset { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 6px 11px; font-size: 13px; cursor: pointer; color: var(--ink); }
.cs-preset:hover { border-color: var(--ink-3); }
.cs-preset[aria-pressed="true"] { background: var(--navy); border-color: var(--navy); color: #fff; }
.cs-range { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cs-range label { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px;
  background: #fff; font-size: 12px; color: var(--ink-3); }
.cs-range label:focus-within { border-color: var(--gold); }
.cs-range input { width: 100%; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 14px; color: var(--ink); padding: 9px 0; background: transparent; }
.cs-pre { color: var(--ink-2); }
.cs-muted-sm { margin: 0; font-size: 13px; color: var(--ink-3); }
.cs-panel-foot { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 12px 18px; border-top: 1px solid var(--line); }

.cs-link-btn { border: 0; background: none; padding: 4px; color: var(--navy); font-weight: 600; font-size: 14px;
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.cs-show-btn { border: 0; border-radius: 10px; background: var(--navy); color: #fff; font-weight: 700; font-size: 14px;
  padding: 11px 20px; cursor: pointer; }
.cs-show-btn:hover { background: #1C2B63; }

.cs-status { margin-top: 22px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.cs-count { margin: 0; font-size: 15px; color: var(--ink-2); display: flex; align-items: center; gap: 8px; }
.cs-count strong { font-size: 20px; color: var(--ink); }
.cs-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--navy);
  animation: cs-spin 700ms linear infinite; }
@keyframes cs-spin { to { transform: rotate(360deg); } }
.cs-sort { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-3); }
.cs-sort select { font: inherit; font-size: 14px; color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; background: #fff; }

.cs-pills { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.cs-pill { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; padding: 6px 10px 6px 12px;
  background: #EEF2FC; color: var(--navy); font-size: 13px; font-weight: 600; cursor: pointer; }
.cs-pill svg { width: 12px; height: 12px; }
.cs-pill:hover { background: #E0E7FA; }

.cs-grid { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px; transition: opacity 160ms; }
.cs-grid.is-busy { opacity: 0.55; }
.cs-card { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #fff;
  transition: box-shadow 180ms, transform 180ms, border-color 180ms; }
.cs-card:hover { box-shadow: 0 8px 20px rgba(14,26,64,0.10); border-color: #D5DAE6; }
.cs-card-link { display: flex; flex-direction: row; align-items: center; gap: 12px; height: 100%; padding: 10px;
  box-sizing: border-box; color: inherit; text-decoration: none; }
.cs-card-link:focus-visible { outline: 3px solid var(--gold); outline-offset: -3px; border-radius: 14px; }
/* Small thumbnail: legacy photos are low-resolution, so they are shown well
   below their native size (which keeps them sharp) and never zoomed. */
.cs-card-img { flex: none; width: 84px; height: 84px; border-radius: 10px; background: linear-gradient(160deg, #F7F8FB, #ECEFF5);
  display: flex; align-items: center; justify-content: center; overflow: hidden; }
.cs-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cs-card-body { min-width: 0; display: flex; flex-direction: column; gap: 2px; flex: 1; }
.cs-card-gem { font-size: 12px; font-weight: 700; color: var(--gold-ink); }
.cs-card-name { font-size: 13.5px; font-weight: 600; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cs-card-specs { font-size: 12px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cs-card-price { margin-top: 3px; font-size: 15px; font-weight: 700; color: var(--navy); }
.cs-skel { height: 106px; background: linear-gradient(90deg, #F1F3F8 25%, #F8F9FC 45%, #F1F3F8 65%); background-size: 300% 100%;
  animation: cs-shimmer 1.3s ease infinite; }
@keyframes cs-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }

.cs-hint { margin: 20px 0 2px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink-3); text-align: center; }
.cs-empty { margin-top: 18px; padding: 40px 20px; border: 1px dashed var(--line); border-radius: 14px; text-align: center; }
.cs-empty p { margin: 0 0 14px; color: var(--ink-2); }
.cs-more { margin-top: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.cs-more-btn { border: 1.5px solid var(--ink); background: #fff; color: var(--ink); border-radius: 10px; padding: 12px 28px;
  font-weight: 700; font-size: 14px; cursor: pointer; }
.cs-more-btn:hover:not(:disabled) { background: var(--ink); color: #fff; }
.cs-more-btn:disabled { opacity: 0.6; cursor: default; }
.cs-center { text-align: center; margin-top: 10px; }

.cs button:focus-visible, .cs a:focus-visible, .cs select:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }

/* ── Responsive ── */
@media (max-width: 1080px) {
  .cs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cs-panel { grid-template-columns: 1fr 1fr; }
  .cs-panel-col:nth-child(3) { border-left: 0; }
  .cs-panel-col:nth-child(n+3) { border-top: 1px solid var(--line); }
}
@media (max-width: 720px) {
  .cs-tabs, .cs-shapes, .cs-colors { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px;
    margin-right: -16px; padding-right: 16px; }
  .cs-tabs::-webkit-scrollbar, .cs-shapes::-webkit-scrollbar, .cs-colors::-webkit-scrollbar { display: none; }
  .cs-grid { grid-template-columns: 1fr; gap: 8px; }
  .cs-panel { grid-template-columns: 1fr; }
  .cs-panel-col + .cs-panel-col { border-left: 0; border-top: 1px solid var(--line); }
  .cs-row { grid-template-columns: 1fr; gap: 6px; }
  .cs-row-label { margin: 0; }
  .cs-card-img { width: 72px; height: 72px; }
  .cs-card-name { font-size: 13px; }
}
@media (max-width: 560px) {
  .cs-hero { padding-bottom: 104px; }
  .cs-tick { font-size: 19px; }
  .cs-tick-minor { display: none; }
  .cs-tagline { font-size: 14.5px; gap: 4px 8px; letter-spacing: 0; }
  .cs-tag-item { gap: 8px; }
  .cs-btn { flex: 1 1 100%; }
  .cs-searchrow { flex-direction: column; }
  .cs-filters-btn { justify-content: center; padding: 12px; }
  .cs-field input { font-size: 15px; }
  .cs-status { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  .cs-gem, .cs-skel, .cs-spinner { animation: none; }
  .cs-gem, .cs-card, .cs-card-img img, .cs-btn { transition: none; }
}
`;