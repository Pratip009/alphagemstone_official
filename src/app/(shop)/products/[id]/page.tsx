import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getProductById } from "@/services/product.service";
import Product from "@/models/Product";
import AddToCartButton from "@/components/cart/AddToCartButton";
import Link from "next/link";
import WishlistButton from "@/components/wishlist/WishlistButton";
import RecordRecentlyViewed from "@/components/products/RecordRecentlyViewed";
import RecentlyViewedProducts from "@/components/products/RecentlyViewedProducts";
import CompareLaunchButton from "@/components/compare/CompareLaunchButton";
import ProductReviews from "@/components/products/ProductReviews";
import type { Metadata } from "next";
import { cache } from "react";
import { optimizedImageUrl } from "@/lib/image-url";
// ─── Types ────────────────────────────────────────────────────────────────────
type ProductDoc = {
  _id: unknown;
  name: string;
  price: number;
  productKind?: "diamond" | "gemstone" | "watch" | "jewelry";

  // Diamond / gemstone
  shape?: string | string[];
  shapeRaw?: string;
  size?: number;
  color?: string | string[];
  colorRaw?: string;
  clarity?: string | string[];
  clarityRaw?: string;
  gradeRaw?: string;
  gemstoneName?: string;
  certification?: string | string[];

  // Everything else from the legacy catalog that doesn't map to a fixed
  // enum (cut, luster, hardness, treatment, origin, metal, ring size,
  // carat/size ranges, approx weight, dimensions, etc.)
  legacyAttributes?: Record<string, string>;

  // Typed attribute fields from the schema (preferred over the equivalent
  // free-text legacyAttributes entry when present)
  approxWeight?: string;
  numberOfStones?: number;
  cutType?: string;
  luster?: string;
  hardness?: string;
  treatment?: string;
  origin?: string;
  caratWeight?: number;
  dimensions?: string;

  // Legacy "matched categories" export fields
  weight?: number;
  msrp?: number;
  manufacturerId?: string;
  minOrder?: number;
  maxOrder?: number;
  qtyBlocks?: number;
  makeAnOffer?: boolean;

  // Watch
  watchBrand?: string;
  watchModel?: string;
  watchMovement?: string;
  watchGender?: string;
  watchStyle?: string;
  watchStrapType?: string;
  watchCaseMaterial?: string;
  watchDialColor?: string;
  watchCaseSize?: string;
  watchFeatures?: string[];

  images: string[];
  stock: number;
  description?: string;
  category?: { name: string; slug?: string };
  subcategory?: { name: string; slug?: string };
};

type RelatedItem = {
  id: string;
  name: string;
  price: number;
  img: string;
  shape?: string;
  size?: number;
  color?: string;
  clarity?: string;
  watchBrand?: string;
  watchMovement?: string;
  watchGender?: string;
};

type ProductKind = "watch" | "diamond" | "gemstone" | "jewelry";

type Spec = { label: string; value: string; highlight?: boolean };

