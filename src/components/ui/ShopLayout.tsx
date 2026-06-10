"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

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
let _catsCache: {
  categories: ICategory[];
  subcategories: ISubcategory[];
} | null = null;

let _picksCache: IPickProduct[] | null = null;

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
        borderRadius: 4,
        background: "#f3f1ee",
        display: "block",
        ...style,
      }}
    />
  );
}

// ─── Subcategory circle card (landing) ────────────────────────────────────────
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
        alignItems: "center",
        cursor: "pointer",
        gap: 14,
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          maxWidth: 180,
          margin: "0 auto",
          overflow: "hidden",
          position: "relative",
          borderRadius: "50%",
          border: hovered
            ? "1.5px solid rgba(255,255,255,0.35)"
            : "1.5px solid rgba(255,255,255,0.1)",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          transition:
            "transform 0.35s cubic-bezier(0.22,1,0.36,1), border-color 0.3s ease",
          outline: hovered
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid transparent",
          outlineOffset: "5px",
        }}
      >
        <img
          src={sub.imageUrl ?? fallback}
          alt={sub.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
      <p
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 13,
          fontWeight: 500,
          color: hovered ? "#b8922a" : "#1a1a2e",
          textAlign: "center",
          lineHeight: 1.4,
          transition: "color 0.25s",
          letterSpacing: "0.02em",
        }}
      >
        {sub.name}
      </p>
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
        background: "#fff",
        borderRadius: 2,
        transition:
          "transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s cubic-bezier(0.22,1,0.36,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 20px 48px -12px rgba(26,26,46,0.18)"
          : "0 2px 12px -4px rgba(26,26,46,0.08)",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          position: "relative",
          overflow: "hidden",
          borderRadius: "2px 2px 0 0",
          background: "#f8f6f2",
        }}
      >
        <img
          src={img}
          alt={product.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: hovered ? "scale(1.07)" : "scale(1)",
            transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 50%, rgba(26,26,46,0.6) 100%)",
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
              fontSize: 8,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#fff",
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 500,
              border: "1px solid rgba(255,255,255,0.6)",
              padding: "5px 14px",
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
              fontSize: 7,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 600,
              background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
              color: "#e8c96a",
              padding: "3px 9px",
            }}
          >
            {product.tag}
          </div>
        )}
      </div>

      <div
        style={{ padding: "14px 12px 16px", borderTop: "1px solid #f0ece4" }}
      >
        <p
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 13,
            color: "#1a1a2e",
            lineHeight: 1.45,
            marginBottom: 4,
            fontWeight: 400,
          }}
        >
          {product.name}
        </p>
        {product.origin && (
          <p
            style={{
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#b8922a",
              fontFamily: '"Playfair Display", Georgia, serif',
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            {product.origin}
          </p>
        )}
        <p
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 14,
            color: "#0f3460",
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
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Skeleton
        h={0}
        style={{ width: "100%", aspectRatio: "1", borderRadius: 0 }}
      />
      <div
        style={{ padding: "14px 12px 16px", borderTop: "1px solid #f0ece4" }}
      >
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
    <div style={{ borderBottom: "1px solid rgba(26,26,46,0.08)" }}>
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
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 13,
              fontWeight: 700,
              color: "#1a1a2e",
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
              color: "#9f9fc0",
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
                    ? "linear-gradient(90deg, rgba(184,146,42,0.08), transparent)"
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderLeft: isActive
                    ? "2px solid #b8922a"
                    : "2px solid transparent",
                  transition: "background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(26,26,46,0.03)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontFamily: '"Playfair Display", Georgia, serif',
                    color: isActive ? "#b8922a" : "#4a5568",
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: "0.03em",
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
                fontSize: 10,
                color: "#b8922a",
                fontFamily: '"Playfair Display", Georgia, serif',
                letterSpacing: "0.08em",
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
            borderBottom: "1px solid rgba(26,26,46,0.08)",
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
}: {
  categories: ICategory[];
  subcategories: ISubcategory[];
  onSelectSub: (sub: ISubcategory) => void;
  onSelectCat: (cat: ICategory) => void;
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
                marginBottom: 28,
                paddingBottom: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                borderBottom: "1px solid transparent",
                backgroundImage:
                  "linear-gradient(90deg, #e8c96a 0%, rgba(184,146,42,0.15) 40%, transparent 80%)",
                backgroundSize: "100% 1px",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "bottom",
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
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#1a1a2e",
                    letterSpacing: "-0.01em",
                    background:
                      "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
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
                    fontSize: 10,
                    color: "#b8922a",
                    fontFamily: '"Playfair Display", Georgia, serif',
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  View all {totalCount} →
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: "32px 20px",
                gridTemplateColumns: "repeat(4, 1fr)",
              }}
            >
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
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 48 }}>
          <Skeleton w={180} h={18} style={{ marginBottom: 20 }} />
          <div
            style={{
              display: "grid",
              gap: "20px 16px",
              gridTemplateColumns: "repeat(4, 1fr)",
            }}
          >
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Skeleton
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "50%",
                  }}
                />
                <Skeleton w="65%" h={11} />
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
        borderLeft: "1px solid rgba(26,26,46,0.08)",
        background: "#fff",
        position: "sticky",
        top: 0,
        maxHeight: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "linear-gradient(160deg, #1a1a2e 0%, #0f3460 100%)",
          padding: "18px 18px 14px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(184,146,42,0.25), transparent 70%)",
          }}
        />
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
              <path d="M5 0L10 5L5 10L0 5Z" fill="#e8c96a" />
            </svg>
            <span
              style={{
                fontSize: 8,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#e8c96a",
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: 600,
              }}
            >
              Curated Picks
            </span>
          </div>
          <p
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 16,
              fontWeight: 700,
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
          background:
            "linear-gradient(90deg, transparent, #e8c96a 40%, #b8922a 60%, transparent)",
        }}
      />

      <div style={{ padding: "6px 0" }}>
        {products.map((p, i) => {
          const isHovered = hovered === p._id;
          const rankColors = [
            "linear-gradient(135deg, #e8c96a, #b8922a)",
            "linear-gradient(135deg, #d0d0d0, #a0a0a0)",
            "linear-gradient(135deg, #e8a060, #cd7f32)",
          ];
          return (
            <div
              key={p._id}
              onMouseEnter={() => setHovered(p._id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid rgba(26,26,46,0.06)",
                cursor: "pointer",
                background: isHovered
                  ? "linear-gradient(90deg, rgba(184,146,42,0.05), transparent)"
                  : "transparent",
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
                  background:
                    rankColors[i] ??
                    "linear-gradient(135deg, #0f3460, #1a3a6b)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: '"Playfair Display", Georgia, serif',
                  clipPath:
                    "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  width: 58,
                  height: 58,
                  flexShrink: 0,
                  borderRadius: "50%",
                  overflow: "hidden",
                  boxShadow: isHovered
                    ? "0 6px 18px -4px rgba(184,146,42,0.4)"
                    : "0 2px 8px -2px rgba(0,0,0,0.12)",
                  transition: "box-shadow 0.3s",
                }}
              >
                <img
                  src={p.image ?? fallback}
                  alt={p.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: isHovered ? "scale(1.1)" : "scale(1)",
                    transition: "transform 0.4s ease",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontSize: 11.5,
                    color: "#1a1a2e",
                    lineHeight: 1.35,
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {p.name}
                </p>
                <span
                  style={{
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0f3460",
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
              (e.currentTarget as HTMLElement).style.background =
                "linear-gradient(135deg, #e8c96a, #b8922a)";
              (e.currentTarget as HTMLElement).style.color = "#1a1a2e";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "linear-gradient(135deg, #1a1a2e, #0f3460)";
              (e.currentTarget as HTMLElement).style.color = "#e8c96a";
            }}
            style={{
              width: "100%",
              padding: "10px 0",
              background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
              border: "none",
              cursor: "pointer",
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 9,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#e8c96a",
              fontWeight: 600,
              transition: "background 0.3s, color 0.3s",
              borderRadius: 1,
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
    () => _picksCache ?? [],
  );

  const [activeSub, setActiveSub] = useState<ISubcategory | null>(null);
  const [activeCat, setActiveCat] = useState<ICategory | null>(null);

  const [sortBy, setSortBy] = useState("featured");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catError, setCatError] = useState("");
  const [prodError, setProdError] = useState("");

  // ── Categories + subcategories ───────────────────────────────────────────────
  useEffect(() => {
    // Cache hit: nothing to do — state already seeded in useState initialisers
    if (_catsCache) return;

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

        // Persist in module-level cache for future remounts
        _catsCache = { categories: cats, subcategories: subs };
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
    // Cache hit: state already seeded above
    if (_picksCache) return;

    fetch("/api/products/popular")
      .then((r) => r.json())
      .then((res) => {
        const raw = res?.data ?? [];
        const picks = Array.isArray(raw) ? raw : [];
        _picksCache = picks;
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy:   #1a1a2e;
          --deep:   #0f3460;
          --gold:   #b8922a;
          --gold-l: #e8c96a;
          --cream:  #faf8f4;
          --border: rgba(26,26,46,0.08);
          --sidebar-w: 224px;
        }

        .shop-root {
          font-family: 'Barlow Condensed', sans-serif;
          background: var(--cream);
          min-height: 100vh;
          color: #1a1a2e;
        }

        /* ── Shimmer skeleton ── */
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .skeleton-pulse {
          background: linear-gradient(90deg, #f0ece4 25%, #faf8f4 50%, #f0ece4 75%);
          background-size: 600px 100%;
          animation: shimmer 1.6s infinite linear;
        }

        /* ── Fade up ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .fade-up { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Landing section stagger ── */
        .landing-section {
          opacity: 0;
          animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
        }

        /* ── Layout ── */
        .shop-body {
          display: flex;
          align-items: flex-start;
          min-height: 100vh;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: var(--sidebar-w);
          flex-shrink: 0;
          background: #fff;
          border-right: 1px solid var(--border);
          min-height: 100vh;
          position: sticky;
          top: 0;
          max-height: 100vh;
          overflow-y: auto;
          transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
          scrollbar-width: thin;
          scrollbar-color: #e0d8cc transparent;
        }
        .sidebar::-webkit-scrollbar { width: 3px; }
        .sidebar::-webkit-scrollbar-thumb { background: #e0d8cc; }

        .sidebar-header {
          padding: 16px 18px 14px;
          background: linear-gradient(160deg, #1a1a2e 0%, #0f3460 100%);
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .sidebar-header-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 9px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #e8c96a;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .mob-close {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.6);
          font-size: 18px;
          line-height: 1;
          padding: 0;
        }

        .sidebar-quicklinks {
          padding: 10px 0 8px;
          border-bottom: 1px solid var(--border);
        }
        .sidebar-quicklink {
          display: block;
          padding: 5px 18px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11.5px;
          color: var(--deep);
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: color 0.2s, padding-left 0.2s;
        }
        .sidebar-quicklink:hover { color: var(--gold); padding-left: 22px; }

        /* ── Main content ── */
        .shop-main-wrap {
          display: flex;
          align-items: flex-start;
          flex: 1;
          min-width: 0;
        }

        .shop-main {
          flex: 1;
          padding: 28px 28px 64px;
          min-width: 0;
        }

        /* ── Toolbar ── */
        .shop-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
          gap: 10px;
        }

        .shop-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          letter-spacing: 0.05em;
        }
        .breadcrumb-btn {
          background: none; border: none; cursor: pointer;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px; color: var(--deep);
          letter-spacing: 0.05em;
          transition: color 0.2s;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .breadcrumb-btn:hover { color: var(--gold); }
        .breadcrumb-sep { color: #c0bcd0; font-size: 10px; }
        .breadcrumb-current { color: #6b6880; }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .item-count {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: #9f9fc0;
          text-transform: uppercase;
        }

        .sort-select {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: #1a1a2e;
          background: #fff;
          border: 1px solid var(--border);
          padding: 6px 12px;
          cursor: pointer;
          outline: none;
          border-radius: 2px;
          transition: border-color 0.2s;
        }
        .sort-select:focus { border-color: var(--gold); }

        /* ── Product grid ── */
        .product-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 520px)  { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 860px)  { .product-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 1200px) { .product-grid { grid-template-columns: repeat(5, 1fr); } }

        /* ── Landing grid ── */
        .landing-sub-grid {
          display: grid;
          gap: 32px 20px;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 680px) { .landing-sub-grid { grid-template-columns: repeat(2, 1fr); gap: 24px 16px; } }

        /* ── Mobile ── */
        .mob-bar {
          display: none;
          align-items: center;
          padding: 10px 16px;
          background: #fff;
          border-bottom: 1px solid var(--border);
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .mob-menu-btn {
          display: none;
          align-items: center;
          gap: 7px;
          background: linear-gradient(135deg, #1a1a2e, #0f3460);
          border: none;
          cursor: pointer;
          padding: 7px 12px;
          color: #e8c96a;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 600;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .sidebar-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(26,26,46,0.5);
          z-index: 40;
          backdrop-filter: blur(2px);
          animation: fadeIn 0.2s ease;
        }

        /* ── Error block ── */
        .error-block {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
          background: rgba(192,57,43,0.05);
          border: 1px solid rgba(192,57,43,0.2);
          border-left: 3px solid rgba(192,57,43,0.5);
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px; letter-spacing: 0.04em;
          color: #c0392b;
          border-radius: 0 2px 2px 0;
          margin-bottom: 20px;
        }

        /* ── Empty state ── */
        .empty-state {
          padding: 80px 20px;
          text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .empty-gem {
          font-size: 40px;
          opacity: 0.1;
          animation: orbPulse 3s ease-in-out infinite;
        }
        @keyframes orbPulse {
          0%,100% { opacity: 0.1; transform: scale(1); }
          50%      { opacity: 0.18; transform: scale(1.08); }
        }

        /* ── Section heading ── */
        .section-heading-row {
          display: flex; align-items: center; gap: 14px; margin-bottom: 22px;
        }
        .section-heading-text {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px; font-weight: 700; color: var(--deep);
          white-space: nowrap; font-style: italic;
        }
        .section-heading-rule {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, var(--border), transparent);
        }

        /* ── Responsive breakpoints ── */
        @media (max-width: 767px) {
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            z-index: 50;
            transform: translateX(-100%);
            box-shadow: 8px 0 32px rgba(26,26,46,0.18);
            max-height: 100vh;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-overlay.open { display: block; }
          .mob-menu-btn   { display: flex !important; }
          .mob-close      { display: block !important; }
          .mob-bar        { display: flex !important; }
          .shop-main      { padding: 16px 14px 48px; }
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ddd8cc; border-radius: 2px; }
      `}</style>

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
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 15,
              fontWeight: 700,
              color: "#1a1a2e",
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
                  fontSize: 11,
                  color: "#b91c1c",
                  padding: "10px 18px",
                  fontFamily: '"Playfair Display", Georgia, serif',
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
                  style={{ borderBottom: "1px solid rgba(26,26,46,0.08)" }}
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
                        "rgba(26,26,46,0.03)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "transparent")
                    }
                  >
                    <span
                      style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1a1a2e",
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
                background:
                  "linear-gradient(90deg, transparent, #e8c96a 50%, transparent)",
                opacity: 0.5,
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
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 20,
                        color: "#1a1a2e",
                        fontStyle: "italic",
                      }}
                    >
                      Nothing in {activeSub.name} yet
                    </p>
                    <p
                      style={{
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 12,
                        color: "#9f9fc0",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Check back soon or explore another collection.
                    </p>
                    <button
                      onClick={goHome}
                      style={{
                        marginTop: 8,
                        padding: "9px 22px",
                        background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: '"Playfair Display", Georgia, serif',
                        fontSize: 9,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        color: "#e8c96a",
                        fontWeight: 600,
                        borderRadius: 1,
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
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 10 10"
                      fill="none"
                      style={{ flexShrink: 0 }}
                    >
                      <path
                        d="M5 0L10 5L5 10L0 5Z"
                        fill="#e8c96a"
                        opacity="0.7"
                      />
                    </svg>
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

            {/* Buyers Picks sidebar — only when picks exist */}
            {buyersPicks.length > 0 && (
              <BuyersPicks products={buyersPicks} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}