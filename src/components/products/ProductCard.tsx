"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { optimizedImageUrl } from "@/lib/image-url";
import { WishlistIconButton } from "@/components/wishlist/WishlistButton";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { cartEvents } from "@/hooks/useCart";
import { buildProductSpecs, type ProductKind } from "@/lib/productSpecs";
import { isDiamondAlternative } from "@/lib/diamondAlternatives"

interface ProductCardProps {
  productType?: "watch" | "diamond" | "gemstone";
  product: {
    _id: string;
    slug?: string;
    name: string;
    price: number;
    // Original / list price shown struck through next to the (lower)
    // selling price. Only rendered when it's actually set and genuinely
    // higher than `price` — mirrors the same check the product detail
    // page uses for its "Market Retail Price" savings line.
    msrp?: number;
    description?: string;
    shape?: string | string[];
    size?: number;
    color?: string | string[];
    clarity?: string | string[];
    certification?: string | string[];
    gemstoneName?: string;
    productKind?: string;
    // Populated { name, slug } on every listing; a bare id elsewhere.
    category?: unknown;
    subcategory?: unknown;
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
    // Full spec-sheet fields — same ones the product detail page reads via
    // buildProductSpecs() (src/lib/productSpecs.ts). Optional because the
    // lighter-weight grid/wishlist/recently-viewed sources don't always
    // carry every one, but when present the Quick View modal renders the
    // identical rows the full page would show.
    legacyAttributes?: Record<string, string>;
    cutType?: string;
    luster?: string;
    hardness?: string;
    treatment?: string;
    origin?: string;
    caratWeight?: number;
    dimensions?: string;
    approxWeight?: string;
    numberOfStones?: number;
    weight?: number;
    manufacturerId?: string;
    minOrder?: number;
    makeAnOffer?: boolean;
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

// Maps this card's narrower productType/watch-detection onto the
// ProductKind the shared spec-sheet builder (src/lib/productSpecs.ts)
// expects — the same union the full detail page resolves via
// getProductKind(). ProductCard never deals with plain "jewelry" items
// today, so anything non-watch falls back to gemstone-or-diamond exactly
// like the rest of this file already does (buildKicker, etc).
function deriveKind(
  product: ProductCardProps["product"],
  watch: boolean,
): ProductKind {
  if (watch) return "watch";
  // Moissanite, CZ and simulated/lab-created stones are never diamonds.
  if (isDiamondAlternative(product.name, product.gemstoneName)) return "gemstone";
  const stored = product.productKind;
  if (stored === "diamond" || stored === "gemstone" || stored === "jewelry" || stored === "watch") return stored;
  if (product.gemstoneName) return "gemstone";
  return "diamond";
}

/** Subcategory name ("Blue Diamonds", "Moissanite"), else category name. */
function categoryBadge(product: ProductCardProps["product"]): string {
  const nameOf = (v: unknown): string =>
    v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string"
      ? (v as { name: string }).name.trim()
      : "";
  return nameOf(product.subcategory) || nameOf(product.category);
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
  // Only the product's real gem name — never a default like "Diamond".
  const stone = product.gemstoneName || "";
  // "other" is a catch-all value, not a cut — never print "Other-Cut".
  const shapePart = shape && shape.toLowerCase() !== "other" ? `${cap(shape)}-Cut` : "";
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

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 14L14 4M14 4H6M14 4V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 4h2l1.6 10.6a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L20 8H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10V7a2 2 0 1 1 4 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9.5" cy="20" r="1.4" fill="currentColor" />
      <circle cx="16.5" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Small circular "add to cart" action that lives on the card itself —
// mirrors WishlistIconButton's interaction pattern (stop the card <Link>
// from navigating, redirect to login if signed out, otherwise fire the
// same /api/cart POST the product-detail AddToCartButton uses) so a
// shopper never has to open the product page just to add one unit.
function QuickAddButton({
  productId,
  inStock,
}: {
  productId: string;
  inStock: boolean;
}) {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (authLoading || busy || !inStock) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      cartEvents.refresh();
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy || !inStock}
      aria-label={inStock ? "Add to cart" : "Out of stock"}
      className={`apc-icon-btn${added ? " is-added" : ""}`}
      title={inStock ? "Add to cart" : "Out of stock"}
    >
      {added ? <CheckIcon /> : <CartIcon />}
    </button>
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

// ── Quick View ──────────────────────────────────────────────────────────────
// A minified read of the product-detail page (image, kicker/name, specs,
// description, price, stock, Add to Cart) rendered as a modal on top of
// whatever page the shopper is browsing — so they can check the details
// without leaving the grid, and still add to cart right from it. Portaled
// to <body> so it isn't clipped/relatively-positioned by the card's own
// `overflow: hidden`, and so it never ends up nested inside the card's
// <Link>.
function QuickViewModal({
  product,
  watch,
  kind,
  kicker,
  subtitle,
  placeholder,
  hasMsrpSavings,
  savingsPct,
  isAvailable,
  onClose,
}: {
  product: ProductCardProps["product"];
  watch: boolean;
  kind: ProductKind;
  kicker: string;
  subtitle?: string;
  placeholder: string;
  hasMsrpSavings: boolean;
  savingsPct: number;
  isAvailable: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  // Full spec sheet — same rows/labels as the product detail page (see
  // src/lib/productSpecs.ts). "Availability" is dropped from this list
  // since it's already surfaced as its own highlighted line below.
  const specs = buildProductSpecs(product, kind).filter(
    (row) => row.label !== "Availability",
  );

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="apc-qv-overlay"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="apc-qv-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Quick view — ${product.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="apc-qv-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close quick view"
        >
          <CloseIcon />
        </button>

        <div className="apc-qv-media">
          {product.images[0] ? (
            <ProductImage
              src={optimizedImageUrl(product.images[0], { width: 600 })}
              alt={product.name}
              fallback={placeholder}
            />
          ) : (
            <img src={placeholder} alt={product.name} className="apc-photo" />
          )}
        </div>

        <div className="apc-qv-info">
          <div className="apc-kicker">{kicker}</div>
          <h3 className="apc-qv-name">{product.name}</h3>
          {subtitle && <div className="apc-subtitle">{subtitle}</div>}

          {specs.length > 0 && (
            <div className="apc-specs apc-qv-specs">
              {specs.map((row, i) => (
                <div key={i}>
                  <div className="apc-spec-label">{row.label}</div>
                  <div
                    className="apc-spec-value"
                    style={row.highlight ? { color: "var(--avail)" } : undefined}
                  >
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {product.description && (
            <p className="apc-qv-desc">{product.description}</p>
          )}

          <div className="apc-qv-price-row">
            <div className="apc-price-block">
              <span className="apc-price-label">Price</span>
              <div className="apc-price">
                ${product.price.toLocaleString()}
                <span>USD</span>
              </div>
              {hasMsrpSavings && (
                <div className="apc-qv-was">
                  <span className="apc-qv-was-price">
                    ${(product.msrp as number).toLocaleString()}
                  </span>
                  <span className="apc-qv-save-badge">-{savingsPct}%</span>
                </div>
              )}
            </div>
            <div className={`apc-stock ${isAvailable ? "" : "out"}`}>
              {isAvailable ? `${product.stock} available` : "Sold out"}
            </div>
          </div>

          <div className="apc-qv-cart">
            <AddToCartButton productId={product._id} inStock={isAvailable} />
          </div>

          <Link
            href={`/products/${product.slug ?? product._id}`}
            className="apc-qv-full-link"
            onClick={onClose}
          >
            View full details <ArrowIcon />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
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
  const badge = categoryBadge(product);
  const particulars = buildParticulars(product, watch);
  const lot = lotNumber(product._id);

  // Same "only show a comparison when it's real" rule as the product-detail
  // page: an original price only renders (struck through) when msrp is set
  // and genuinely higher than the selling price.
  const hasMsrpSavings =
    typeof product.msrp === "number" && product.msrp > product.price;
  const savingsPct = hasMsrpSavings
    ? Math.round(
        (((product.msrp as number) - product.price) /
          (product.msrp as number)) *
          100,
      )
    : 0;

  const [quickViewOpen, setQuickViewOpen] = useState(false);

  return (
    <>
      <style>{`
        

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
          font-family: 'Elms Sans', system-ui, sans-serif;
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
          font-family: 'Elms Sans', system-ui, sans-serif;
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
          max-width: 62%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--accent);
          background: var(--accent-soft);
          padding: 4px 9px;
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

        /* Vertical stack of circular actions — wishlist, quick view, quick
           add-to-cart — pinned to the top-right corner of the image. Always
           visible (not hover-gated) so the same actions work on touch
           devices, which have no hover state to reveal anything. */
        .apc-icon-stack {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 3;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .apc-icon-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #eaeaec;
          color: #57575d;
          cursor: pointer;
          transition: color 0.2s, transform 0.15s, border-color 0.2s, background 0.2s;
          backdrop-filter: blur(2px);
          flex-shrink: 0;
        }

        .apc-icon-btn:hover {
          color: var(--accent);
          border-color: rgba(176, 141, 74, 0.4);
        }

        .apc-icon-btn:active {
          transform: scale(0.9);
        }

        .apc-icon-btn:disabled {
          color: #c7c7cc;
          cursor: not-allowed;
        }

        .apc-icon-btn.is-added {
          color: #fff;
          background: var(--avail);
          border-color: var(--avail);
        }

        /* Hover-revealed "Quick view" pill, centered under the stone —
           the fast path to a minified detail view without leaving the
           grid. Desktop-only flourish (see the touch-device override
           below); the icon-stack button above covers touch. */
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
          cursor: pointer;
        }

        .apc:hover .apc-cta,
        .apc:focus-visible .apc-cta {
          opacity: 1;
          transform: translate(-50%, 0);
          pointer-events: auto;
        }

        .apc-cta:hover {
          border-color: rgba(176, 141, 74, 0.5);
          color: var(--accent);
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
          font-family: 'Elms Sans';
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
          font-family: 'Elms Sans';
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

        .apc-price-now-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }

        .apc-price-was {
          font-size: 13px;
          font-weight: 600;
          color: var(--oxblood);
          text-decoration: line-through;
          text-decoration-color: var(--oxblood);
          text-decoration-thickness: 1.5px;
        }

        .apc-save-badge {
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--oxblood);
          background: #fbeceb;
          padding: 2px 7px;
          border-radius: 999px;
          line-height: 1.5;
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

        /* ── Quick View modal ────────────────────────────────────────────
           Portaled to <body>, so these rules are written unscoped (no .apc
           ancestor) — they only ever match the modal's own markup. */
        .apc-qv-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(20, 18, 14, 0.55);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: apc-qv-fade 0.2s ease;
        }

        @keyframes apc-qv-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .apc-qv-panel {
          position: relative;
          background: #fff;
          width: 100%;
          max-width: 760px;
          max-height: 88vh;
          overflow-y: auto;
          border-radius: 18px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 0;
          box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.35);
          font-family: 'Elms Sans', system-ui, sans-serif;
          animation: apc-qv-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes apc-qv-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .apc-qv-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid #ebebea;
          color: #57575d;
          cursor: pointer;
        }

        .apc-qv-close:hover {
          color: #1a1a1c;
          border-color: #d4d4d2;
        }

        .apc-qv-media {
          background: #fafaf9;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
        }

        .apc-qv-media .apc-photo {
          max-width: 90%;
          max-height: 320px;
        }

        .apc-qv-info {
          padding: 28px 28px 24px;
          display: flex;
          flex-direction: column;
        }

        .apc-qv-name {
          font-family: 'Elms Sans';
          font-weight: 600;
          font-size: 22px;
          line-height: 1.25;
          letter-spacing: -0.015em;
          color: #1a1a1c;
          margin-top: 2px;
        }

        .apc-qv-specs {
          margin-top: 16px;
        }

        .apc-qv-desc {
          margin-top: 16px;
          font-size: 13px;
          line-height: 1.55;
          color: #4a4a50;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .apc-qv-price-row {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #ebebea;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .apc-qv-was {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }

        .apc-qv-was-price {
          font-size: 12.5px;
          font-weight: 600;
          color: #9c3b45;
          text-decoration: line-through;
          text-decoration-color: #9c3b45;
          text-decoration-thickness: 1.5px;
        }

        .apc-qv-save-badge {
          font-size: 10px;
          font-weight: 700;
          color: #9c3b45;
          background: #fbeceb;
          padding: 2px 7px;
          border-radius: 999px;
        }

        .apc-qv-cart {
          margin-top: 18px;
        }

        .apc-qv-full-link {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #7a5f2a;
          text-decoration: none;
        }

        .apc-qv-full-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .apc-qv-panel {
            grid-template-columns: 1fr;
            max-height: 92vh;
          }
          .apc-qv-media { padding: 20px; }
          .apc-qv-media .apc-photo { max-height: 220px; }
          .apc-qv-info { padding: 20px 18px; }
        }
      `}</style>

      <Link href={`/products/${product.slug ?? product._id}`} className="apc">
        <article className="apc-card">
          {/* Header */}
          <div className="apc-header">
            <div className="apc-lot">
              <span>LOT</span>
              {lot}
            </div>
            {badge && (
              <div className="apc-type" title={badge}>
                {badge}
              </div>
            )}
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

              <div className="apc-icon-stack">
                <WishlistIconButton productId={product._id} size="sm" />
                <button
                  className="apc-icon-btn"
                  aria-label="Quick view"
                  title="Quick view"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuickViewOpen(true);
                  }}
                >
                  <EyeIcon />
                </button>
                <QuickAddButton productId={product._id} inStock={isAvailable} />
              </div>

              {isAvailable && (
                <button
                  className="apc-cta"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuickViewOpen(true);
                  }}
                >
                  Quick view <ArrowIcon />
                </button>
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
                <div className="apc-price-now-row">
                  <div className="apc-price">
                    ${product.price.toLocaleString()}
                    <span>USD</span>
                  </div>
                  {hasMsrpSavings && (
                    <>
                      <span className="apc-price-was">
                        ${(product.msrp as number).toLocaleString()}
                      </span>
                      <span className="apc-save-badge">-{savingsPct}%</span>
                    </>
                  )}
                </div>
              </div>
              <div className={`apc-stock ${isAvailable ? "" : "out"}`}>
                {isAvailable ? `${product.stock} available` : "Sold out"}
              </div>
            </div>
          </div>
        </article>
      </Link>

      {quickViewOpen && (
        <QuickViewModal
          product={product}
          watch={watch}
          kind={deriveKind(product, watch)}
          kicker={kicker}
          subtitle={subtitle}
          placeholder={placeholder}
          hasMsrpSavings={hasMsrpSavings}
          savingsPct={savingsPct}
          isAvailable={isAvailable}
          onClose={() => setQuickViewOpen(false)}
        />
      )}
    </>
  );
}