// Wrap the existing getProductById() with React's cache() so that
// generateMetadata() and the page component — which both need the same
// product for the same request — share one underlying DB lookup instead
// of querying twice. product.service.ts itself is untouched.
const getCachedProduct = cache((id: string) => getProductById(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await connectDB();
  const { id } = await params;
  const raw = await getCachedProduct(id);

  if (!raw) {
    return { title: "Product Not Found | Alpha Gemstone" };
  }

  const p = raw as unknown as ProductDoc;

  const description = p.description?.trim()
    ? p.description.trim().slice(0, 160)
    : `Shop ${p.name}${
        p.category?.name ? ` — ${p.category.name}` : ""
      } at Alpha Gemstone, offering fine diamonds, gemstones & jewelry.`;

  return {
    title: `${p.name} | Alpha Gemstone`,
    description,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function first(val?: string | string[]): string {
  if (!val) return "";
  return Array.isArray(val) ? (val[0] ?? "") : val;
}
function display(val?: string | string[]): string {
  if (!val) return "";
  return Array.isArray(val) ? val.join(", ") : val;
}
function capitalize(val?: string | string[]): string {
  const s = first(val);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function certDisplay(val?: string | string[]): string {
  if (!val) return "—";
  const arr = Array.isArray(val) ? val : [val];
  const filtered = arr.filter((c) => c && c.toLowerCase() !== "none");
  return filtered.length > 0 ? filtered.join(", ") : "—";
}
function isWatchDoc(p: ProductDoc): boolean {
  return !!(p.watchBrand || p.watchMovement || p.watchGender);
}

// Prefer the stored, explicit classification (productKind — set at import
// time in fileParser.service.ts) over guessing from which fields happen to
// be populated. Falls back to inference only for older records that predate
// the productKind field.
function getProductKind(p: ProductDoc): ProductKind {
  if (p.productKind) return p.productKind;
  if (isWatchDoc(p)) return "watch";
  const categoryName = (p.category?.name ?? "").toLowerCase();
  if (categoryName.includes("diamond")) return "diamond";
  if (p.gemstoneName) return "gemstone";
  return "jewelry";
}

// "metalMaterial" -> "Metal Material" — used only for legacyAttributes keys
// that aren't already surfaced under a named label below, so nothing
// captured at import time silently disappears from the page.
function titleCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

// legacyAttributes keys that are internal bookkeeping, not customer-facing
// specs, and should never render even as a leftover row.
const SKIP_ATTR_KEYS = new Set(["legacyCategoryRaw", "shippingWeight"]);

// ─── Spec table builder ────────────────────────────────────────────────────
// Builds the "spec sheet" rows for a product, tailored per productKind.
// Every row is only added when a value actually exists — no hardcoded "—"
// placeholders for fields that were never captured on that product, and no
// bleed-through of irrelevant fields (a gemstone won't show "Movement", a
// watch won't show "Clarity").
function buildSpecs(p: ProductDoc, kind: ProductKind): Spec[] {
  const attrs = p.legacyAttributes ?? {};
  const rows: Spec[] = [];
  const usedAttrKeys = new Set<string>();

  const push = (
    label: string,
    value: string | number | undefined | null,
    opts?: { highlight?: boolean },
  ) => {
    if (value === undefined || value === null || value === "") return;
    rows.push({ label, value: String(value), highlight: opts?.highlight });
  };
  // Reads a legacyAttributes key and marks it "already shown" so it isn't
  // duplicated in the leftover-attributes pass at the end.
  const attr = (key: string): string | undefined => {
    usedAttrKeys.add(key);
    return attrs[key] || undefined;
  };

  if (kind === "diamond") {
    push("Item", "Diamond");
    push("Polish", attr("polish"));
    push("Shape", p.shapeRaw || capitalize(p.shape));
    push("Cut", p.cutType || attr("cut"));
    push("Color", p.colorRaw || display(p.color));
    push("Size", p.dimensions || attr("dimensions"));
    push("Depth", attr("depth"));
    push("Treatment", p.treatment || attr("treatment"));
    push("Clarity", p.clarityRaw || display(p.clarity));
    const cert = certDisplay(p.certification);
    if (cert !== "—") push("Certification", cert);
    const diamondApproxWeightAttr = p.approxWeight || attr("approxWeight");
    push(
      "Approx Weight",
      diamondApproxWeightAttr
        ? `${diamondApproxWeightAttr} ct.`
        : p.caratWeight
          ? `${p.caratWeight} ct.`
          : p.size
            ? `${p.size} ct.`
            : undefined,
    );
  } else if (kind === "gemstone") {
    push("Name", p.gemstoneName || p.name);
    push("Shape", p.shapeRaw || capitalize(p.shape));
    push("Cut", p.cutType || attr("cut"));
    push("Color", p.colorRaw || display(p.color));
    push("Origin", p.origin || attr("origin"));
    push("Size", p.dimensions || attr("dimensions"));
    push("Luster", p.luster || attr("luster"));
    push("Treatment", p.treatment || attr("treatment"));
    push("Hardness", p.hardness || attr("hardness"));
    push("Clarity", p.clarityRaw || display(p.clarity));
    // attr() must be called unconditionally here — if it only runs on the
    // right side of `||` (i.e. only when p.gradeRaw is empty), the 'grade'
    // key never gets marked "used" on products that have both, and it
    // resurfaces a second time in the leftover-attributes pass below,
    // producing a duplicate "Grade" row (and a React duplicate-key error).
    const gradeAttr = attr("grade");
    push("Grade", p.gradeRaw || gradeAttr);
    const approxWeightAttr = p.approxWeight || attr("approxWeight");
    push(
      "Approx Weight",
      approxWeightAttr
        ? `${approxWeightAttr} ct.`
        : p.caratWeight
          ? `${p.caratWeight} ct.`
          : p.size
            ? `${p.size} ct.`
            : undefined,
    );
  } else if (kind === "watch") {
    push("Brand", p.watchBrand);
    push("Model", p.watchModel);
    push("Movement", p.watchMovement);
    push("Gender", p.watchGender);
    push("Style", p.watchStyle);
    push("Strap", p.watchStrapType);
    push("Case Material", p.watchCaseMaterial);
    push("Dial Color", p.watchDialColor);
    push("Case Size", p.watchCaseSize);
    push("Features", p.watchFeatures?.join(", "));
  } else {
    // jewelry / silver / vouchers / anything without a dedicated kind
    push("Metal", attr("metalMaterial"));
    push("Metal Weight", attr("metalWeight"));
    push("Ring Size", attr("ringSize"));
    push("Size Range", attr("sizeRange"));
    push("Carat Range", attr("caratRange"));
    push("Shape", p.shapeRaw || capitalize(p.shape));
    push("Color", p.colorRaw || display(p.color));
  }

  // Fields captured on every product kind from the legacy "matched
  // categories" export, not just diamonds/gemstones/watches.
  push("Number of Stones", p.numberOfStones);
  push("Item Weight", p.weight ? `${p.weight} g` : undefined);
  push("Manufacturer", p.manufacturerId);
  if (p.minOrder && p.minOrder > 1) {
    push("Minimum Order Qty", p.minOrder);
  }
  if (p.makeAnOffer) push("Make An Offer", "Available on this item");

  // Anything still sitting in legacyAttributes that wasn't already pulled
  // out above — keeps the page honest instead of quietly dropping data
  // that was captured at import time (e.g. a diamond row that happens to
  // also carry an "origin" value, or a gemstone with a stray "ringSize").
  for (const [key, value] of Object.entries(attrs)) {
    if (usedAttrKeys.has(key) || SKIP_ATTR_KEYS.has(key) || !value) continue;
    push(titleCase(key), value);
  }

  push("Availability", p.stock > 0 ? `${p.stock} in stock` : "Out of stock", {
    highlight: p.stock > 0,
  });

  return rows;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function WatchIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M9 5.5V9l2 2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="7"
        y="1"
        width="4"
        height="2.5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect
        x="7"
        y="14.5"
        width="4"
        height="2.5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function DiamondIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 16L2 7l2.5-5h9L16 7z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M2 7h14M9 16L5 7l4-5 4 5z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
// Distinct icon for colored gemstones — emerald-cut silhouette rather than
// the brilliant-cut diamond shape, so the two badges read differently at a glance.
function GemstoneIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="3"
        width="10"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M4 7h10M4 11h10M8 3v12M10 3v12"
        stroke="currentColor"
        strokeWidth="0.9"
      />
    </svg>
  );
}
// Jewelry / silver / vouchers — simple ring silhouette.
function JewelryIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="11" r="5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M9 6L6.5 2h5L9 6z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function kindIcon(kind: ProductKind) {
  if (kind === "watch") return <WatchIcon />;
  if (kind === "diamond") return <DiamondIcon />;
  if (kind === "gemstone") return <GemstoneIcon />;
  return <JewelryIcon />;
}

// ─── Small decorative icons for the legacy sidebar panels ──────────────────
function FacebookIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 8h2V4h-2a4 4 0 0 0-4 4v2H9v4h2v6h4v-6h2.5l.5-4H15V8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4l16 16M20 4L4 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function QuestionIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.36-1 1-1 1.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}
function PrinterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 6.5l8.5 6 8.5-6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LEARNING_CENTER_LINKS = [
  "Shipping and Returns",
  "Privacy Policy",
  "SSL Certificate",
  "Customer Support",
  "Contact Us",
  "FAQ",
  "Testimonials",
  "Ring Sizes",
];

// ─── Related products ─────────────────────────────────────────────────────────
async function getRelatedProducts(
  p: ProductDoc,
  excludeId: string,
  limit = 4,
): Promise<RelatedItem[]> {
  const watch = isWatchDoc(p);
  let docs: any[] = [];

  if (watch) {
    docs = await Product.find({
      watchBrand: p.watchBrand,
      _id: { $ne: excludeId },
      isActive: true,
      stock: { $gt: 0 },
    })
      .limit(limit)
      .lean();

    if (docs.length < limit) {
      const existingIds = docs.map((d) => String(d._id));
      const fallback = await Product.find({
        watchBrand: { $exists: true },
        _id: { $nin: [excludeId, ...existingIds] },
        isActive: true,
        stock: { $gt: 0 },
      })
        .limit(limit - docs.length)
        .lean();
      docs = [...docs, ...fallback];
    }
  } else {
    docs = await Product.find({
      shape: { $regex: new RegExp(first(p.shape), "i") },
      _id: { $ne: excludeId },
      isActive: true,
      stock: { $gt: 0 },
    })
      .limit(limit)
      .lean();

    if (docs.length < limit) {
      const existingIds = docs.map((d) => String(d._id));
      const fallback = await Product.find({
        _id: { $nin: [excludeId, ...existingIds] },
        isActive: true,
        stock: { $gt: 0 },
      })
        .limit(limit - docs.length)
        .lean();
      docs = [...docs, ...fallback];
    }
  }

  return docs.map((r) => ({
    id: String(r._id),
    name: r.name as string,
    price: r.price as number,
    img: (r.images as string[])?.[0] ?? "",
    shape: first(r.shape as string | string[]),
    size: r.size as number,
    color: first(r.color as string | string[]),
    clarity: first(r.clarity as string | string[]),
    watchBrand: r.watchBrand as string | undefined,
    watchMovement: r.watchMovement as string | undefined,
    watchGender: r.watchGender as string | undefined,
  }));
}

// ─── Static content ───────────────────────────────────────────────────────────
const TRUST_ITEMS = [
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "SSL Secured",
    sub: "Bank-grade encryption",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path
          d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    ),
    label: "Free Insured Shipping",
    sub: "On all orders worldwide",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <polyline
          points="1 4 1 10 7 10"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.51 15a9 9 0 1 0 .49-4.95"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
    label: "30-Day Returns",
    sub: "Hassle-free policy",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Complimentary Gift",
    sub: "Luxury packaging included",
  },
];



