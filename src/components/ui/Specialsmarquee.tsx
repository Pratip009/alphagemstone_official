"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PopulatedCategory {
  _id: string;
  name: string;
  slug: string;
}

interface ApiProduct {
  _id: string;
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
  // watch fields
  watchBrand?: string;
  watchGender?: string;
  watchMovement?: string;
  watchStyle?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Map category name → accent color
const CATEGORY_COLORS: Record<string, string> = {
  diamond:  "#b8960c",
  diamonds: "#b8960c",
  gemstone: "#1a3a6e",
  gemstones:"#1a3a6e",
  jewelry:  "#1a6e3a",
  watches:  "#334155",
  watch:    "#334155",
  alpha:    "#c0392b",
};

function getCategoryColor(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, "");
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v;
  }
  // deterministic fallback from name hash
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 45%, 30%)`;
}

// Subtitle line: shape + size or brand
function getSubtitle(p: ApiProduct): string {
  if (p.watchBrand) return `${p.watchBrand}${p.watchMovement ? ` · ${p.watchMovement}` : ""}`;
  const parts: string[] = [];
  if (p.shape?.length) parts.push(p.shape[0].charAt(0).toUpperCase() + p.shape[0].slice(1));
  if (p.size)          parts.push(`${p.size} ct`);
  if (p.clarity?.length) parts.push(p.clarity[0]);
  return parts.join(" · ") || (p.category?.name ?? "");
}

// ── Gem SVG fallback (when no image) ─────────────────────────────────────────

function GemShape({ shape = "other", color }: { shape?: string; color: string }) {
  const s = shape.toLowerCase();
  if (s.includes("round") || s.includes("brilliant")) return (
    <svg viewBox="0 0 80 80" width="52" height="52">
      <polygon points="40,8 68,22 74,50 58,68 22,68 6,50 12,22" fill={`${color}18`} stroke={color} strokeWidth="1.2"/>
      <polygon points="40,16 60,26 65,46 52,60 28,60 15,46 20,26" fill={`${color}10`} stroke={color} strokeWidth="0.6"/>
      <line x1="40" y1="8" x2="40" y2="68" stroke={color} strokeWidth="0.4" opacity="0.4"/>
      <line x1="6" y1="50" x2="74" y2="50" stroke={color} strokeWidth="0.4" opacity="0.4"/>
    </svg>
  );
  if (s.includes("oval") || s.includes("pear") || s.includes("marquise")) return (
    <svg viewBox="0 0 80 80" width="52" height="52">
      <ellipse cx="40" cy="40" rx="30" ry="22" fill={`${color}18`} stroke={color} strokeWidth="1.2"/>
      <ellipse cx="40" cy="40" rx="22" ry="14" fill={`${color}10`} stroke={color} strokeWidth="0.6"/>
      <line x1="10" y1="40" x2="70" y2="40" stroke={color} strokeWidth="0.4" opacity="0.4"/>
      <line x1="40" y1="18" x2="40" y2="62" stroke={color} strokeWidth="0.4" opacity="0.4"/>
    </svg>
  );
  if (s.includes("cushion") || s.includes("asscher")) return (
    <svg viewBox="0 0 80 80" width="52" height="52">
      <rect x="14" y="14" width="52" height="52" rx="12" fill={`${color}18`} stroke={color} strokeWidth="1.2"/>
      <rect x="22" y="22" width="36" height="36" rx="6" fill={`${color}10`} stroke={color} strokeWidth="0.6"/>
      <line x1="14" y1="40" x2="66" y2="40" stroke={color} strokeWidth="0.4" opacity="0.4"/>
      <line x1="40" y1="14" x2="40" y2="66" stroke={color} strokeWidth="0.4" opacity="0.4"/>
    </svg>
  );
  if (s.includes("princess") || s.includes("radiant") || s.includes("emerald")) return (
    <svg viewBox="0 0 80 80" width="52" height="52">
      <rect x="16" y="16" width="48" height="48" rx="3" fill={`${color}18`} stroke={color} strokeWidth="1.2"/>
      <rect x="24" y="24" width="32" height="32" rx="2" fill={`${color}10`} stroke={color} strokeWidth="0.6"/>
      <line x1="16" y1="40" x2="64" y2="40" stroke={color} strokeWidth="0.4" opacity="0.4"/>
      <line x1="40" y1="16" x2="40" y2="64" stroke={color} strokeWidth="0.4" opacity="0.4"/>
    </svg>
  );
  if (s.includes("heart")) return (
    <svg viewBox="0 0 80 80" width="52" height="52">
      <path d="M40 62 C40 62 12 44 12 26 C12 18 18 12 26 12 C32 12 37 16 40 20 C43 16 48 12 54 12 C62 12 68 18 68 26 C68 44 40 62 40 62Z"
        fill={`${color}18`} stroke={color} strokeWidth="1.2"/>
      <path d="M40 54 C40 54 18 40 18 28 C18 22 22 18 28 18 C33 18 37 22 40 26 C43 22 47 18 52 18 C58 18 62 22 62 28 C62 40 40 54 40 54Z"
        fill={`${color}10`} stroke={color} strokeWidth="0.6"/>
    </svg>
  );
  // default hexagon
  return (
    <svg viewBox="0 0 80 80" width="52" height="52">
      <polygon points="40,8 66,23 66,57 40,72 14,57 14,23" fill={`${color}18`} stroke={color} strokeWidth="1.2"/>
      <polygon points="40,18 58,28 58,52 40,62 22,52 22,28" fill={`${color}10`} stroke={color} strokeWidth="0.6"/>
      <line x1="14" y1="40" x2="66" y2="40" stroke={color} strokeWidth="0.4" opacity="0.4"/>
    </svg>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: ApiProduct }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const color    = getCategoryColor(product.category?.name ?? "");
  const subtitle = getSubtitle(product);
  const hasImage = product.images?.length > 0 && !imgError;

  return (
    <Link
      href={`/products/${product._id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        width: 240,
        flexShrink: 0,
        background: "#ffffff",
        border: `1px solid ${hovered ? color + "44" : "#e8e8ec"}`,
        borderRadius: 3,
        overflow: "hidden",
        textDecoration: "none",
        transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered
          ? `0 20px 48px rgba(0,0,0,0.1), 0 4px 12px ${color}22`
          : "0 1px 4px rgba(0,0,0,0.06)",
        position: "relative",
        cursor: "pointer",
      }}
    >
      {/* Category badge */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        fontFamily: "'Jost', sans-serif",
        fontSize: 9, fontWeight: 500,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color, background: `${color}12`,
        border: `1px solid ${color}30`,
        padding: "3px 8px", borderRadius: 2, zIndex: 2,
      }}>
        {product.category?.name}
      </div>

      {/* Image / SVG area */}
      <div style={{
        height: 148,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hovered ? `${color}06` : "#fafafa",
        transition: "background 0.3s ease",
        borderBottom: `1px solid ${hovered ? color + "20" : "#f0f0f4"}`,
        position: "relative", overflow: "hidden",
      }}>
        {/* Radial glow */}
        <div style={{
          position: "absolute", width: 100, height: 100, borderRadius: "50%",
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          opacity: hovered ? 1 : 0, transition: "opacity 0.3s",
        }} />

        <div style={{
          transform: hovered ? "scale(1.06)" : "scale(1)",
          transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {hasImage ? (
            <img
              src={product.images[0]}
              alt={product.name}
              onError={() => setImgError(true)}
              style={{
                width: "100%", height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <GemShape shape={product.shape?.[0] ?? "other"} color={color} />
          )}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "18px 18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Subtitle */}
        <p style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, fontWeight: 400,
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: "#9ca3af", margin: 0,
        }}>
          {subtitle}
        </p>

        {/* Name */}
        <p style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 17, fontWeight: 600,
          color: hovered ? color : "#111827",
          lineHeight: 1.3, margin: 0,
          transition: "color 0.2s",
          // clamp to 2 lines
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {product.name}
        </p>

        {/* Animated divider */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg, ${color}40, transparent)`,
          margin: "2px 0",
          transform: hovered ? "scaleX(1)" : "scaleX(0.4)",
          transformOrigin: "left",
          transition: "transform 0.35s ease",
        }} />

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 600,
            color: "#111827", lineHeight: 1,
          }}>
            ${product.price.toLocaleString()}
          </span>
          {product.size && (
            <span style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 10, color: "#9ca3af", letterSpacing: "0.1em",
            }}>
              / ct
            </span>
          )}
        </div>

        {/* Stock indicator */}
        {product.stock <= 5 && product.stock > 0 && (
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: 9, fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "#dc2626", margin: 0,
          }}>
            Only {product.stock} left
          </p>
        )}

        {/* CTA */}
        <div style={{
          marginTop: "auto", paddingTop: 10,
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Jost', sans-serif",
          fontSize: 11, fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color, opacity: hovered ? 1 : 0.5,
          transition: "opacity 0.25s ease",
        }}>
          View Details
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: "#ffffff",
      border: "1px solid #e8e8ec",
      borderRadius: 3, overflow: "hidden",
    }}>
      <div style={{ height: 148, background: "#f3f4f6" }} />
      <div style={{ padding: "18px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 10, width: "60%", background: "#f3f4f6", borderRadius: 2 }} />
        <div style={{ height: 16, width: "85%", background: "#f3f4f6", borderRadius: 2 }} />
        <div style={{ height: 16, width: "70%", background: "#f3f4f6", borderRadius: 2 }} />
        <div style={{ height: 22, width: "45%", background: "#f3f4f6", borderRadius: 2, marginTop: 8 }} />
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export default function SpecialsMarquee() {
  const [allProducts, setAllProducts]   = useState<ApiProduct[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Fetch once on mount
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch("/api/products?limit=60", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setAllProducts(json.data.filter((p: ApiProduct) => p.isActive));
        } else {
          throw new Error("Unexpected response shape");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message ?? "Failed to load products");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  // Derive unique categories from fetched products
  const categories = [
    { key: "all", label: "All", accent: "#1a1a1a" },
    ...Array.from(
      new Map(
        allProducts
          .filter((p) => p.category?._id)
          .map((p) => [
            p.category._id,
            {
              key: p.category._id,
              label: p.category.name,
              accent: getCategoryColor(p.category.name),
            },
          ])
      ).values()
    ),
  ];

  const filtered = activeCategory === "all"
    ? allProducts
    : allProducts.filter((p) => p.category?._id === activeCategory);

  const accentColor = categories.find((c) => c.key === activeCategory)?.accent ?? "#1a1a1a";

  // Triple for seamless loop; min duration 28s
  const marqueeItems = [...filtered, ...filtered, ...filtered];
  const duration     = `${Math.max(28, filtered.length * 4.5)}s`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600;700&display=swap');

        @keyframes marqueeScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .specials-marquee-track {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: stretch;
          gap: 20px;
          width: max-content;
          padding: 24px 0 32px;
          animation: marqueeScroll var(--marquee-duration, 38s) linear infinite;
          will-change: transform;
        }
        .specials-marquee-track:hover {
          animation-play-state: paused;
        }
        .specials-cat-tab {
          font-family: 'Jost', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 8px 18px;
          border-radius: 2px;
          transition: all 0.22s ease;
          white-space: nowrap;
          position: relative;
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #f3f4f6 25%, #e9eaeb 50%, #f3f4f6 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>

      <section style={{
        background: "#ffffff",
        borderTop: "1px solid #e8e8ec",
        borderBottom: "1px solid #e8e8ec",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${accentColor}60, ${accentColor}, ${accentColor}60, transparent)`,
          transition: "background 0.4s ease",
        }} />

        {/* ── Header ── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "52px 32px 0" }}>

          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <div style={{
              background: accentColor,
              color: "#fff",
              fontFamily: "'Jost', sans-serif",
              fontSize: 10, fontWeight: 700,
              letterSpacing: "0.18em",
              padding: "5px 12px", borderRadius: 2,
              transition: "background 0.3s",
            }}>
              LIVE
            </div>
            <div style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 10, fontWeight: 500,
              letterSpacing: "0.25em", textTransform: "uppercase",
              color: "#ff0000",
            }}>
              {loading ? "Loading products…" : `50% off!`}
            </div>
          </div>

          {/* Heading row */}
          <div style={{
            display: "flex", alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap", gap: 20, marginBottom: 32,
          }}>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(32px, 5vw, 58px)",
              fontWeight: 400, color: "#111827",
              lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0,
            }}>
              Our <em style={{ fontStyle: "italic", color: accentColor, transition: "color 0.3s" }}>
                Collection
              </em>
            </h2>

            <Link href="/products" style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: accentColor, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 8,
              paddingBottom: 2,
              borderBottom: `1px solid ${accentColor}40`,
              whiteSpace: "nowrap",
              transition: "color 0.3s, border-color 0.3s",
            }}>
              View All Products
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          {/* ── Category tabs ── */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: 4, flexWrap: "wrap",
            borderBottom: "1px solid #e8e8ec",
          }}>
            {loading
              ? /* skeleton tabs */
                [90, 70, 110, 80, 95].map((w, i) => (
                  <div key={i} className="skeleton-shimmer" style={{
                    height: 32, width: w, borderRadius: 2, margin: "4px 4px 8px",
                  }} />
                ))
              : categories.map((cat) => {
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      className="specials-cat-tab"
                      onClick={() => setActiveCategory(cat.key)}
                      style={{
                        color: isActive ? cat.accent : "#6b7280",
                        background: isActive ? `${cat.accent}08` : "transparent",
                      }}
                    >
                      <span style={{ position: "relative" }}>
                        {cat.label}
                        {isActive && (
                          <span style={{
                            position: "absolute",
                            bottom: -9, left: 0, right: 0,
                            height: 2, background: cat.accent,
                            borderRadius: "1px 1px 0 0",
                          }} />
                        )}
                      </span>
                    </button>
                  );
                })
            }

            {/* Item count */}
            {!loading && (
              <div style={{
                marginLeft: "auto",
                fontFamily: "'Jost', sans-serif",
                fontSize: 11, color: "#d1d5db",
                letterSpacing: "0.12em",
                paddingBottom: 8, paddingRight: 4,
              }}>
                {filtered.length} items
              </div>
            )}
          </div>
        </div>

        {/* ── Marquee strip ── */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          {/* Fade edges */}
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 80,
            background: "linear-gradient(to right, #ffffff, transparent)",
            zIndex: 10, pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 80,
            background: "linear-gradient(to left, #ffffff, transparent)",
            zIndex: 10, pointerEvents: "none",
          }} />

          <div style={{ padding: "0 40px" }}>
            {loading ? (
              /* Skeleton row */
              <div style={{
                display: "flex", gap: 20,
                padding: "24px 0 32px", overflowX: "hidden",
              }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ flexShrink: 0 }}>
                    <div style={{ width: 240 }}>
                      <div className="skeleton-shimmer" style={{ height: 148, borderRadius: "3px 3px 0 0" }} />
                      <div style={{
                        padding: "18px 18px 20px",
                        border: "1px solid #e8e8ec",
                        borderTop: "none",
                        borderRadius: "0 0 3px 3px",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}>
                        <div className="skeleton-shimmer" style={{ height: 10, width: "60%", borderRadius: 2 }} />
                        <div className="skeleton-shimmer" style={{ height: 16, width: "85%", borderRadius: 2 }} />
                        <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 2 }} />
                        <div className="skeleton-shimmer" style={{ height: 22, width: "45%", borderRadius: 2, marginTop: 8 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div style={{
                padding: "40px 0", textAlign: "center",
                fontFamily: "'Jost', sans-serif",
                fontSize: 13, color: "#9ca3af",
              }}>
                Could not load products. <button
                  onClick={() => window.location.reload()}
                  style={{
                    background: "none", border: "none",
                    color: accentColor, cursor: "pointer",
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 13, textDecoration: "underline",
                  }}
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                padding: "40px 0", textAlign: "center",
                fontFamily: "'Jost', sans-serif",
                fontSize: 13, color: "#9ca3af",
              }}>
                No products in this category.
              </div>
            ) : (
              <div
                className="specials-marquee-track"
                style={{ "--marquee-duration": duration } as React.CSSProperties}
                key={activeCategory}
              >
                {marqueeItems.map((product, idx) => (
                  <ProductCard key={`${product._id}-${idx}`} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom stats bar ── */}
        {!loading && !error && (
          <div style={{
            borderTop: "1px solid #f3f4f6",
            background: "#fafafa",
            padding: "18px 40px",
          }}>
            <div style={{
              maxWidth: 1280, margin: "0 auto",
              display: "flex", alignItems: "center",
              justifyContent: "center",
              gap: "clamp(24px, 6vw, 80px)",
              flexWrap: "wrap",
            }}>
              {[
                { value: String(allProducts.length), label: "Products available" },
                { value: String(categories.length - 1), label: "Categories" },
                { value: "GIA",  label: "Certified stones" },
                { value: "Free", label: "Shipping included" },
              ].map((stat) => (
                <div key={stat.label} style={{ textAlign: "center" }}>
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 24, fontWeight: 600,
                    color: accentColor, lineHeight: 1,
                    margin: "0 0 4px",
                    transition: "color 0.3s",
                  }}>
                    {stat.value}
                  </p>
                  <p style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 10, fontWeight: 400,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: "#9ca3af", margin: 0,
                  }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}