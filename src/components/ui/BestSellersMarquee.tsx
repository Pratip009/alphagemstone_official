"use client";

import { useState, useEffect, useRef } from "react";

// ─── Type matches the /api/products/popular aggregate output ──────────────────
interface IPopularProduct {
  _id: string;       // product ObjectId (stringified)
  name: string;
  image?: string;    // single image string stored on the order item
  price: number;
  orderedAt: string; // ISO date string
}

const FALLBACK_IMGS = [
  "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=300",
  "https://images.pexels.com/photos/248077/pexels-photo-248077.jpeg?auto=compress&cs=tinysrgb&w=300",
  "https://images.pexels.com/photos/691046/pexels-photo-691046.jpeg?auto=compress&cs=tinysrgb&w=300",
  "https://images.pexels.com/photos/965981/pexels-photo-965981.jpeg?auto=compress&cs=tinysrgb&w=300",
];

// ─── Card ─────────────────────────────────────────────────────────────────────
function BestSellerCard({
  product,
  index,
}: {
  product: IPopularProduct;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const img = product.image ?? FALLBACK_IMGS[index % FALLBACK_IMGS.length];

  const rankGradients = [
    "linear-gradient(135deg, #e8c96a, #b8922a)",
    "linear-gradient(135deg, #d8d8d8, #a0a0a0)",
    "linear-gradient(135deg, #e8a060, #b86530)",
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 200,
        flexShrink: 0,
        background: hovered
          ? "linear-gradient(160deg, rgba(255,255,255,0.09) 0%, rgba(184,146,42,0.08) 100%)"
          : "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
        border: hovered
          ? "1px solid rgba(232,201,106,0.35)"
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 4,
        overflow: "hidden",
        transition:
          "background 0.35s, border-color 0.35s, transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s",
        transform: hovered
          ? "translateY(-6px) scale(1.01)"
          : "translateY(0) scale(1)",
        boxShadow: hovered
          ? "0 20px 48px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,201,106,0.2)"
          : "0 4px 16px -4px rgba(0,0,0,0.3)",
        cursor: "pointer",
      }}
    >
      {/* Image */}
      <div
        style={{
          width: "100%",
          height: 160,
          overflow: "hidden",
          position: "relative",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <img
          src={img}
          alt={product.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: hovered ? "scale(1.1)" : "scale(1)",
            transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
            opacity: hovered ? 1 : 0.88,
          }}
        />

        {/* Bottom gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 40%, rgba(10,20,50,0.85) 100%)",
          }}
        />

        {/* Rank badge — top 3 only */}
        {index < 3 && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 24,
              height: 24,
              background: rankGradients[index],
              clipPath:
                "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: '"Elms Sans", sans-serif',
              fontSize: 9,
              fontWeight: 800,
              color: "#1a1a2e",
            }}
          >
            {index + 1}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        <p
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            fontSize: 13,
            fontWeight: 500,
            color: hovered ? "#fff" : "rgba(240,235,255,0.88)",
            lineHeight: 1.4,
            marginBottom: 10,
            transition: "color 0.25s",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {product.name}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: '"Elms Sans", sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: "#e8c96a",
            }}
          >
            ₹{product.price.toLocaleString("en-IN")}
          </span>

          {/* Arrow — appears on hover */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: "1px solid rgba(232,201,106,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: hovered ? 1 : 0,
              transform: hovered
                ? "scale(1) rotate(0deg)"
                : "scale(0.7) rotate(-45deg)",
              transition:
                "opacity 0.25s, transform 0.3s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 5H9M5 1L9 5L5 9"
                stroke="#e8c96a"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="bs-skeleton"
        style={{ width: "100%", height: 160 }}
      />
      <div style={{ padding: "12px 14px 14px" }}>
        <div
          className="bs-skeleton"
          style={{ width: "80%", height: 13, marginBottom: 8, borderRadius: 2 }}
        />
        <div
          className="bs-skeleton"
          style={{ width: "50%", height: 13, borderRadius: 2 }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BestSellersMarquee() {
  const [items, setItems]       = useState<IPopularProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [paused, setPaused]     = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const animRef  = useRef<number>(0);
  const posRef   = useRef(0);

  const SPEED  = 0.55;          // px per rAF
  const CARD_W = 200 + 16;      // card width + gap

  // ── Fetch from real API ──────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/products/popular")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const raw: IPopularProduct[] = json?.data ?? [];
        setItems(raw);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // ── rAF marquee loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    const loopWidth = items.length * CARD_W;
    posRef.current = 0;

    function step() {
      if (!paused) {
        posRef.current += SPEED;
        if (posRef.current >= loopWidth) posRef.current -= loopWidth;
        if (track) track.style.transform = `translateX(-${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [paused, items]);

  // Triple-clone for seamless loop
  const tripled = [...items, ...items, ...items];

  return (
    <>
      <style>{`
       @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');


        .bs-section {
          background: linear-gradient(160deg, #0d1528 0%, #0a1020 40%, #111827 100%);
          padding: 48px 0 52px;
          position: relative;
          overflow: hidden;
        }
        .bs-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(ellipse 70% 50% at 20% 50%, rgba(184,146,42,0.06) 0%, transparent 65%),
            radial-gradient(ellipse 50% 60% at 80% 20%, rgba(15,52,96,0.25) 0%, transparent 55%);
          pointer-events: none;
        }
        .bs-section::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(232,201,106,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,201,106,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 100%);
        }

        /* Header */
        .bs-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 0 32px 28px;
          position: relative;
          z-index: 2;
        }
        .bs-eyebrow {
          font-family: "Elms Sans", sans-serif;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.36em;
          text-transform: uppercase;
          color: #e8c96a;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bs-eyebrow::before, .bs-eyebrow::after {
          content: '';
          display: inline-block;
          width: 24px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #e8c96a);
        }
        .bs-eyebrow::after { background: linear-gradient(90deg, #e8c96a, transparent); }
        .bs-title {
          font-family: "Elms Sans", sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.01em;
          line-height: 1;
        }
        .bs-title em { font-style: italic; color: rgba(232,201,106,0.85); }
        .bs-count-pill {
          font-family: "Elms Sans", sans-serif;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(232,201,106,0.7);
          border: 1px solid rgba(232,201,106,0.2);
          padding: 5px 14px;
          border-radius: 20px;
          background: rgba(232,201,106,0.04);
        }

        /* Gold rule */
        .bs-accent-line {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(232,201,106,0.5) 20%, rgba(232,201,106,0.8) 50%, rgba(232,201,106,0.5) 80%, transparent 100%);
          margin: 0 32px 32px;
          position: relative;
          z-index: 2;
        }

        /* Marquee */
        .bs-marquee-wrap {
          position: relative;
          z-index: 2;
          overflow: hidden;
        }
        .bs-marquee-wrap::before,
        .bs-marquee-wrap::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          width: 80px;
          z-index: 3;
          pointer-events: none;
        }
        .bs-marquee-wrap::before {
          left: 0;
          background: linear-gradient(to right, #0a1020 0%, transparent 100%);
        }
        .bs-marquee-wrap::after {
          right: 0;
          background: linear-gradient(to left, #0a1020 0%, transparent 100%);
        }
        .bs-track {
          display: flex;
          gap: 16px;
          padding: 8px 32px 12px;
          width: max-content;
          will-change: transform;
        }

        /* Skeleton shimmer */
        @keyframes bsShimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .bs-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 400px 100%;
          animation: bsShimmer 1.6s infinite linear;
        }

        /* Error */
        .bs-error {
          padding: 32px;
          text-align: center;
          font-family: "Elms Sans", sans-serif;
          font-size: 12px;
          letter-spacing: 0.08em;
          color: rgba(232,201,106,0.4);
          position: relative;
          z-index: 2;
        }

        /* Footer */
        .bs-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: 28px;
          position: relative;
          z-index: 2;
        }
        .bs-cta-btn {
          font-family: "Elms Sans", sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #1a1a2e;
          background: linear-gradient(135deg, #e8c96a 0%, #b8922a 100%);
          border: none;
          padding: 10px 28px;
          cursor: pointer;
          border-radius: 1px;
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 4px 16px rgba(184,146,42,0.3);
        }
        .bs-cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .bs-pause-btn {
          font-family: "Elms Sans", sans-serif;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(232,201,106,0.55);
          background: transparent;
          border: 1px solid rgba(232,201,106,0.18);
          padding: 9px 18px;
          cursor: pointer;
          border-radius: 1px;
          transition: border-color 0.2s, color 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bs-pause-btn:hover { color: rgba(232,201,106,0.85); border-color: rgba(232,201,106,0.4); }

        @media (max-width: 600px) {
          .bs-header { padding: 0 16px 24px; }
          .bs-accent-line { margin: 0 16px 24px; }
          .bs-title { font-size: 22px; }
          .bs-track { gap: 12px; padding: 8px 16px 12px; }
        }
      `}</style>

      <section
        className="bs-section"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Header */}
        <div className="bs-header">
          <div>
            <div className="bs-eyebrow">Best Sellers</div>
            <h2 className="bs-title">
              Curated <em>Picks</em>
            </h2>
          </div>
          {!loading && !error && items.length > 0 && (
            <div className="bs-count-pill">{items.length} Pieces</div>
          )}
        </div>

        <div className="bs-accent-line" />

        {/* Loading skeletons */}
        {loading && (
          <div className="bs-marquee-wrap">
            <div className="bs-track">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bs-error">Unable to load bestsellers</div>
        )}

        {/* Marquee */}
        {!loading && !error && items.length > 0 && (
          <div className="bs-marquee-wrap">
            <div ref={trackRef} className="bs-track">
              {tripled.map((product, i) => (
                <BestSellerCard
                  key={`${product._id}-${i}`}
                  product={product}
                  index={i % items.length}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && items.length > 0 && (
          <div className="bs-footer">
            <button className="bs-cta-btn">Shop All Bestsellers →</button>
            <button
              className="bs-pause-btn"
              onClick={(e) => {
                e.stopPropagation();
                setPaused((p) => !p);
              }}
            >
              {paused ? (
                <>
                  <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
                    <path d="M1 1L7 5L1 9V1Z" fill="currentColor" />
                  </svg>
                  Play
                </>
              ) : (
                <>
                  <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
                    <rect x="0" y="0" width="3" height="10" rx="1" fill="currentColor" />
                    <rect x="6" y="0" width="3" height="10" rx="1" fill="currentColor" />
                  </svg>
                  Pause
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </>
  );
}