const TESTIMONIALS = [
  {
    quote: "Absolutely breathtaking quality. My fiancée was speechless.",
    author: "James R.",
    location: "New York",
    stars: 5,
  },
  {
    quote: "The craftsmanship is extraordinary. Worth every penny.",
    author: "Priya M.",
    location: "London",
    stars: 5,
  },
  {
    quote: "Flawless from order to delivery. Truly world-class.",
    author: "Lucas T.",
    location: "Sydney",
    stars: 5,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>; // ✅ Promise in Next.js 15+
}) {
  await connectDB();

  const { id } = await params; // ✅ unwrap first

  const raw = await getCachedProduct(id);
  if (!raw) notFound();

  const rawObj = raw as unknown as ProductDoc;
  const p: ProductDoc = { ...rawObj, _id: String(rawObj._id) };
  const kind = getProductKind(p);
  const watch = kind === "watch";
  const gemstone = kind === "gemstone";

  const related = await getRelatedProducts(p, String(p._id), 4);

  // Single main product photo — the legacy layout shows one image only,
  // no thumbnail strip.
  const mainImage = (p.images ?? []).filter(Boolean)[0] ?? null;

  // Dynamic, per-kind spec sheet — see buildSpecs() above. Diamonds get
  // diamond fields (polish/cut/color/clarity/depth/...), gemstones get
  // gemstone fields (origin/luster/hardness/grade/...), watches get watch
  // fields, and every row is omitted when the underlying value is empty.
  const specs = buildSpecs(p, kind);

  const certBadge = certDisplay(p.certification);
  const showCertBadge = !watch && certBadge !== "—";

  const heroSubtitle = watch
    ? [p.watchGender, p.watchStyle, p.watchMovement].filter(Boolean).join(" · ")
    : [
        p.colorRaw || display(p.color)
          ? `${p.colorRaw || display(p.color)} Color`
          : "",
        p.clarityRaw || display(p.clarity)
          ? `${p.clarityRaw || display(p.clarity)} Clarity`
          : "",
        p.size ? `${p.size} ct` : "",
      ]
        .filter(Boolean)
        .join(" · ");

  const typeLabel = watch
    ? "Luxury Watch"
    : gemstone
      ? p.gemstoneName || p.category?.name || "Fine Gemstone"
      : kind === "diamond"
        ? "Fine Diamond"
        : p.category?.name || "Fine Jewelry";

  // Market Retail Price / Savings — only shown when msrp is actually set on
  // the product and is genuinely higher than the selling price, so nothing
  // here is a fabricated comparison.
  const hasMsrpSavings =
    typeof p.msrp === "number" && p.msrp > p.price;
  const savingsAmount = hasMsrpSavings ? (p.msrp as number) - p.price : 0;
  const savingsPct = hasMsrpSavings
    ? Math.round((savingsAmount / (p.msrp as number)) * 100)
    : 0;

  return (
    <>
      <RecordRecentlyViewed productId={String(p._id)} inStock={p.stock > 0} />

      <style>{`
        :root {
          --lg-bar-1: #f8f2e3;
          --lg-bar-2: #9c7a3f;
          --lg-bar-mid: #c9a968;
          --lg-border: #e5e0d3;
          --lg-border-soft: #efe9db;
          --lg-blue: #292520;
          --lg-blue-deep: #17130f;
          --lg-link: #8a6d34;
          --lg-red: #9c3b45;
          --lg-red-deep: #7a2530;
          --lg-text: #2b2a26;
          --lg-muted: #8a8578;
          --lg-bg: #ffffff;
          --lg-panel: #faf8f3;
          --lg-panel-alt: #f4efe1;
          --lg-zebra: #f7f4ec;
          --lg-shadow-sm: 0 1px 2px rgba(38,32,20,0.06), 0 1px 1px rgba(38,32,20,0.04);
          --lg-shadow-md: 0 6px 20px rgba(38,32,20,0.09), 0 2px 6px rgba(38,32,20,0.06);
          --lg-shadow-lg: 0 18px 40px rgba(38,32,20,0.14), 0 4px 12px rgba(38,32,20,0.08);
        }
        * { box-sizing: border-box; }
        .pd-page { font-family: Elms Sans; background: linear-gradient(180deg, #ffffff 0%, #ffffff 260px); color: var(--lg-text); min-height: 100vh; font-size: 12px; -webkit-font-smoothing: antialiased; }
        .pd-shell { width: 100%; margin: 0; padding: 22px 40px 70px; }
        @media (max-width: 700px) { .pd-shell { padding: 16px 16px 50px; } }

        .pd-breadcrumb { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--lg-muted); padding: 0 0 18px; flex-wrap: wrap; letter-spacing: 0.01em; }
        .pd-breadcrumb a { color: var(--lg-link); text-decoration: none; transition: color 0.15s; }
        .pd-breadcrumb a:hover { color: var(--lg-blue-deep); text-decoration: underline; }
        .pd-breadcrumb span.sep { color: #d3c9ae; }
        .pd-breadcrumb span.current { color: var(--lg-blue); font-weight: 600; }

        /* ── 3-column legacy layout ── */
        .pd-columns { display: grid; grid-template-columns: 260px 1fr 300px; gap: 40px; align-items: start; }
        @media (max-width: 1100px) { .pd-columns { grid-template-columns: 220px 1fr 240px; gap: 26px; } }
        @media (max-width: 860px) { .pd-columns { grid-template-columns: 1fr; } }

        /* ── shared "title bar" panel ── */
        .pd-bar { position: relative; background: linear-gradient(160deg, var(--lg-bar-1) 0%, var(--lg-bar-mid) 46%, var(--lg-bar-2) 100%); border: 1px solid #a98a4a; color: #fff; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; padding: 9px 14px; border-radius: 6px 6px 0 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), var(--lg-shadow-sm); text-shadow: 0 1px 1px rgba(20,30,60,0.25); }
        .pd-panel { border: 1px solid var(--lg-border); border-top: none; background: var(--lg-bg); margin-bottom: 22px; border-radius: 0 0 6px 6px; box-shadow: var(--lg-shadow-sm); overflow: hidden; }
        .pd-panel-pad { padding: 10px 12px; }

        /* ── left column: main image ── */
        .pd-main-image { position: relative; width: 100%; aspect-ratio: 1 / 1; background: linear-gradient(160deg, #faf8f3, #f3ede0); border: 1px solid var(--lg-border); overflow: hidden; border-radius: 8px; box-shadow: var(--lg-shadow-md); }
        .pd-main-image img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .pd-main-image:hover img { transform: scale(1.045); }
        .pd-main-image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--lg-border); font-size: 40px; }
        .pd-enlarge { text-align: center; font-size: 11px; margin: 10px 0 22px; }
        .pd-enlarge a { color: var(--lg-link); text-decoration: none; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; letter-spacing: 0.02em; transition: color 0.15s; }
        .pd-enlarge a:hover { color: var(--lg-blue-deep); }

        /* ── left column: notification / learning center / complimentary ── */
        .pd-side-row { display: flex; align-items: flex-start; gap: 8px; padding: 9px 13px; border-bottom: 1px solid var(--lg-border-soft); font-size: 11px; transition: background 0.15s; }
        .pd-side-row:hover { background: var(--lg-zebra); }
        .pd-side-row:last-child { border-bottom: none; }
        .pd-side-row svg { color: var(--lg-blue); flex-shrink: 0; margin-top: 1px; }
        .pd-side-row a, .pd-side-row span.txt { color: var(--lg-link); text-decoration: none; line-height: 1.45; }
        .pd-side-row a:hover { text-decoration: underline; }
        .pd-side-row.muted span.txt { color: var(--lg-muted); }
        .pd-share-row { padding: 10px 13px; border-bottom: 1px solid var(--lg-border-soft); font-size: 11px; color: var(--lg-muted); display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .pd-share-icons { display: flex; gap: 5px; }
        .pd-share-icons a { width: 20px; height: 20px; border-radius: 5px; display: flex; align-items: center; justify-content: center; background: var(--lg-panel); border: 1px solid var(--lg-border); color: var(--lg-blue); text-decoration: none; transition: background 0.15s, color 0.15s, transform 0.15s; }
        .pd-share-icons a:hover { background: var(--lg-blue); color: #fff; transform: translateY(-1px); }

        .pd-learning-list { list-style: none; margin: 0; padding: 6px 0; }
        .pd-learning-list li { border-bottom: 1px solid var(--lg-border-soft); }
        .pd-learning-list li:last-child { border-bottom: none; }
        .pd-learning-list li a { display: flex; align-items: center; gap: 7px; padding: 8px 13px; color: var(--lg-link); text-decoration: none; font-size: 11px; transition: background 0.15s, padding-left 0.15s; }
        .pd-learning-list li a::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--lg-bar-2); flex-shrink: 0; }
        .pd-learning-list li a:hover { background: var(--lg-zebra); padding-left: 16px; }

        .pd-complimentary-list { list-style: none; margin: 0; padding: 10px 13px; }
        .pd-complimentary-list li { font-size: 11px; color: var(--lg-red-deep); font-weight: 700; padding: 4px 0; display: flex; align-items: center; gap: 7px; }
        .pd-complimentary-list li::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--lg-red); flex-shrink: 0; }

        /* ── center column ── */
        .pd-title { font-family: Elms Sans; font-size: 25px; font-weight: 700; line-height: 1.28; color: var(--lg-blue-deep); margin: 0 0 6px; letter-spacing: -0.01em; }
        .pd-code { font-size: 11px; color: var(--lg-muted); margin-bottom: 14px; letter-spacing: 0.04em; }
        .pd-desc { font-size: 12.5px; color: #4a4438; line-height: 1.7; margin-bottom: 18px; }

        .pd-price-legacy { border: 1px solid var(--lg-border); border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; background: linear-gradient(160deg, #fdfbf6, #f8f2e6); box-shadow: var(--lg-shadow-sm); }
        .pd-price-row { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; }
        .pd-price-row .label { font-weight: 600; color: #4a4030; font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; }
        .pd-price-row.alpha { padding: 6px 0; margin: 4px 0; border-top: 1px dashed var(--lg-border); border-bottom: 1px dashed var(--lg-border); }
        .pd-price-row.alpha .label { color: var(--lg-red-deep); font-size: 12px; }
        .pd-price-row.alpha .value { color: var(--lg-red); font-size: 26px; font-weight: 800; letter-spacing: -0.01em; text-shadow: 0 1px 0 rgba(255,255,255,0.6); }
        .pd-price-row .value { font-weight: 700; color: #222; font-size: 12px; }
        .pd-min-qty { font-size: 11px; font-weight: 600; color: #4a4030; margin-bottom: 12px; }

        .pd-stock-legacy { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; margin-bottom: 16px; letter-spacing: 0.02em; }
        .pd-stock-legacy .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(34,119,34,0.15); }

        .pd-qty-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 12px; font-weight: 700; color: #222; text-transform: uppercase; letter-spacing: 0.04em; }

        .pd-btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .pd-btn-line { display: flex; align-items: center; justify-content: center; text-align: center; background: linear-gradient(160deg, #faf6ec, #f0e4c4); border: 1px solid #d9cba3; color: #4a3c1f; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; padding: 10px 12px; text-decoration: none; cursor: pointer; border-radius: 6px; box-shadow: var(--lg-shadow-sm); transition: transform 0.15s, box-shadow 0.15s, background 0.2s; }
        .pd-btn-line:hover { background: linear-gradient(160deg, #f3ead2, #e3d09e); transform: translateY(-1px); box-shadow: var(--lg-shadow-md); }
        .pd-btn-secondary-legacy { width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; background: #fff; border: 1px solid #d9cba3; color: #4a3c1f; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; padding: 10px 12px; cursor: pointer; border-radius: 6px; margin-bottom: 10px; box-shadow: var(--lg-shadow-sm); transition: transform 0.15s, box-shadow 0.15s, border-color 0.2s; }
        .pd-btn-secondary-legacy:hover { background: var(--lg-panel); border-color: var(--lg-blue); transform: translateY(-1px); box-shadow: var(--lg-shadow-md); }
        .pd-btn-tertiary-legacy { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; border: 1px dashed #ded2ac; color: var(--lg-muted); font-size: 10px; padding: 6px 10px; cursor: pointer; border-radius: 6px; margin-bottom: 14px; }

        .pd-tell-friend { display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 26px; padding-top: 4px; }
        .pd-tell-friend a { color: var(--lg-link); text-decoration: none; font-weight: 600; transition: color 0.15s; }
        .pd-tell-friend a:hover { color: var(--lg-blue-deep); text-decoration: underline; }
        .pd-tell-friend svg { color: var(--lg-blue); }

        .pd-specs-legacy { width: 100%; border-collapse: collapse; }
        .pd-specs-legacy tr:nth-child(odd) { background: var(--lg-zebra); }
        .pd-specs-legacy tr { transition: background 0.15s; }
        .pd-specs-legacy tr:hover { background: var(--lg-panel-alt); }
        .pd-specs-legacy td { padding: 9px 14px; font-size: 12px; border-bottom: 1px solid var(--lg-border-soft); }
        .pd-specs-legacy tr:last-child td { border-bottom: none; }
        .pd-specs-legacy td:first-child { font-weight: 700; color: var(--lg-blue); width: 42%; letter-spacing: 0.02em; font-size: 10.5px; }
        .pd-specs-legacy td:last-child { color: #333; font-weight: 500; }
        .pd-specs-legacy td.highlight { color: #1c7a2e; font-weight: 700; }

        .pd-reviews-empty { padding: 16px; font-size: 12px; color: var(--lg-muted); }
        .pd-write-review { margin: 0 14px 14px; }

        /* ── product review system ── */
        .pdr-stars-row { display: inline-flex; gap: 2px; align-items: center; }
        .pdr-star-btn { background: none; border: none; padding: 2px; cursor: pointer; line-height: 0; }
        .pdr-star-btn:hover { transform: scale(1.08); }

        .pdr-summary { display: flex; gap: 28px; align-items: flex-start; padding: 18px 4px 20px; flex-wrap: wrap; border-bottom: 1px solid var(--lg-border-soft); }
        .pdr-summary-score { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 90px; }
        .pdr-summary-num { font-size: 34px; font-weight: 800; color: var(--lg-blue-deep); line-height: 1; }
        .pdr-summary-count { font-size: 11px; color: var(--lg-muted); }
        .pdr-summary-bars { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 4px; }
        .pdr-bar-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--lg-muted); }
        .pdr-bar-label { width: 30px; flex-shrink: 0; }
        .pdr-bar-track { flex: 1; height: 6px; background: var(--lg-border-soft); border-radius: 4px; overflow: hidden; }
        .pdr-bar-fill { display: block; height: 100%; background: linear-gradient(90deg, #c8a24a, #b8955a); border-radius: 4px; }
        .pdr-bar-count { width: 22px; text-align: right; flex-shrink: 0; }

        .pdr-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 4px; flex-wrap: wrap; }
        .pdr-sort { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--lg-muted); }
        .pdr-sort select { font-size: 11px; padding: 5px 8px; border: 1px solid var(--lg-border); border-radius: 5px; background: #fff; color: #333; }

        .pdr-form { border: 1px solid var(--lg-border); border-radius: 8px; background: var(--lg-panel-alt); padding: 16px; margin: 0 4px 18px; display: flex; flex-direction: column; gap: 12px; }
        .pdr-form-field { display: flex; flex-direction: column; gap: 6px; }
        .pdr-form-field label { font-size: 10.5px; font-weight: 700; color: var(--lg-blue-deep); text-transform: uppercase; letter-spacing: 0.03em; }
        .pdr-form-field input, .pdr-form-field textarea { font-size: 12.5px; padding: 8px 10px; border: 1px solid var(--lg-border); border-radius: 6px; font-family: inherit; resize: vertical; }
        .pdr-form-field input:focus, .pdr-form-field textarea:focus { outline: none; border-color: #b8955a; }
        .pdr-form-error { font-size: 11.5px; color: #c0392b; }
        .pdr-form-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .pdr-cancel-link, .pdr-delete-link { background: none; border: none; font-size: 11.5px; color: var(--lg-muted); cursor: pointer; text-decoration: underline; padding: 0; }
        .pdr-delete-link { color: #c0392b; }

        .pdr-list { display: flex; flex-direction: column; }
        .pdr-item { padding: 16px 4px; border-bottom: 1px solid var(--lg-border-soft); }
        .pdr-item:last-child { border-bottom: none; }
        .pdr-item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .pdr-item-title { font-size: 12.5px; font-weight: 700; color: #222; margin-top: 4px; }
        .pdr-item-date { font-size: 10.5px; color: var(--lg-muted); white-space: nowrap; }
        .pdr-item-author { font-size: 11px; font-weight: 700; color: var(--lg-blue-deep); margin-top: 6px; display: flex; align-items: center; gap: 8px; }
        .pdr-verified { font-size: 9.5px; font-weight: 700; color: #1c7a2e; background: #e9f7ec; border: 1px solid #bfe6c8; border-radius: 4px; padding: 1px 6px; text-transform: uppercase; letter-spacing: 0.03em; }
        .pdr-item-comment { font-size: 12.5px; line-height: 1.65; color: #333; margin: 8px 0 0; }

        .pdr-item-actions { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
        .pdr-like-btn { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid var(--lg-border); border-radius: 20px; padding: 5px 12px; font-size: 11px; color: var(--lg-muted); cursor: pointer; transition: border-color 0.2s, color 0.2s, transform 0.1s; }
        .pdr-like-btn:hover { border-color: #c0392b; color: #c0392b; }
        .pdr-like-btn.liked { border-color: #c0392b; color: #c0392b; background: #fdf1f0; }
        .pdr-like-btn:active { transform: scale(0.96); }
        .pdr-heart-pop { animation: pdr-pop 0.32s ease; }
        @keyframes pdr-pop { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }

        .pdr-reply { margin: 12px 0 0 18px; padding: 10px 14px; border-left: 3px solid #c8a24a; background: var(--lg-panel-alt); border-radius: 0 6px 6px 0; }
        .pdr-reply-head { font-size: 10.5px; font-weight: 800; color: var(--lg-blue-deep); text-transform: uppercase; letter-spacing: 0.03em; }
        .pdr-reply-text { font-size: 12px; color: #333; margin: 6px 0; line-height: 1.6; }
        .pdr-reply-date { font-size: 10px; color: var(--lg-muted); }

        .pdr-admin-reply-box { margin: 12px 0 0 18px; display: flex; flex-direction: column; gap: 8px; max-width: 480px; }
        .pdr-admin-reply-box textarea { font-size: 12px; padding: 8px 10px; border: 1px dashed var(--lg-border); border-radius: 6px; font-family: inherit; resize: vertical; }
        .pdr-admin-reply-box button { align-self: flex-start; padding: 6px 14px; font-size: 11px; }

        .pdr-pagination { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px 4px 4px; font-size: 11px; color: var(--lg-muted); }
        .pdr-pagination button { background: #fff; border: 1px solid var(--lg-border); border-radius: 5px; padding: 5px 12px; font-size: 11px; cursor: pointer; color: #333; }
        .pdr-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
        @media (max-width: 640px) { .pdr-summary { flex-direction: column; } }

        /* ── right column: related items ── */
        .pd-related-heading { font-size: 11px; color: var(--lg-blue-deep); font-weight: 800; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--lg-bar-2); text-transform: uppercase; letter-spacing: 0.06em; }
        .pd-related-list { display: flex; flex-direction: column; gap: 16px; }
        .pd-related-item { display: block; text-decoration: none; text-align: center; border-radius: 8px; padding: 8px; transition: background 0.2s, box-shadow 0.2s, transform 0.2s; }
        .pd-related-item:hover { background: #fff; box-shadow: var(--lg-shadow-md); transform: translateY(-2px); }
        .pd-related-thumb { width: 100%; aspect-ratio: 1/1; background: linear-gradient(160deg, #faf8f3, #f3ede0); border: 1px solid var(--lg-border); border-radius: 6px; margin-bottom: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .pd-related-thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .pd-related-item:hover .pd-related-thumb img { transform: scale(1.08); }
        .pd-related-item-name { font-size: 11px; color: var(--lg-link); line-height: 1.45; display: block; font-weight: 500; }
        .pd-related-item:hover .pd-related-item-name { color: var(--lg-blue-deep); }
        .pd-related-item-price { font-size: 12px; color: var(--lg-red); font-weight: 800; margin-top: 4px; }
        .pd-related-empty-legacy { font-size: 11px; color: var(--lg-muted); }

        /* ── lower sections, restyled to match legacy palette ── */
        .pd-trust-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid var(--lg-border); border-radius: 10px; margin: 48px 0; background: var(--lg-panel); overflow: hidden; box-shadow: var(--lg-shadow-sm); }
        @media (max-width: 768px) { .pd-trust-strip { grid-template-columns: repeat(2, 1fr); } }
        .pd-trust-item { padding: 26px 18px; border-right: 1px solid var(--lg-border); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; transition: background 0.2s; }
        .pd-trust-item:hover { background: #fff; }
        .pd-trust-item:last-child { border-right: none; }
        .pd-trust-icon { width: 42px; height: 42px; border-radius: 50%; background: #fff; border: 1px solid var(--lg-border); display: flex; align-items: center; justify-content: center; color: var(--lg-blue); flex-shrink: 0; box-shadow: var(--lg-shadow-sm); }
        .pd-trust-label { font-size: 11px; font-weight: 700; color: var(--lg-blue-deep); letter-spacing: 0.02em; }
        .pd-trust-sub { font-size: 10px; color: var(--lg-muted); }

        .pd-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .pd-section-title { font-family: Elms Sans; font-size: 20px; font-weight: 700; color: var(--lg-blue-deep); }
        .pd-section-link { font-size: 11px; color: var(--lg-link); text-decoration: none; font-weight: 600; }
        .pd-section-link:hover { text-decoration: underline; }

        .pd-testimonials { background: linear-gradient(160deg, var(--lg-panel), #f4efe1); padding: 36px 26px; margin: 48px 0; border: 1px solid var(--lg-border); border-radius: 12px; }
        .pd-testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
        @media (max-width: 768px) { .pd-testimonial-grid { grid-template-columns: 1fr; } }
        .pd-testimonial-card { background: #fff; padding: 20px 18px; border: 1px solid var(--lg-border); border-radius: 10px; box-shadow: var(--lg-shadow-sm); transition: transform 0.2s, box-shadow 0.2s; }
        .pd-testimonial-card:hover { transform: translateY(-3px); box-shadow: var(--lg-shadow-md); }
        .pd-testimonial-quote { font-size: 12px; font-style: italic; line-height: 1.65; color: #333; margin-bottom: 12px; }
        .pd-testimonial-author { font-size: 11px; font-weight: 700; color: var(--lg-blue-deep); }
        .pd-testimonial-loc { font-size: 10px; color: var(--lg-muted); }
        .pd-stars { display: flex; gap: 2px; margin-bottom: 10px; color: var(--lg-red); font-size: 12px; }

        .pd-info-footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; padding: 34px 0; border-top: 1px solid var(--lg-border); border-bottom: 1px solid var(--lg-border); margin-bottom: 26px; }
        @media (max-width: 700px) { .pd-info-footer { grid-template-columns: 1fr; gap: 20px; } }
        .pd-info-col-title { font-size: 11px; font-weight: 800; color: var(--lg-blue-deep); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .pd-info-col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }
        .pd-info-col ul li a { font-size: 11px; color: var(--lg-link); text-decoration: none; transition: color 0.15s; }
        .pd-info-col ul li a:hover { color: var(--lg-blue-deep); text-decoration: underline; }

        .pd-bottom-strip { display: flex; align-items: center; justify-content: space-between; padding-bottom: 26px; gap: 12px; flex-wrap: wrap; font-size: 10px; color: var(--lg-muted); }
        .pd-bottom-cert { display: flex; align-items: center; gap: 7px; }
        .pd-bottom-cert svg { color: var(--lg-blue); }
      `}</style>

      <div className="pd-page">
        <div className="pd-shell">
          {/* Breadcrumb */}
          <nav className="pd-breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep">›</span>
            <Link href="/products">
              {p.category?.name ?? (watch ? "Watches" : "Diamonds")}
            </Link>
            {p.subcategory?.name && (
              <>
                <span className="sep">›</span>
                <Link
                  href={`/products?subcategory=${p.subcategory.slug ?? ""}`}
                >
                  {p.subcategory.name}
                </Link>
              </>
            )}
            <span className="sep">›</span>
            <span className="current">{p.name}</span>
          </nav>

          <div className="pd-columns">
            {/* ── LEFT COLUMN ── */}
            <div>
              <div className="pd-main-image">
                {mainImage ? (
                  <img
                    src={optimizedImageUrl(mainImage, { width: 700 })}
                    alt={p.name}
                  />
                ) : (
                  <div className="pd-main-image-placeholder">◇</div>
                )}

                {showCertBadge && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "#faf6ec",
                      border: "1px solid #d9cba3",
                      color: "#7a5f2a",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "5px 10px",
                      borderRadius: 5,
                      boxShadow: "0 2px 6px rgba(38,32,20,0.12)",
                    }}
                  >
                    {certBadge} Certified
                  </div>
                )}

                {p.stock <= 0 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(250,248,243,0.88)",
                    }}
                  >
                    <span
                      style={{
                        border: "1px solid #ded2ac",
                        color: "#8a8578",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        padding: "7px 18px",
                        borderRadius: 5,
                        background: "#fff",
                      }}
                    >
                      Unavailable
                    </span>
                  </div>
                )}
              </div>
              {mainImage && (
                <div className="pd-enlarge">
                  <a href={mainImage} target="_blank" rel="noopener noreferrer">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    enlarge
                  </a>
                </div>
              )}

              <div className="pd-bar">Notification</div>
              <div className="pd-panel">
                <div className="pd-share-row">
                  <span className="pd-share-icons">
                    <a href="#" aria-label="Share on Facebook">
                      <FacebookIcon />
                    </a>
                    <a href="#" aria-label="Share on X">
                      <XIcon />
                    </a>
                  </span>
                  Social bookmarks.
                </div>
                <div className="pd-side-row">
                  <BellIcon />
                  <a href="#">Notify me of updates to {p.name}</a>
                </div>
                <div className="pd-side-row">
                  <QuestionIcon />
                  <a href="#">Ask a question about this product...</a>
                </div>
                <div className="pd-side-row">
                  <PrinterIcon />
                  <a href="#">Printer Friendly Page</a>
                </div>
              </div>

              <div className="pd-bar">Learning Center</div>
              <div className="pd-panel">
                <ul className="pd-learning-list">
                  {LEARNING_CENTER_LINKS.map((link) => (
                    <li key={link}>
                      <a href="#">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pd-bar">Complimentary With Purchase</div>
              <div className="pd-panel">
                <ul className="pd-complimentary-list">
                  <li>30-Day Returns</li>
                  <li>Complimentary Gift</li>
                </ul>
              </div>
            </div>

            {/* ── CENTER COLUMN ── */}
            <div>
              <h1 className="pd-title">{p.name}</h1>
              <div className="pd-code">
                [{String(p._id).slice(-10).toUpperCase()}]
              </div>

              {(heroSubtitle || p.description) && (
                <p className="pd-desc">
                  {p.description ||
                    `Get the best price on this ${typeLabel.toLowerCase()}${
                      heroSubtitle ? ` — ${heroSubtitle}` : ""
                    }.`}
                </p>
              )}

              <div className="pd-price-legacy">
                {hasMsrpSavings && (
                  <div className="pd-price-row">
                    <span className="label">Market Retail Price:</span>
                    <span className="value">
                      ${(p.msrp as number).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="pd-price-row alpha">
                  <span className="label">Alpha Price:</span>
                  <span className="value">
                    ${p.price.toLocaleString()}
                  </span>
                </div>
                {hasMsrpSavings && (
                  <div className="pd-price-row">
                    <span className="label">Your Savings:</span>
                    <span className="value">
                      ${savingsAmount.toLocaleString()} ({savingsPct}%)
                    </span>
                  </div>
                )}
              </div>

              {p.minOrder && p.minOrder > 1 && (
                <div className="pd-min-qty">
                  Minimum Quantity: {p.minOrder}
                </div>
              )}

              <div className="pd-stock-legacy">
                <span
                  className="dot"
                  style={{ background: p.stock > 0 ? "#227722" : "#c0392b" }}
                />
                <span style={{ color: p.stock > 0 ? "#227722" : "#c0392b" }}>
                  {p.stock > 0
                    ? "In stock — ready to ship"
                    : "Currently unavailable"}
                </span>
              </div>

              <div className="pd-qty-row">Quantity:</div>

              <AddToCartButton
                productId={String(p._id)}
                inStock={p.stock > 0}
              />

              <div className="pd-btn-grid" style={{ marginTop: 8 }}>
                <a href="#reviews" className="pd-btn-line">
                  Reviews
                </a>
                <CompareLaunchButton
                  className="pd-btn-line"
                  product={{
                    _id: String(p._id),
                    name: p.name,
                    price: p.price,
                    productKind: kind,
                    shape: p.shape,
                    size: p.size,
                    color: p.color,
                    clarity: p.clarity,
                    certification: p.certification,
                    gemstoneName: p.gemstoneName,
                    watchBrand: p.watchBrand,
                    watchModel: p.watchModel,
                    watchGender: p.watchGender,
                    watchMovement: p.watchMovement,
                    watchStrapType: p.watchStrapType,
                    watchCaseMaterial: p.watchCaseMaterial,
                    watchDialColor: p.watchDialColor,
                    watchStyle: p.watchStyle,
                    watchCaseSize: p.watchCaseSize,
                    watchFeatures: p.watchFeatures,
                    images: p.images,
                    stock: p.stock,
                  }}
                />
              </div>

              <WishlistButton
                productId={String(p._id)}
                className="pd-btn-secondary-legacy"
              />

              <div className="pd-tell-friend">
                <MailIcon />
                <a href="#">Tell Your Friend About This Product</a>
              </div>

              <div className="pd-bar">Product Details</div>
              <div className="pd-panel">
                <table className="pd-specs-legacy">
                  <tbody>
                    {specs.map(({ label, value, highlight }, i) => (
                      <tr key={`${label}-${i}`}>
                        <td>{label.toUpperCase()}:</td>
                        <td className={highlight ? "highlight" : ""}>
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pd-bar" id="reviews">
                Product Reviews
              </div>
              <div className="pd-panel pd-panel-pad">
                <ProductReviews productId={String(p._id)} />
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div>
              <div className="pd-related-heading">Related Items</div>
              {related.length === 0 ? (
                <div className="pd-related-empty-legacy">
                  No related products found
                </div>
              ) : (
                <div className="pd-related-list">
                  {related.map((item) => (
                    <Link
                      key={item.id}
                      href={`/products/${item.id}`}
                      className="pd-related-item"
                    >
                      <div className="pd-related-thumb">
                        {item.img ? (
                          <img
                            src={optimizedImageUrl(item.img, {
                              width: 200,
                              quality: 85,
                            })}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span
                            style={{ color: "var(--lg-border)", fontSize: 24 }}
                          >
                            ◇
                          </span>
                        )}
                      </div>
                      <span className="pd-related-item-name">
                        {item.name}
                      </span>
                      <div className="pd-related-item-price">
                        ${item.price.toLocaleString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trust strip */}
          <div className="pd-trust-strip">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="pd-trust-item">
                <div className="pd-trust-icon">{item.icon}</div>
                <div>
                  <div className="pd-trust-label">{item.label}</div>
                  <div className="pd-trust-sub">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recently Viewed — client-rendered from the visitor's own
              browsing history; hidden automatically when there's none. */}
          <RecentlyViewedProducts excludeId={String(p._id)} />

          {/* Testimonials */}
          <div className="pd-testimonials">
            <div className="pd-section-head">
              <h2 className="pd-section-title">What Our Clients Say</h2>
              <Link href="#" className="pd-section-link">
                All reviews
              </Link>
            </div>
            <div className="pd-testimonial-grid">
              {TESTIMONIALS.map((t) => (
                <div key={t.author} className="pd-testimonial-card">
                  <div className="pd-stars">{"★".repeat(t.stars)}</div>
                  <div className="pd-testimonial-quote">{t.quote}</div>
                  <div className="pd-testimonial-author">{t.author}</div>
                  <div className="pd-testimonial-loc">{t.location}</div>
                </div>
              ))}
            </div>
          </div>

         

        
        </div>
      </div>
    </>
  );
}