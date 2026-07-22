"use client";
import Link from "next/link";
import { useState } from "react";
import { cldUrl } from "@/lib/cloudinary-client";

import { WishlistIconButton } from "@/components/wishlist/WishlistButton";

interface ProductCardProps {
  productType?: "watch" | "diamond" | "gemstone";
  product: {
    _id: string;
    name: string;
    price: number;
    // gem / diamond fields
    shape?: string | string[];
    size?: number;
    color?: string | string[];
    clarity?: string | string[];
    certification?: string | string[];
    gemstoneName?: string;
    shapeRaw?: string;
    colorRaw?: string;
    clarityRaw?: string;
    gradeRaw?: string;
    // watch fields
    watchBrand?: string;
    watchModel?: string;
    watchMovement?: string;
    watchGender?: string;
    watchStyle?: string;
    watchCaseMaterial?: string;
    watchDialColor?: string;
    watchStrapType?: string;
    watchCaseSize?: string;
    watchFeatures?: string[];
    images: string[];
    stock: number;
  };
}

// ── Data helpers ────────────────────────────────────────────────────────────

function first(val?: string | string[]): string {
  if (!val) return "";
  return Array.isArray(val) ? (val[0] ?? "") : val;
}
function display(val?: string | string[]): string {
  if (!val) return "";
  return Array.isArray(val) ? val.join(", ") : val;
}
function certDisplay(val?: string | string[]): string {
  if (!val) return "";
  const arr = Array.isArray(val) ? val : [val];
  return arr.filter((c) => c !== "none").join(" · ");
}
function isWatch(p: ProductCardProps["product"]): boolean {
  return !!(
    p.watchBrand ||
    p.watchMovement ||
    p.watchGender ||
    p.watchStyle ||
    p.watchCaseMaterial ||
    p.watchDialColor ||
    p.watchStrapType ||
    p.watchCaseSize
  );
}
function cap(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function possessive(g?: string): string {
  if (!g) return "";
  const map: Record<string, string> = {
    Men: "Men's",
    Women: "Women's",
    Unisex: "Unisex",
    Boys: "Boys'",
    Girls: "Girls'",
    Kids: "Kids'",
  };
  return map[g] || g;
}

const WATCH_PLACEHOLDER =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&fit=crop";
const DIAMOND_PLACEHOLDER =
  "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80&fit=crop";

// Best-effort word -> hex map so a stated color renders as an inspection swatch.
const COLOR_HEX: Record<string, string> = {
  black: "#1C1C1E",
  white: "#F5F5F7",
  ivory: "#F2EAD9",
  cream: "#F3E9D2",
  silver: "#C8C9CC",
  gold: "#CBA658",
  "rose gold": "#E0B3A1",
  "two-tone": "#C9B37E",
  champagne: "#E8D6B3",
  blue: "#2F5FA8",
  navy: "#1F3A5F",
  green: "#2F6F4E",
  red: "#A4302F",
  brown: "#6B4A34",
  grey: "#8A8A8F",
  gray: "#8A8A8F",
  gunmetal: "#3A3D42",
  pink: "#D99AA6",
  purple: "#6B4C8A",
  salmon: "#E0917C",
  "mother of pearl": "#E9E6E1",
  bronze: "#8C6B3F",
  orange: "#D97A3D",
  yellow: "#E0C14A",
  ruby: "#A4192F",
  emerald: "#2F6F4E",
  sapphire: "#2B4C8C",
  amethyst: "#6B4C8A",
  topaz: "#D9A441",
  aquamarine: "#7FC7C6",
  peridot: "#A3C150",
  citrine: "#E0A83D",
  tanzanite: "#4A5FA5",
  morganite: "#E3A9A1",
  opal: "#E7E2DE",
  garnet: "#7A2530",
};
function swatchHex(text?: string): string | null {
  if (!text) return null;
  const key = text.trim().toLowerCase();
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  const found = Object.keys(COLOR_HEX).find((k) => key.includes(k));
  return found ? COLOR_HEX[found] : null;
}

// Lot reference — the last four hex characters of the real Mongo _id, so the
// number printed on the card is an actual stable identifier, not decoration.
function lotNumber(id: string): string {
  const clean = (id || "").replace(/[^a-fA-F0-9]/g, "");
  const tail = clean.slice(-4).toUpperCase();
  return tail || "0000";
}

// Headline descriptor — "Round-Cut Sapphire" / "Men's Sport Watch" — the
// catalog's classification line, built from the piece's own attributes.
function buildKicker(
  product: ProductCardProps["product"],
  watch: boolean,
): string {
  if (watch) {
    const parts = [possessive(product.watchGender), product.watchStyle].filter(
      Boolean,
    );
    return `${parts.join(" ")} Watch`.replace(/^\s+/, "");
  }
  const shape = first(product.shape) || product.shapeRaw;
  const stone = product.gemstoneName || "Diamond";
  const shapePart = shape ? `${cap(shape)}-Cut` : "";
  return [shapePart, stone].filter(Boolean).join(" ");
}

function buildSubtitle(
  product: ProductCardProps["product"],
  watch: boolean,
): string | undefined {
  if (!watch) return undefined;
  const parts = [product.watchBrand, product.watchModel].filter(Boolean);
  return parts.length ? parts.join(" — ") : undefined;
}

interface Particular {
  label: string;
  value: string;
  swatch?: string | null;
}

// The condition-report grid — every field shown here appears nowhere else on
// the card, so nothing is repeated twice.
function buildParticulars(
  product: ProductCardProps["product"],
  watch: boolean,
): Particular[] {
  const rows: Particular[] = [];
  if (watch) {
    if (product.watchMovement)
      rows.push({ label: "Movement", value: product.watchMovement });
    if (product.watchCaseSize)
      rows.push({ label: "Case Size", value: product.watchCaseSize });
    if (product.watchCaseMaterial)
      rows.push({ label: "Case", value: product.watchCaseMaterial });
    if (product.watchDialColor) {
      rows.push({
        label: "Dial",
        value: product.watchDialColor,
        swatch: swatchHex(product.watchDialColor),
      });
    }
    if (product.watchStrapType)
      rows.push({ label: "Strap", value: product.watchStrapType });
    if (product.watchFeatures && product.watchFeatures.length > 0) {
      const extra =
        product.watchFeatures.length > 2
          ? ` +${product.watchFeatures.length - 2}`
          : "";
      rows.push({
        label: "Features",
        value: product.watchFeatures.slice(0, 2).join(", ") + extra,
      });
    }
    return rows.slice(0, 6);
  }
  const carat = product.size ? `${product.size} ct` : "";
  if (carat) rows.push({ label: "Carat", value: carat });
  const color = display(product.color) || product.colorRaw || "";
  if (color)
    rows.push({
      label: "Color",
      value: color,
      swatch: swatchHex(product.colorRaw || first(product.color)),
    });
  const clarity = display(product.clarity) || product.clarityRaw || "";
  if (clarity) rows.push({ label: "Clarity", value: clarity });
  const certValue =
    certDisplay(product.certification) || product.gradeRaw || "";
  if (certValue)
    rows.push({
      label: certDisplay(product.certification) ? "Certification" : "Grade",
      value: certValue,
    });
  return rows.slice(0, 6);
}

// ── Icons — fine single-stroke linework, echoing engraved hallmark marks ──

function WatchIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M9 5.5V9l2 2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="7"
        y="1"
        width="4"
        height="2.3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <rect
        x="7"
        y="14.7"
        width="4"
        height="2.3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="0.9"
      />
    </svg>
  );
}
function GemIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6.5L9 2l6 4.5-6 11.5-6-11.5z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M3 6.5h12M6.5 6.5L9 2M11.5 6.5L9 2M9 6.5l-3 6M9 6.5l3 6"
        stroke="currentColor"
        strokeWidth="0.7"
      />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 14L14 4M14 4H6M14 4V12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProductImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc(fallback)}
      className="apc-photo"
      draggable={false}
    />
  );
}

