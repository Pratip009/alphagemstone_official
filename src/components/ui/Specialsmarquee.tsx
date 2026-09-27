"use client";

/**
 * SpecialsMarquee — the product grid of the homepage "Our Collection" area.
 *
 * Sits directly below OurCollectionSection on the same sapphire background,
 * so the statement ("One source. Thousands of possibilities.") and the live
 * products read as one continuous band. Data logic is unchanged: 60 active
 * products, category filters, 7 cards per page, auto-advancing every 5 s
 * (paused while the visitor hovers or tabs through the grid).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { optimizedImageUrl } from "@/lib/image-url";

interface PopulatedCategory {
  _id: string;
  name: string;
  slug: string;
}

interface ApiProduct {
  _id: string;
  slug?: string;
  name: string;
  category: PopulatedCategory;
  subcategory?: PopulatedCategory;
  price: number;
  shape?: string[];
  size?: number;
  color?: string[];
  clarity?: string[];
  certification?: string[];
  images: string[];
  stock: number;
  isActive: boolean;
  description?: string;
  watchBrand?: string;
  watchMovement?: string;
}

function getSubtitle(p: ApiProduct): string {
  if (p.watchBrand)
    return `${p.watchBrand}${p.watchMovement ? ` · ${p.watchMovement}` : ""}`;
  const parts: string[] = [];
  if (p.shape?.length)
    parts.push(p.shape[0].charAt(0).toUpperCase() + p.shape[0].slice(1));
  if (p.size) parts.push(`${p.size} ct`);
  if (p.clarity?.length) parts.push(p.clarity[0]);
  return parts.join(" · ") || (p.category?.name ?? "");
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: ApiProduct }) {
  const [imgError, setImgError] = useState(false);
  const hasImg = product.images?.length > 0 && !imgError;

  return (
    <Link href={`/products/${product.slug ?? product._id}`} className="cm-card">
      <div className="cm-tile">
        <div className="cm-tile-inner">
          {hasImg ? (
            <img
              src={optimizedImageUrl(product.images[0], { width: 500, quality: 90 })}
              alt={product.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="cm-img"
            />
          ) : (
            <div className="cm-img-empty" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#b9bfcc"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}

          {product.stock <= 5 && product.stock > 0 && (
            <span className="cm-stock">{product.stock} left</span>
          )}
        </div>
      </div>

      <div className="cm-info">
        <p className="cm-sub">{getSubtitle(product) || product.category?.name}</p>
        <p className="cm-name">{product.name}</p>
        <p className="cm-price">
          ${product.price.toLocaleString()}
          {product.size ? <span className="cm-unit">/ct</span> : null}
        </p>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="cm-tile">
        <div className="cm-tile-inner cm-skel" />
      </div>
      <div className="cm-info">
        <div className="cm-skel" style={{ height: 9, width: "45%", marginBottom: 9, borderRadius: 2 }} />
        <div className="cm-skel" style={{ height: 13, width: "80%", marginBottom: 8, borderRadius: 2 }} />
        <div className="cm-skel" style={{ height: 15, width: "34%", borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SpecialsMarquee() {
  const [allProducts, setAllProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const COLS = 7; // cards per page

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products?limit=60", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.success && Array.isArray(json.data))
          setAllProducts(json.data.filter((p: ApiProduct) => p.isActive));
        else throw new Error("Unexpected response");
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const categories = [
    { key: "all", label: "All" },
    ...Array.from(
      new Map(
        allProducts
          .filter((p) => p.category?._id)
          .map((p) => [p.category._id, { key: p.category._id, label: p.category.name }]),
      ).values(),
    ),
  ];

  const filtered =
    activeCategory === "all"
      ? allProducts
      : allProducts.filter((p) => p.category?._id === activeCategory);

  const totalPages = Math.ceil(filtered.length / COLS);
  const visible = filtered.slice(page * COLS, page * COLS + COLS);

  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (totalPages > 1 && !paused) {
      autoRef.current = setInterval(() => setPage((p) => (p + 1) % totalPages), 5000);
    }
  }, [totalPages, paused]);

  useEffect(() => {
    startAuto();
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [startAuto]);

  useEffect(() => {
    setPage(0);
  }, [activeCategory]);

  const goTo = (i: number) => {
    setPage(i);
    startAuto();
  };

  return (
    <section className="cm" aria-labelledby="cm-title">
      <style>{CSS}</style>

      <div className="cm-inner">
        {/* Header */}
        <div className="cm-head">
          <h2 id="cm-title" className="cm-title">Our Collection</h2>
          <Link href="/products" className="cm-all">
            View all products
          </Link>
        </div>

        {/* Category filters */}
        <div className="cm-pills" role="group" aria-label="Filter by category">
          {loading
            ? [60, 80, 72, 90, 68].map((w, i) => (
                <div key={i} className="cm-skel" style={{ height: 34, width: w, borderRadius: 20 }} />
              ))
            : categories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={`cm-pill${activeCategory === cat.key ? " is-active" : ""}`}
                  aria-pressed={activeCategory === cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
        </div>

        {/* Products grid */}
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {error ? (
            <div className="cm-state">
              Products couldn&rsquo;t be loaded.{" "}
              <button type="button" className="cm-retry" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          ) : loading ? (
            <div className="specials-grid">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="cm-state">No products in this category yet.</div>
          ) : (
            <div className="specials-grid">
              {visible.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="cm-dots">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Page ${i + 1}`}
                aria-current={i === page ? "true" : undefined}
                onClick={() => goTo(i)}
                className={`cm-dot${i === page ? " is-active" : ""}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const CSS = `
.cm {
  --cm-night: #0B1430;
  --cm-platinum: #E9EBF1;
  --cm-mist: #A7B0C6;
  --cm-gold: #C8A66A;
  --cm-gold-soft: rgba(200, 166, 106, 0.28);
  --cm-cut: 12px;
  background: var(--cm-night);
  color: var(--cm-platinum);
  font-family: "Elms Sans", system-ui, sans-serif;
}
.cm-inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 64px) clamp(72px, 8vw, 112px);
}

/* Header */
.cm-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: clamp(40px, 5vw, 64px);
  border-top: 1px solid var(--cm-gold-soft);
  margin-bottom: 28px;
}
.cm-title {
  margin: 0;
  font-family: "Cormorant Garamond", Georgia, serif;
  font-weight: 500;
  font-size: clamp(34px, 3.4vw, 52px);
  line-height: 1;
  letter-spacing: 0.005em;
  color: var(--cm-platinum);
}
.cm-all {
  font-size: 14px;
  font-weight: 500;
  color: var(--cm-platinum);
  text-decoration: underline;
  text-decoration-color: var(--cm-gold-soft);
  text-underline-offset: 6px;
  transition: text-decoration-color .25s ease;
}
.cm-all:hover { text-decoration-color: var(--cm-gold); }

/* Category filters */
.cm-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 40px;
}
.cm-pill {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--cm-gold-soft);
  background: transparent;
  color: var(--cm-mist);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color .2s ease, color .2s ease, background-color .2s ease;
}
.cm-pill:hover { border-color: var(--cm-gold); color: var(--cm-platinum); }
.cm-pill.is-active {
  background: var(--cm-gold);
  border-color: var(--cm-gold);
  color: var(--cm-night);
}

/* Grid */
.specials-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 32px 20px;
}
@media (max-width: 1024px) { .specials-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 640px)  { .specials-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 14px; } }
@media (max-width: 380px)  { .specials-grid { grid-template-columns: 1fr; } }

/* Card: product photo in a small emerald-cut tile, echoing the video frame above */
.cm-card { display: block; text-decoration: none; color: inherit; }
.cm-tile {
  padding: 1px;
  background: rgba(200, 166, 106, 0.22);
  clip-path: polygon(var(--cm-cut) 0, calc(100% - var(--cm-cut)) 0, 100% var(--cm-cut), 100% calc(100% - var(--cm-cut)), calc(100% - var(--cm-cut)) 100%, var(--cm-cut) 100%, 0 calc(100% - var(--cm-cut)), 0 var(--cm-cut));
  transition: background-color .3s ease;
}
.cm-tile-inner {
  position: relative;
  padding-bottom: 82%;
  overflow: hidden;
  background: #F4F4F6;
  clip-path: polygon(var(--cm-cut) 0, calc(100% - var(--cm-cut)) 0, 100% var(--cm-cut), 100% calc(100% - var(--cm-cut)), calc(100% - var(--cm-cut)) 100%, var(--cm-cut) 100%, 0 calc(100% - var(--cm-cut)), 0 var(--cm-cut));
}
.cm-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .6s cubic-bezier(.22,1,.36,1);
}
.cm-img-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cm-card:hover .cm-tile,
.cm-card:focus-visible .cm-tile { background: var(--cm-gold); }
.cm-card:hover .cm-img { transform: scale(1.05); }
.cm-card:hover .cm-name { color: #fff; }

.cm-stock {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(11, 20, 48, 0.86);
  color: #F4B3A6;
  font-size: 10.5px;
  font-weight: 600;
}

.cm-info { padding: 14px 2px 0; }
.cm-sub {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--cm-mist);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cm-name {
  margin: 0 0 8px;
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--cm-platinum);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color .2s ease;
}
.cm-price {
  margin: 0;
  font-size: 15.5px;
  font-weight: 600;
  color: var(--cm-gold);
}
.cm-unit { margin-left: 3px; font-size: 11.5px; font-weight: 400; color: var(--cm-mist); }

/* States */
.cm-state { padding: 64px 0; text-align: center; font-size: 14px; color: var(--cm-mist); }
.cm-retry {
  font: inherit;
  background: none;
  border: 0;
  padding: 0;
  color: var(--cm-gold);
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}

/* Pagination */
.cm-dots { display: flex; justify-content: center; margin-top: 48px; }
.cm-dot {
  width: 6px;
  height: 6px;
  padding: 9px;
  box-sizing: content-box;
  background-clip: content-box;
  background-color: rgba(200, 166, 106, 0.3);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: width .3s ease, background-color .3s ease;
}
.cm-dot.is-active { width: 22px; background-color: var(--cm-gold); }

/* Loading shimmer, tuned for the dark background */
@keyframes cm-shimmer {
  from { background-position: -600px 0; }
  to   { background-position: 600px 0; }
}
.cm-skel {
  background: linear-gradient(90deg, rgba(233,235,241,.06) 25%, rgba(233,235,241,.13) 50%, rgba(233,235,241,.06) 75%);
  background-size: 600px 100%;
  animation: cm-shimmer 1.5s infinite linear;
}

/* Keyboard focus */
.cm-all:focus-visible, .cm-pill:focus-visible, .cm-dot:focus-visible, .cm-retry:focus-visible {
  outline: 2px solid var(--cm-platinum);
  outline-offset: 3px;
}
.cm-card:focus-visible { outline: none; }
.cm-card:focus-visible .cm-name { text-decoration: underline; text-decoration-color: var(--cm-gold); }

@media (prefers-reduced-motion: reduce) {
  .cm-skel { animation: none; }
  .cm-img, .cm-tile, .cm-dot { transition: none; }
  .cm-card:hover .cm-img { transform: none; }
}
`;