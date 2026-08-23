"use client";
import Link from "next/link";
import { useState } from "react";
import { optimizedImageUrl } from "@/lib/image-url";
import { WishlistIconButton } from "@/components/wishlist/WishlistButton";

interface ProductCardProps {
  productType?: "watch" | "diamond" | "gemstone";
  product: {
    _id: string;
    name: string;
    price: number;
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

function lotNumber(id: string): string {
  const clean = (id || "").replace(/[^a-fA-F0-9]/g, "");
  const tail = clean.slice(-4).toUpperCase();
  return tail || "0000";
}

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
    return rows.slice(0, 4);
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
  return rows.slice(0, 4);
}

// ── Icons ───────────────────────────────────────────────────────────────────

function WatchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 5.5V9l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="1" width="4" height="2.3" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <rect x="7" y="14.7" width="4" height="2.3" rx="0.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function GemIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 6.5L9 2l6 4.5-6 11.5-6-11.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M3 6.5h12M6.5 6.5L9 2M11.5 6.5L9 2M9 6.5l-3 6M9 6.5l3 6" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 14L14 4M14 4H6M14 4V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');

        .apc {
          --paper: #ffffff;
          --paper-soft: #fafaf9;
          --ink: #1a1a1c;
          --ink-soft: #4a4a50;
          --muted: #9a9aa0;
          --line: #ebebea;
          --line-strong: #d4d4d2;
          --accent: #b08d4a;
          --accent-soft: #f7f2e8;
          --oxblood: #9c3b45;
          --avail: #2d7a52;

          display: block;
          text-decoration: none;
          color: inherit;
          font-family: 'Inter', system-ui, sans-serif;
          outline: none;
          width: 100%;
          height: 100%;
        }

        .apc-card {
          position: relative;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          transition: 
            transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.35s ease;
        }

        .apc:hover .apc-card,
        .apc:focus-visible .apc-card {
          transform: translateY(-5px);
          border-color: rgba(176, 141, 74, 0.38);
          box-shadow: 
            0 26px 48px -18px rgba(107, 79, 30, 0.22),
            0 10px 22px -10px rgba(26, 26, 28, 0.08);
        }

        .apc:focus-visible .apc-card {
          box-shadow: 
            0 0 0 2px var(--paper),
            0 0 0 4px var(--accent),
            0 20px 40px -16px rgba(26, 26, 28, 0.12);
        }

