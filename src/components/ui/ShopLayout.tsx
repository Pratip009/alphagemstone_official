"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import "./ShopLayout.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ICategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

interface ISubcategory {
  _id: string;
  name: string;
  slug: string;
  category: { _id: string; name: string; slug: string };
  description?: string;
  imageUrl?: string;
  isActive: boolean;
}

interface IProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  category: string;
  subcategory: string;
  origin?: string;
  tag?: string;
}

interface IPickProduct {
  _id: string;
  name: string;
  image?: string;
  price: number;
}

// ─── Module-level cache (survives remounts within the same session) ───────────
// Cached data is shown immediately on mount (avoids a loading flash), but is
// time-boxed: once CACHE_TTL_MS has elapsed since the last successful fetch,
// the next mount silently revalidates in the background (stale-while-
// revalidate) instead of trusting the cached value forever. Without this,
// a tab left open across an admin edit (new category, updated best-sellers,
// etc.) would show stale data indefinitely, until a hard refresh.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

let _catsCache: {
  categories: ICategory[];
  subcategories: ISubcategory[];
  fetchedAt: number;
} | null = null;

let _picksCache: { picks: IPickProduct[]; fetchedAt: number } | null = null;

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({
  w,
  h,
  className = "",
  style,
}: {
  w?: string | number;
  h?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width: w ?? "100%",
        height: h ?? 16,
        borderRadius: 2,
        background: "#f0f0f0",
        display: "block",
        ...style,
      }}
    />
  );
}

// ─── Landing hero ──────────────────────────────────────────────────────────────
function LandingHero() {
  return (
    <div
      style={{
        marginBottom: 60,
        padding: "48px 4px 36px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <p
        style={{
          fontFamily: '"Google Sans Flex", sans-serif',
          fontSize: 11,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "var(--gold)",
          fontWeight: 600,
          marginBottom: 16,
        }}
      >
        Fine Jewelry, Since 1998
      </p>
      <h1
        style={{
          fontFamily: '"Google Sans Flex", sans-serif',
          fontSize: "clamp(30px, 4vw, 50px)",
          fontWeight: 600,
          color: "var(--navy)",
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          maxWidth: 620,
        }}
      >
        Timeless pieces, crafted for every story.
      </h1>
    </div>
  );
}

// ─── Subcategory card (landing) ────────────────────────────────────────────────
function SubcategoryCard({
  sub,
  onSelect,
}: {
  sub: ISubcategory;
  onSelect: (sub: ISubcategory) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const fallback =
    "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=300";

  return (
    <div
      onClick={() => onSelect(sub)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          overflow: "hidden",
          background: "#fafafa",
          border: "1px solid var(--border)",
        }}
      >
        <img
          src={sub.imageUrl ?? fallback}
          alt={sub.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: hovered ? "scale(1.04)" : "scale(1)",
            transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
      <div style={{ padding: "14px 2px 0" }}>
        <p
          style={{
            fontFamily: '"Google Sans Flex", sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: "var(--navy)",
            marginBottom: 4,
          }}
        >
          {sub.name}
        </p>
        <span
          style={{
            fontFamily: '"Google Sans Flex", sans-serif',
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: hovered ? "var(--gold)" : "var(--text-muted)",
            fontWeight: 500,
            transition: "color 0.25s",
          }}
        >
          Shop now →
        </span>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: IProduct }) {
  const [hovered, setHovered] = useState(false);
  const img =
    product.images?.[0] ??
    "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=400";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        background: "var(--surface)",
        border: "1px solid",
        borderColor: hovered ? "rgba(166,124,46,0.4)" : "var(--border)",
        transition: "border-color 0.3s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          position: "relative",
          overflow: "hidden",
          background: "#fafafa",
        }}
      >
        <img
          src={img}
          alt={product.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: hovered ? "scale(1.06)" : "scale(1)",
            transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 55%, rgba(20,33,61,0.55) 100%)",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.3s",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#fff",
              fontFamily: '"Google Sans Flex", sans-serif',
              fontWeight: 500,
              border: "1px solid rgba(255,255,255,0.6)",
              padding: "6px 14px",
              backdropFilter: "blur(4px)",
            }}
          >
            View Details
          </span>
        </div>
        {product.tag && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontFamily: '"Google Sans Flex", sans-serif',
              fontWeight: 600,
              background: "var(--navy)",
              color: "var(--gold-l)",
              padding: "4px 10px",
            }}
          >
            {product.tag}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 12px 16px" }}>
        <p
          style={{
            fontFamily: '"Google Sans Flex", sans-serif',
            fontSize: 13.5,
            color: "var(--navy)",
            lineHeight: 1.4,
            marginBottom: 5,
            fontWeight: 400,
          }}
        >
          {product.name}
        </p>
        {product.origin && (
          <p
            style={{
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--gold)",
              fontFamily: '"Google Sans Flex", sans-serif',
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            {product.origin}
          </p>
        )}
        <p
          style={{
            fontFamily: '"Google Sans Flex", sans-serif',
            fontSize: 14.5,
            color: "var(--navy)",
            fontWeight: 600,
          }}
        >
          ₹{product.price.toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <Skeleton
        h={0}
        style={{ width: "100%", aspectRatio: "1", borderRadius: 0 }}
      />
      <div style={{ padding: "14px 12px 16px" }}>
        <Skeleton w="75%" h={13} style={{ marginBottom: 6 }} />
        <Skeleton w="45%" h={11} style={{ marginBottom: 6 }} />
        <Skeleton w="35%" h={14} />
      </div>
    </div>
  );
}