export default function ProductCard({
  product,
  productType,
}: ProductCardProps) {
  const watch = productType ? productType === "watch" : isWatch(product);
  const isAvailable = product.stock > 0;
  const lowStock = isAvailable && product.stock <= 3;
  const placeholder = watch ? WATCH_PLACEHOLDER : DIAMOND_PLACEHOLDER;

  const kicker = buildKicker(product, watch);
  const subtitle = buildSubtitle(product, watch);
  const particulars = buildParticulars(product, watch);
  const lot = lotNumber(product._id);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .apc {
          --paper: #ffffff;
          --paper-deep: #ffffff;
          --brass: #a9823e;
          --brass-bright: #8f6c30;
          --ink: #17140f;
          --ink-dim: #6f665a;
          --muted: #9a9081;
          --line: rgba(20,18,14,0.09);
          --line-bright: rgba(169,130,62,0.55);
          --oxblood: #8a2e39;
          --oxblood-bright: #a8434f;
          --avail: #3f7a55;

          display: block;
          text-decoration: none;
          color: inherit;
          font-family: 'Inter', sans-serif;
          outline: none;
        }

        .apc-card {
          position: relative;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(27,24,18,0.04), 0 14px 28px -22px rgba(27,24,18,0.16);
          transition: transform 0.4s cubic-bezier(0.22,0.8,0.24,1), box-shadow 0.4s ease, border-color 0.4s ease;
        }
        .apc:hover .apc-card, .apc:focus-visible .apc-card {
          transform: translateY(-4px);
          border-color: var(--line-bright);
          box-shadow: 0 30px 48px -20px rgba(27,24,18,0.18), 0 0 0 1px rgba(169,130,62,0.14);
        }
        .apc:focus-visible .apc-card {
          box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--brass);
        }

        /* ── Lot strip — the catalog reference line ─────────────────── */
        .apc-lot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px 9px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9.5px;
          letter-spacing: 0.08em;
          color: var(--brass-bright);
          border-bottom: 1px solid var(--line);
        }
        .apc-lot-num::before { content: 'LOT № '; color: var(--ink-dim); }
        .apc-lot-type {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--ink-dim);
          text-transform: uppercase;
        }

        /* ── Plate photograph ────────────────────────────────────────── */
        .apc-mat-wrap { position: relative; padding: 10px 10px 0; }
        .apc-mat {
          position: relative;
          aspect-ratio: 1 / 1;
          border: 1px solid var(--line);
          border-radius: 4px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .apc-photo {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
         
        }
        .apc:hover .apc-photo, .apc:focus-visible .apc-photo { transform: scale(1.045); }
        .apc-mat.is-out .apc-photo {
          filter: grayscale(0.6) drop-shadow(0 6px 10px rgba(27,24,18,0.1));
          opacity: 0.5;
        }

        /* registration / crop marks — the print-plate cue, the card's one
           deliberate flourish, quiet until the piece is examined */
        .apc-crop {
          position: absolute;
          width: 13px; height: 13px;
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }
        .apc-crop::before, .apc-crop::after { content: ''; position: absolute; background: var(--brass); }
        .apc-crop::before { width: 13px; height: 1px; top: 6px; left: 0; }
        .apc-crop::after { width: 1px; height: 13px; left: 6px; top: 0; }
        .apc-crop-tl { top: 7px; left: 7px; }
        .apc-crop-tr { top: 7px; right: 7px; }
        .apc-crop-bl { bottom: 7px; left: 7px; }
        .apc-crop-br { bottom: 7px; right: 7px; }
        .apc:hover .apc-crop, .apc:focus-visible .apc-crop { opacity: 0.85; }

        .apc-stock-tag {
          position: absolute;
          top: 8px; left: 8px;
          z-index: 2;
          display: flex; align-items: center; gap: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8.5px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--oxblood-bright);
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(138,53,64,0.35);
          padding: 3px 7px;
          border-radius: 2px;
        }
        .apc-pulse {
          width: 4px; height: 4px; border-radius: 50%; background: var(--oxblood-bright);
          animation: apc-breathe 1.8s ease-in-out infinite;
        }

        .apc-ribbon {
          position: absolute;
          right: -30px; bottom: 14px;
          z-index: 3;
          transform: rotate(-45deg);
          background: var(--oxblood);
          color: var(--paper);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 3px 34px;
          box-shadow: 0 2px 8px rgba(27,24,18,0.25);
        }

        .apc-wishlist {
          position: absolute;
          top: 8px; right: 8px;
          z-index: 3;
        }

        .apc-reveal {
          position: absolute;
          left: 8px; bottom: 8px;
          z-index: 2;
          display: flex; align-items: center; gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--paper);
          background: var(--ink);
          padding: 5px 9px;
          border-radius: 2px;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .apc:hover .apc-reveal, .apc:focus-visible .apc-reveal { opacity: 1; transform: translateY(0); }

        /* ── Body ─────────────────────────────────────────────────────── */
        .apc-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 13px 16px 16px;
        }
        .apc-kicker {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--brass-bright);
        }
        .apc-name {
          margin-top: 5px;
          font-family: 'Fraunces', serif;
          font-weight: 500;
          font-size: 17px;
          color: var(--ink);
          line-height: 1.3;
          letter-spacing: -0.005em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .apc-subtitle {
          margin-top: 3px;
          font-family: 'Inter', sans-serif;
          font-style: italic;
          font-size: 11px;
          color: var(--ink-dim);
        }

        /* condition-report grid — two columns, every field appears once */
        .apc-particulars {
          margin-top: 12px;
          padding-top: 11px;
          border-top: 1px solid var(--line);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 14px;
        }
        .apc-p-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 7.5px;
          font-weight: 500;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .apc-p-value {
          margin-top: 3px;
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .apc-swatch {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0;
          border: 1px solid rgba(27,24,18,0.18);
        }

        .apc-price-row {
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1px solid var(--line);
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }
        .apc-price-label {
          display: block;
          margin-bottom: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .apc-price {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 19px;
          color: var(--ink);
        }
        .apc-price sup {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          font-weight: 500;
          color: var(--muted);
          margin-left: 3px;
        }
        .apc-avail {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 10.5px;
          font-weight: 500;
          color: var(--avail);
        }
        .apc-avail .apc-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--avail); }
        .apc-avail.out { color: var(--muted); }
        .apc-avail.out .apc-dot { background: var(--muted); }

        @keyframes apc-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        @media (prefers-reduced-motion: reduce) {
          .apc-card, .apc-photo, .apc-reveal, .apc-crop { transition: none !important; }
          .apc:hover .apc-card, .apc:focus-visible .apc-card { transform: none !important; }
          .apc-pulse { animation: none !important; }
        }
      `}</style>

      <Link href={`/products/${product._id}`} className="apc">
        <div className="apc-card">
          <div className="apc-lot-row">
            <span className="apc-lot-num">{lot}</span>
            <span className="apc-lot-type">
              {watch ? <WatchIcon /> : <GemIcon />}
              {watch ? "Watch" : "Gem"}
            </span>
          </div>

          <div className="apc-mat-wrap">
            <div className={`apc-mat ${isAvailable ? "" : "is-out"}`}>
              {product.images[0] ? (
                <ProductImage
                  src={cldUrl(product.images[0], {
                    width: 400,
                    aiUpscale: true,
                  })}
                  alt={product.name}
                  fallback={placeholder}
                />
              ) : (
                <img
                  src={placeholder}
                  alt={product.name}
                  className="apc-photo"
                />
              )}

              <span className="apc-crop apc-crop-tl" />
              <span className="apc-crop apc-crop-tr" />
              <span className="apc-crop apc-crop-bl" />
              <span className="apc-crop apc-crop-br" />

              {lowStock && (
                <div className="apc-stock-tag">
                  <span className="apc-pulse" />
                  Only {product.stock} left
                </div>
              )}

              {!isAvailable && <div className="apc-ribbon">Sold Out</div>}

              <div className="apc-wishlist">
                <WishlistIconButton productId={product._id} size="sm" />
              </div>

              {isAvailable && (
                <div className="apc-reveal" aria-hidden="true">
                  View details <ArrowIcon />
                </div>
              )}
            </div>
          </div>

          <div className="apc-body">
            <div className="apc-kicker">{kicker}</div>
            <div className="apc-name">{product.name}</div>
            {subtitle && <div className="apc-subtitle">{subtitle}</div>}

            {particulars.length > 0 && (
              <div className="apc-particulars">
                {particulars.map((row, i) => (
                  <div key={i}>
                    <div className="apc-p-label">{row.label}</div>
                    <div className="apc-p-value">
                      {row.swatch && (
                        <span
                          className="apc-swatch"
                          style={{ background: row.swatch }}
                        />
                      )}
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="apc-price-row">
              <div>
                <span className="apc-price-label">Price</span>
                <span className="apc-price">
                  ${product.price.toLocaleString()}
                  <sup>USD</sup>
                </span>
              </div>
              <span className={`apc-avail ${isAvailable ? "" : "out"}`}>
                <span className="apc-dot" />
                {isAvailable ? `${product.stock} available` : "Sold out"}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}