        /* ── Header strip ─────────────────────────────────────────────── */
        .apc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px 10px;
          border-bottom: 1px solid var(--line);
        }

        .apc-lot {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--muted);
        }
        .apc-lot span {
          color: #c5c5c8;
          margin-right: 3px;
        }

        .apc-type {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--accent);
          background: var(--accent-soft);
          padding: 4px 9px 4px 7px;
          border-radius: 999px;
        }

        /* ── Image area ───────────────────────────────────────────────── */
        .apc-visual {
          position: relative;
          padding: 16px 20px 14px;
          display: flex;
          justify-content: center;
          background: radial-gradient(ellipse 65% 65% at 50% 45%, rgba(176, 141, 74, 0.07), transparent 72%);
        }

        .apc-frame {
          position: relative;
          width: 100%;
          max-width: 150px;
          aspect-ratio: 1 / 1;
          background: var(--paper-soft);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow:
            inset 0 1px 3px rgba(26, 26, 28, 0.05),
            inset 0 -1px 2px rgba(255, 255, 255, 0.7);
        }

        /* Jeweler's-loupe corner brackets, inset from the tray edge */
        .apc-frame::before {
          content: "";
          position: absolute;
          top: 7px;
          left: 7px;
          right: 7px;
          bottom: 7px;
          background:
            linear-gradient(var(--accent), var(--accent)) top left / 11px 1.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) top left / 1.5px 11px no-repeat,
            linear-gradient(var(--accent), var(--accent)) top right / 11px 1.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) top right / 1.5px 11px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom left / 11px 1.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom left / 1.5px 11px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom right / 11px 1.5px no-repeat,
            linear-gradient(var(--accent), var(--accent)) bottom right / 1.5px 11px no-repeat;
          opacity: 0.45;
          transition: opacity 0.35s ease;
          pointer-events: none;
          z-index: 1;
        }

        .apc:hover .apc-frame::before,
        .apc:focus-visible .apc-frame::before {
          opacity: 1;
        }

        /* Soft studio-light highlight over the stone */
        .apc-frame::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 22%, rgba(255, 255, 255, 0.55), transparent 45%);
          pointer-events: none;
        }

        .apc-photo {
          position: relative;
          z-index: 1;
          max-width: 76%;
          max-height: 76%;
          object-fit: contain;
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .apc:hover .apc-photo,
        .apc:focus-visible .apc-photo {
          transform: scale(1.06);
        }

        .apc-frame.is-out .apc-photo {
          filter: grayscale(0.7);
          opacity: 0.4;
        }

        .apc-frame.is-out::before {
          opacity: 0.2;
        }

        /* Status badges */
        .apc-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 4px 9px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .apc-badge.low {
          color: var(--oxblood);
          border-color: rgba(156, 59, 69, 0.2);
        }

        .apc-badge.sold {
          background: var(--ink);
          color: #fff;
          border-color: transparent;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .apc-wishlist {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 3;
        }

        .apc-cta {
          position: absolute;
          left: 50%;
          bottom: 12px;
          transform: translate(-50%, 8px);
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--ink);
          background: #fff;
          border: 1px solid var(--line-strong);
          padding: 7px 14px;
          border-radius: 999px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease, transform 0.3s ease;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }

        .apc:hover .apc-cta,
        .apc:focus-visible .apc-cta {
          opacity: 1;
          transform: translate(-50%, 0);
        }

        /* ── Body ─────────────────────────────────────────────────────── */
        .apc-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 4px 18px 18px;
        }

        .apc-kicker {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 3px;
        }

        .apc-name {
          font-family: 'Fraunces', Georgia, serif;
          font-weight: 600;
          font-size: 19px;
          line-height: 1.3;
          letter-spacing: -0.015em;
          color: var(--ink);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .apc-subtitle {
          margin-top: 3px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
        }

        /* Specs grid */
        .apc-specs {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--line);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 16px;
        }

        .apc-spec-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 2px;
        }

        .apc-spec-value {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .apc-swatch {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1px solid rgba(0,0,0,0.12);
        }

        /* Price row */
        .apc-footer {
          margin-top: auto;
          padding-top: 14px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }

        .apc-price-block {
          display: flex;
          flex-direction: column;
        }

        .apc-price-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 2px;
        }

        .apc-price {
          font-family: 'Fraunces', Georgia, serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: -0.02em;
          color: var(--ink);
          line-height: 1;
        }

        .apc-price span {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
          margin-left: 3px;
          vertical-align: super;
        }

        .apc-stock {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--avail);
          white-space: nowrap;
        }

        .apc-stock::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .apc-stock.out {
          color: var(--muted);
        }

        /* ── Responsive ───────────────────────────────────────────────── */
        @media (max-width: 900px) {
          .apc-frame { max-width: 135px; }
          .apc-name { font-size: 16.5px; }
          .apc-price { font-size: 20px; }
        }

        @media (max-width: 640px) {
          .apc-card { border-radius: 14px; }

          .apc-header { padding: 10px 14px 0; }
          .apc-visual { padding: 10px 14px 6px; }
          .apc-frame { max-width: 130px; border-radius: 10px; }

          .apc-body { padding: 2px 14px 14px; }
          .apc-kicker { font-size: 9.5px; }
          .apc-name { font-size: 15.5px; }
          .apc-subtitle { font-size: 12px; }

          .apc-specs {
            grid-template-columns: 1fr 1fr;
            gap: 8px 12px;
            margin-top: 12px;
            padding-top: 10px;
          }
          .apc-spec-label { font-size: 9.5px; }
          .apc-spec-value { font-size: 12.5px; }

          .apc-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding-top: 12px;
          }
          .apc-price { font-size: 19px; }

          /* Hide hover CTA on touch devices */
          .apc-cta { display: none; }
        }

        @media (max-width: 400px) {
          .apc-specs { grid-template-columns: 1fr; gap: 7px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .apc-card,
          .apc-photo,
          .apc-cta {
            transition: none !important;
          }
          .apc:hover .apc-card,
          .apc:focus-visible .apc-card {
            transform: none !important;
          }
        }
      `}</style>

      <Link href={`/products/${product._id}`} className="apc">
        <article className="apc-card">
          {/* Header */}
          <div className="apc-header">
            <div className="apc-lot">
              <span>LOT</span>
              {lot}
            </div>
            <div className="apc-type">
              {watch ? <WatchIcon /> : <GemIcon />}
              {watch ? "Watch" : "Gem"}
            </div>
          </div>

          {/* Image */}
          <div className="apc-visual">
            <div className={`apc-frame ${isAvailable ? "" : "is-out"}`}>
              {product.images[0] ? (
                <ProductImage
                  src={optimizedImageUrl(product.images[0], {
                    width: 420,
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

              {lowStock && (
                <div className="apc-badge low">Only {product.stock} left</div>
              )}
              {!isAvailable && <div className="apc-badge sold">Sold Out</div>}

              <div className="apc-wishlist">
                <WishlistIconButton productId={product._id} size="sm" />
              </div>

              {isAvailable && (
                <div className="apc-cta" aria-hidden="true">
                  View details <ArrowIcon />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="apc-body">
            <div className="apc-kicker">{kicker}</div>
            <h3 className="apc-name">{product.name}</h3>
            {subtitle && <div className="apc-subtitle">{subtitle}</div>}

            {particulars.length > 0 && (
              <div className="apc-specs">
                {particulars.map((row, i) => (
                  <div key={i}>
                    <div className="apc-spec-label">{row.label}</div>
                    <div className="apc-spec-value">
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

            <div className="apc-footer">
              <div className="apc-price-block">
                <span className="apc-price-label">Price</span>
                <div className="apc-price">
                  ${product.price.toLocaleString()}
                  <span>USD</span>
                </div>
              </div>
              <div className={`apc-stock ${isAvailable ? "" : "out"}`}>
                {isAvailable ? `${product.stock} available` : "Sold out"}
              </div>
            </div>
          </div>
        </article>
      </Link>
    </>
  );
}