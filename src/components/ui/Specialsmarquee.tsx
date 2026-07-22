"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { cldUrl } from "@/lib/cloudinary-client";

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

function ProductCard({
  product,
  featured = false,
}: {
  product: ApiProduct;
  featured?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImg = product.images?.length > 0 && !imgError;

  return (
    <Link
      href={`/products/${product._id}`}
      style={{ textDecoration: "none", display: "block" }}
      className="product-card"
    >
      {/* Image — capped smaller, rounded, shadowed */}
      <div
        style={{
          position: "relative",
          paddingBottom: "82%",
          background: "#f8f9fa",
          overflow: "hidden",
          borderRadius: 14,
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        {hasImg ? (
          <img
            src={cldUrl(product.images[0], {
              width: featured ? 700 : 500,
              quality: "auto:best",
              format: "auto",
              aiUpscale: true,
            })}
            alt={product.name}
            onError={() => setImgError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
            }}
            className="card-img"
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f1f5f9",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {product.stock <= 5 && product.stock > 0 && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(4px)",
              borderRadius: 20,
              padding: "3px 9px",
              fontSize: 9.5,
              fontWeight: 600,
              color: "#dc2626",
              letterSpacing: "0.05em",
              boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
            }}
          >
            {product.stock} left
          </span>
        )}

        {/* subtle gradient wash on hover for depth */}
        <div
          className="img-wash"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(15,23,42,0.10), transparent 40%)",
            opacity: 0,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: "13px 2px 0" }}>
        <p
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#94a3b8",
            margin: "0 0 5px",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "#cbd5e1",
              flexShrink: 0,
            }}
          />
          {getSubtitle(product) || product.category?.name}
        </p>
        <p
          style={
            {
              fontFamily: '"Elms Sans", sans-serif',
              fontSize: featured ? 18 : 14.5,
              fontWeight: 500,
              color: "#0f172a",
              margin: "0 0 7px",
              lineHeight: 1.35,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties
          }
        >
          {product.name}
        </p>
        <p
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            fontSize: featured ? 19 : 15.5,
            fontWeight: 600,
            color: "#0f172a",
            margin: 0,
          }}
        >
          ${product.price.toLocaleString()}
          {product.size && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: "#94a3b8",
                marginLeft: 3,
              }}
            >
              /ct
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div>
      <div
        style={{
          paddingBottom: "82%",
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div className="skel" style={{ position: "absolute", inset: 0 }} />
      </div>
      <div style={{ paddingTop: 13 }}>
        <div
          className="skel"
          style={{ height: 9, width: "40%", marginBottom: 8, borderRadius: 2 }}
        />
        <div
          className="skel"
          style={{ height: 14, width: "78%", marginBottom: 7, borderRadius: 2 }}
        />
        <div
          className="skel"
          style={{ height: 17, width: "32%", borderRadius: 2 }}
        />
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
          .map((p) => [
            p.category._id,
            { key: p.category._id, label: p.category.name },
          ]),
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
    if (totalPages > 1) {
      autoRef.current = setInterval(
        () => setPage((p) => (p + 1) % totalPages),
        5000,
      );
    }
  }, [totalPages]);

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
    <>
      <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');


        @keyframes shimmer {
          from { background-position: -600px 0; }
          to   { background-position:  600px 0; }
        }

        .skel {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 600px 100%;
          animation: shimmer 1.5s infinite linear;
        }

        .product-card {
          transition: transform 0.28s cubic-bezier(0.22,1,0.36,1);
        }
        .product-card:hover { transform: translateY(-5px); }
        .product-card:hover .card-img { transform: scale(1.06); }
        .product-card:hover .img-wash { opacity: 1; }

        .cat-pill {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          padding: 7px 17px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .cat-pill:hover { border-color: #cbd5e1; color: #0f172a; background: #f8fafc; }
        .cat-pill.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
          box-shadow: 0 4px 12px rgba(15,23,42,0.22);
        }

        .view-all-btn {
          font-size: 12.5px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: #0f172a;
          text-decoration: none;
          padding: 9px 18px;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .view-all-btn:hover { border-color: #0f172a; background: #0f172a; color: #fff; }

        .our-collection-title {
          position: relative;
          display: inline-block;
        }
        .our-collection-title::after {
          content: "";
          position: absolute;
          left: 1px;
          bottom: -10px;
          width: 44px;
          height: 3px;
          border-radius: 2px;
          background: linear-gradient(90deg, #0f172a, #94a3b8);
        }
      `}</style>

      <section
        style={{
          background: "#fff",
          borderTop: "1px solid #f1f5f9",
          padding: "72px 0 80px",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 44,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  margin: "0 0 8px",
                }}
              >
                Curated selection
              </p>
              <h2
                className="our-collection-title"
                style={{
                  fontFamily: '"Elms Sans", sans-serif',
                  fontSize: "clamp(30px, 3.2vw, 44px)",
                  fontWeight: 500,
                  color: "#0f172a",
                  lineHeight: 1,
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Our Collection
              </h2>
            </div>
            <Link href="/products" className="view-all-btn">
              View all products
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Category filters */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 40,
              paddingBottom: 32,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            {loading
              ? [60, 80, 72, 90, 68].map((w, i) => (
                  <div
                    key={i}
                    className="skel"
                    style={{ height: 34, width: w, borderRadius: 20 }}
                  />
                ))
              : categories.map((cat) => (
                  <button
                    key={cat.key}
                    className={`cat-pill${activeCategory === cat.key ? " active" : ""}`}
                    onClick={() => setActiveCategory(cat.key)}
                  >
                    {cat.label}
                  </button>
                ))}
          </div>

          {/* Products grid */}
          {error ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              Could not load products.{" "}
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0f172a",
                  cursor: "pointer",
                  fontSize: 13,
                  textDecoration: "underline",
                }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="specials-grid">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 0",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              No products in this category.
            </div>
          ) : (
            <div className="specials-grid">
              {visible.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination dots */}
          {!loading && !error && totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 48,
              }}
            >
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Page ${i + 1}`}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === page ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    background: i === page ? "#0f172a" : "#e2e8f0",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <style>{`
        .specials-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 28px 20px;
        }
        @media (max-width: 1024px) { .specials-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px)  { .specials-grid { grid-template-columns: repeat(2, 1fr); gap: 20px 14px; } }
        @media (max-width: 380px)  { .specials-grid { grid-template-columns: repeat(1, 1fr); } }
      `}</style>
    </>
  );
}