// ─── Sidebar group ────────────────────────────────────────────────────────────
function SidebarGroup({
  category,
  subcategories,
  activeSubSlug,
  onSelectSub,
  onSelectCat,
}: {
  category: ICategory;
  subcategories: ISubcategory[];
  activeSubSlug: string;
  onSelectSub: (sub: ISubcategory) => void;
  onSelectCat: (cat: ICategory) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;
  const visible = showAll ? subcategories : subcategories.slice(0, LIMIT);

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={() => onSelectCat(category)}
          style={{
            flex: 1,
            textAlign: "left",
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              fontFamily: '"Google Sans Flex", sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: "var(--navy)",
              letterSpacing: "0.01em",
            }}
          >
            {category.name}
          </span>
        </button>
        {subcategories.length > 0 && (
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              padding: "10px 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <svg
              width="8"
              height="5"
              viewBox="0 0 10 6"
              fill="none"
              style={{
                transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <path
                d="M1 1L5 5L9 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? `${(visible.length + 1) * 32 + 8}px` : "0px",
          transition: "max-height 0.35s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div style={{ paddingBottom: 6 }}>
          {visible.map((sub) => {
            const isActive = activeSubSlug === sub.slug;
            return (
              <button
                key={sub._id}
                onClick={() => onSelectSub(sub)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 16px 5px 26px",
                  background: isActive
                    ? "linear-gradient(90deg, rgba(166,124,46,0.08), transparent)"
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderLeft: isActive
                    ? "2px solid var(--gold)"
                    : "2px solid transparent",
                  transition: "background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(20,33,61,0.03)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: '"Google Sans Flex", sans-serif',
                    color: isActive ? "var(--gold)" : "var(--text-muted)",
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: "0.01em",
                  }}
                >
                  {sub.name}
                </span>
              </button>
            );
          })}
          {subcategories.length > LIMIT && (
            <button
              onClick={() => setShowAll((s) => !s)}
              style={{
                padding: "4px 16px 4px 26px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 10.5,
                color: "var(--gold)",
                fontFamily: '"Google Sans Flex", sans-serif',
                letterSpacing: "0.06em",
                fontWeight: 500,
              }}
            >
              {showAll
                ? "Show less ↑"
                : `+${subcategories.length - LIMIT} more`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "10px 16px",
          }}
        >
          <Skeleton w="65%" h={13} style={{ marginBottom: 8 }} />
          {[1, 2, 3].map((j) => (
            <Skeleton
              key={j}
              w="55%"
              h={10}
              style={{ marginBottom: 6, marginLeft: 10 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Fisher-Yates shuffle ─────────────────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Landing view ─────────────────────────────────────────────────────────────
function LandingView({
  categories,
  subcategories,
  onSelectSub,
  onSelectCat,
  showHero,
}: {
  categories: ICategory[];
  subcategories: ISubcategory[];
  onSelectSub: (sub: ISubcategory) => void;
  onSelectCat: (cat: ICategory) => void;
  showHero: boolean;
}) {
  const RANDOM_PICK = 4;

  const randomSubsMap = useMemo(() => {
    const map: Record<string, ISubcategory[]> = {};
    categories.forEach((cat) => {
      const all = subcategories.filter(
        (s) => s.category._id.toString() === cat._id.toString(),
      );
      map[cat._id] = shuffleArray(all).slice(0, RANDOM_PICK);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, subcategories]);

  return (
    <div>
      {showHero && <LandingHero />}
      {categories.map((cat, catIndex) => {
        const pickedSubs = randomSubsMap[cat._id] ?? [];
        if (pickedSubs.length === 0) return null;

        const totalCount = subcategories.filter(
          (s) => s.category._id.toString() === cat._id.toString(),
        ).length;

        return (
          <section
            key={cat._id}
            className="landing-section"
            style={{
              marginBottom: 56,
              animationDelay: `${catIndex * 0.08}s`,
            }}
          >
            <div
              style={{
                marginBottom: 26,
                paddingBottom: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => onSelectCat(cat)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: '"Google Sans Flex", sans-serif',
                    fontSize: 26,
                    fontWeight: 600,
                    color: "var(--navy)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {cat.name}
                </span>
              </button>
              {totalCount > RANDOM_PICK && (
                <button
                  onClick={() => onSelectCat(cat)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 10.5,
                    color: "var(--gold)",
                    fontFamily: '"Google Sans Flex", sans-serif',
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  View all {totalCount} →
                </button>
              )}
            </div>

            <div className="landing-sub-grid">
              {pickedSubs.map((sub) => (
                <SubcategoryCard
                  key={sub._id}
                  sub={sub}
                  onSelect={onSelectSub}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LandingSkeleton() {
  return (
    <div>
      <div
        style={{
          marginBottom: 60,
          padding: "48px 4px 36px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Skeleton w={160} h={11} style={{ marginBottom: 16 }} />
        <Skeleton w={420} h={40} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 48 }}>
          <Skeleton w={180} h={22} style={{ marginBottom: 20 }} />
          <div
            style={{
              display: "grid",
              gap: "20px 16px",
              gridTemplateColumns: "repeat(4, 1fr)",
            }}
          >
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{ display: "flex", flexDirection: "column" }}>
                <Skeleton
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: 0,
                    marginBottom: 12,
                  }}
                />
                <Skeleton w="70%" h={12} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Buyers Picks ─────────────────────────────────────────────────────────────
function BuyersPicks({ products }: { products: IPickProduct[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const fallback =
    "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=200";

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        maxHeight: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "var(--navy)",
          padding: "18px 18px 14px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 4,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M5 0L10 5L5 10L0 5Z" fill="var(--gold-l)" />
            </svg>
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "var(--gold-l)",
                fontFamily: '"Google Sans Flex", sans-serif',
                fontWeight: 600,
              }}
            >
              Curated Picks
            </span>
          </div>
          <p
            style={{
              fontFamily: '"Google Sans Flex", sans-serif',
              fontSize: 17,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Best Sellers
          </p>
        </div>
      </div>

      <div
        style={{
          height: 2,
          background: "var(--gold)",
        }}
      />

      <div style={{ padding: "6px 0" }}>
        {products.map((p, i) => {
          const isHovered = hovered === p._id;
          return (
            <div
              key={p._id}
              onMouseEnter={() => setHovered(p._id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                background: isHovered ? "rgba(166,124,46,0.05)" : "transparent",
                transition: "background 0.25s",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  background: "var(--navy)",
                  color: "var(--gold-l)",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: '"Google Sans Flex", sans-serif',
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  width: 58,
                  height: 58,
                  flexShrink: 0,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <img
                  src={p.image ?? fallback}
                  alt={p.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: isHovered ? "scale(1.08)" : "scale(1)",
                    transition: "transform 0.4s ease",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: '"Google Sans Flex", sans-serif',
                    fontSize: 12,
                    color: "var(--navy)",
                    lineHeight: 1.35,
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    fontWeight: 400,
                  }}
                >
                  {p.name}
                </p>
                <span
                  style={{
                    fontFamily: '"Google Sans Flex", sans-serif',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--navy)",
                  }}
                >
                  ₹{p.price.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {products.length > 0 && (
        <div style={{ padding: "14px 14px 18px" }}>
          <button
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--gold)";
              (e.currentTarget as HTMLElement).style.color = "var(--navy)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--navy)";
              (e.currentTarget as HTMLElement).style.color = "var(--gold-l)";
            }}
            style={{
              width: "100%",
              padding: "11px 0",
              background: "var(--navy)",
              border: "none",
              cursor: "pointer",
              fontFamily: '"Google Sans Flex", sans-serif',
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--gold-l)",
              fontWeight: 600,
              transition: "background 0.3s, color 0.3s",
            }}
          >
            View All Trending →
          </button>
        </div>
      )}
    </aside>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShopLayout() {
  const router = useRouter();

  // Initialise from cache synchronously so first render is already populated
  const [categories, setCategories] = useState<ICategory[]>(
    () => _catsCache?.categories ?? [],
  );
  const [subcategories, setSubcategories] = useState<ISubcategory[]>(
    () => _catsCache?.subcategories ?? [],
  );
  const [products, setProducts] = useState<IProduct[]>([]);

  // If cache is warm, skip the loading skeleton entirely
  const [loadingCats, setLoadingCats] = useState(() => !_catsCache);
  const [loadingProds, setLoadingProds] = useState(false);
  const [buyersPicks, setBuyersPicks] = useState<IPickProduct[]>(
    () => _picksCache?.picks ?? [],
  );

  const [activeSub, setActiveSub] = useState<ISubcategory | null>(null);
  const [activeCat, setActiveCat] = useState<ICategory | null>(null);

  const [sortBy, setSortBy] = useState("featured");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catError, setCatError] = useState("");
  const [prodError, setProdError] = useState("");

  // ── Categories + subcategories ───────────────────────────────────────────────
  useEffect(() => {
    // Fresh cache hit: nothing to do — state already seeded in useState
    // initialisers. A stale cache still seeds the initial render (so there's
    // no loading flash for a returning user), but we fall through here to
    // revalidate it in the background so an admin's edits show up without
    // the user needing a hard refresh.
    if (_catsCache && isFresh(_catsCache.fetchedAt)) return;

    fetch("/api/categories?withSubcategories=true")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const enriched: Array<ICategory & { subcategories: ISubcategory[] }> =
          json.data ?? [];
        const cats: ICategory[] = enriched
          .filter((c) => c.isActive)
          .map(({ subcategories: _, ...cat }) => cat as ICategory);
        const subs: ISubcategory[] = enriched
          .filter((c) => c.isActive)
          .flatMap((c) => (c.subcategories ?? []).filter((s) => s.isActive));

        // Persist in module-level cache for future remounts, timestamped so
        // the next mount can tell whether it's still fresh.
        _catsCache = {
          categories: cats,
          subcategories: subs,
          fetchedAt: Date.now(),
        };
        setCategories(cats);
        setSubcategories(subs);
      })
      .catch(() => setCatError("Failed to load categories."))
      .finally(() => setLoadingCats(false));
  }, []);

  // ── Products ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSub) return;
    setLoadingProds(true);
    setProdError("");
    setProducts([]);
    const params = new URLSearchParams();
    params.set("subcategory", activeSub.slug);
    if (sortBy !== "featured") params.set("sort", sortBy);
    fetch(`/api/products?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((res) => {
        const raw = res?.data ?? res?.products ?? res?.items ?? res;
        setProducts(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setProdError("Failed to load products."))
      .finally(() => setLoadingProds(false));
  }, [activeSub, sortBy]);

  // ── Buyers picks ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Fresh cache hit: state already seeded above. A stale cache still
    // seeds the initial render, but falls through to revalidate silently.
    if (_picksCache && isFresh(_picksCache.fetchedAt)) return;

    fetch("/api/products/popular")
      .then((r) => r.json())
      .then((res) => {
        const raw = res?.data ?? [];
        const picks = Array.isArray(raw) ? raw : [];
        _picksCache = { picks, fetchedAt: Date.now() };
        setBuyersPicks(picks);
      })
      .catch(() => {
        // Picks are non-critical; fail silently
      });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function subsByCat(catId: string): ISubcategory[] {
    return subcategories.filter(
      (s) => s.category._id.toString() === catId.toString(),
    );
  }

  function handleSelectSub(sub: ISubcategory) {
    setMobileOpen(false);
    router.push(
      `/products?category=${sub.category.slug}&subcategory=${sub.slug}`,
    );
  }

  function handleSelectCat(cat: ICategory) {
    setMobileOpen(false);
    router.push(`/category/${cat.slug}`);
  }

  function handleSelectCatLocal(cat: ICategory) {
    setActiveSub(null);
    setActiveCat(cat);
  }

  function goHome() {
    setActiveSub(null);
    setActiveCat(null);
  }

  const landingCategories = activeCat
    ? categories.filter((c) => c._id === activeCat._id)
    : categories;
  const parentCat = activeSub ? activeSub.category : null;

  return (
    <>
      <div className="shop-root">
        {/* Mobile top bar */}
        <div className="mob-bar">
          <button className="mob-menu-btn" onClick={() => setMobileOpen(true)}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <rect width="12" height="1.5" rx="0.75" fill="currentColor" />
              <rect
                y="4.25"
                width="8"
                height="1.5"
                rx="0.75"
                fill="currentColor"
              />
              <rect
                y="8.5"
                width="12"
                height="1.5"
                rx="0.75"
                fill="currentColor"
              />
            </svg>
            Categories
          </button>
          <span
            style={{
              fontFamily: '"Google Sans Flex", sans-serif',
              fontSize: 15,
              fontWeight: 600,
              color: "var(--navy)",
              letterSpacing: "0.01em",
            }}
          >
            Alpha Imports
          </span>
        </div>

        <div className="shop-body">
          <div
            className={`sidebar-overlay ${mobileOpen ? "open" : ""}`}
            onClick={() => setMobileOpen(false)}
          />

          {/* ── Sidebar ── */}
          <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
            <div className="sidebar-header">
              <div className="sidebar-header-title">
                <span>Collections</span>
                <button
                  className="mob-close"
                  onClick={() => setMobileOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="sidebar-quicklinks">
              {["Advanced Diamond Search", "Advanced Precious Gem Search"].map(
                (l) => (
                  <a key={l} href="#" className="sidebar-quicklink">
                    {l}
                  </a>
                ),
              )}
            </div>

            {catError && (
              <p
                style={{
                  fontSize: 11.5,
                  color: "#b91c1c",
                  padding: "10px 18px",
                  fontFamily: '"Google Sans Flex", sans-serif',
                }}
              >
                {catError}
              </p>
            )}

            {loadingCats ? (
              <SidebarSkeleton />
            ) : (
              categories.map((cat) => (
                <SidebarGroup
                  key={cat._id}
                  category={cat}
                  subcategories={subsByCat(cat._id)}
                  activeSubSlug={activeSub?.slug ?? ""}
                  onSelectSub={handleSelectSub}
                  onSelectCat={handleSelectCat}
                />
              ))
            )}

            {["Alpha Collector's Gallery", "Vouchers", "Occasions & Gifts"].map(
              (l) => (
                <div
                  key={l}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <button
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(20,33,61,0.03)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "transparent")
                    }
                  >
                    <span
                      style={{
                        fontFamily: '"Google Sans Flex", sans-serif',
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--navy)",
                      }}
                    >
                      {l}
                    </span>
                  </button>
                </div>
              ),
            )}

            {/* Decorative bottom accent */}
            <div
              style={{
                margin: "20px 18px",
                height: 1,
                background: "var(--border)",
              }}
            />
          </aside>

          {/* ── Main ── */}
          <div className="shop-main-wrap">
            <main className="shop-main">
              {/* Breadcrumb + Sort toolbar */}
              {activeSub && (
                <div className="shop-toolbar fade-up">
                  <nav className="shop-breadcrumb">
                    <button className="breadcrumb-btn" onClick={goHome}>
                      All Collections
                    </button>
                    {parentCat && (
                      <>
                        <span className="breadcrumb-sep">›</span>
                        <button
                          className="breadcrumb-btn"
                          onClick={() => {
                            const cat = categories.find(
                              (c) => c._id === parentCat._id,
                            );
                            if (cat) handleSelectCatLocal(cat);
                          }}
                        >
                          {parentCat.name}
                        </button>
                      </>
                    )}
                    <span className="breadcrumb-sep">›</span>
                    <span className="breadcrumb-current">{activeSub.name}</span>
                  </nav>

                  <div className="toolbar-right">
                    {!loadingProds && (
                      <span className="item-count">
                        {products.length} item{products.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="sort-select"
                    >
                      <option value="featured">Featured</option>
                      <option value="price-asc">Price: Low → High</option>
                      <option value="price-desc">Price: High → Low</option>
                      <option value="name">Name A–Z</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Error */}
              {prodError && (
                <div className="error-block">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0 }}
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M8 5v3.5M8 11v.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  {prodError}
                </div>
              )}

              {/* Landing */}
              {!activeSub &&
                (loadingCats ? (
                  <LandingSkeleton />
                ) : (
                  <LandingView
                    categories={landingCategories}
                    subcategories={subcategories}
                    onSelectSub={handleSelectSub}
                    onSelectCat={handleSelectCat}
                    showHero={!activeCat}
                  />
                ))}

              {/* Products loading */}
              {activeSub && loadingProds && (
                <div className="fade-up">
                  <Skeleton w={220} h={20} style={{ marginBottom: 24 }} />
                  <div className="product-grid">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {activeSub &&
                !loadingProds &&
                !prodError &&
                products.length === 0 && (
                  <div className="empty-state fade-up">
                    <div className="empty-gem">◆</div>
                    <p
                      style={{
                        fontFamily: '"Google Sans Flex", sans-serif',
                        fontSize: 20,
                        color: "var(--navy)",
                        fontWeight: 500,
                      }}
                    >
                      Nothing in {activeSub.name} yet
                    </p>
                    <p
                      style={{
                        fontFamily: '"Google Sans Flex", sans-serif',
                        fontSize: 12.5,
                        color: "var(--text-muted)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Check back soon or explore another collection.
                    </p>
                    <button
                      onClick={goHome}
                      style={{
                        marginTop: 8,
                        padding: "10px 22px",
                        background: "var(--navy)",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: '"Google Sans Flex", sans-serif',
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--gold-l)",
                        fontWeight: 600,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.opacity =
                          "0.85")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.opacity = "1")
                      }
                    >
                      Browse All Collections
                    </button>
                  </div>
                )}

              {/* Products grid */}
              {activeSub && !loadingProds && products.length > 0 && (
                <section className="fade-up">
                  <div className="section-heading-row">
                    <h2 className="section-heading-text">{activeSub.name}</h2>
                    <div className="section-heading-rule" />
                  </div>
                  <div className="product-grid">
                    {products.map((p, i) => (
                      <div
                        key={p._id}
                        className="fade-up"
                        style={{
                          animationDelay: `${Math.min(i * 0.04, 0.32)}s`,
                        }}
                      >
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
