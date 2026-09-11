// src/lib/productSpecs.ts
//
// Single source of truth for the "spec sheet" rows (Item, Shape, Cut,
// Color, Treatment, Clarity, Approx Weight, Item Weight, Manufacturer,
// Make An Offer, Availability, ...) shown on the full product detail page
// AND in the ProductCard Quick View modal. Kept here instead of duplicated
// in both places so the two can never quietly drift apart — whatever a
// shopper sees in Quick View is exactly what they'd see if they clicked
// through to the full page.

export type ProductKind = "watch" | "diamond" | "gemstone" | "jewelry";

export type Spec = { label: string; value: string; highlight?: boolean };

// Loose/optional on every field — callers (the detail page's richer
// ProductDoc, the card grid's lighter-weight serialized product) both
// satisfy this without adapting their own types.
export interface SpecSourceProduct {
  name?: string;
  price?: number;
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
  legacyAttributes?: Record<string, string>;
  approxWeight?: string;
  numberOfStones?: number;
  cutType?: string;
  luster?: string;
  hardness?: string;
  treatment?: string;
  origin?: string;
  caratWeight?: number;
  dimensions?: string;
  weight?: number;
  manufacturerId?: string;
  minOrder?: number;
  maxOrder?: number;
  makeAnOffer?: boolean;
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
  stock?: number;
}

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

// "metalMaterial" -> "Metal Material" — for legacyAttributes keys that
// aren't already surfaced under a named label below.
function titleCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

// legacyAttributes keys that are internal bookkeeping, not customer-facing
// specs, and should never render even as a leftover row.
const SKIP_ATTR_KEYS = new Set(["legacyCategoryRaw", "shippingWeight"]);

export function buildProductSpecs(
  p: SpecSourceProduct,
  kind: ProductKind,
): Spec[] {
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
    push("Metal", attr("metalMaterial"));
    push("Metal Weight", attr("metalWeight"));
    push("Ring Size", attr("ringSize"));
    push("Size Range", attr("sizeRange"));
    push("Carat Range", attr("caratRange"));
    push("Shape", p.shapeRaw || capitalize(p.shape));
    push("Color", p.colorRaw || display(p.color));
  }

  push("Number of Stones", p.numberOfStones);
  push("Item Weight", p.weight ? `${p.weight} g` : undefined);
  push("Manufacturer", p.manufacturerId);
  if (p.minOrder && p.minOrder > 1) {
    push("Minimum Order Qty", p.minOrder);
  }
  if (p.makeAnOffer) push("Make An Offer", "Available on this item");

  for (const [key, value] of Object.entries(attrs)) {
    if (usedAttrKeys.has(key) || SKIP_ATTR_KEYS.has(key) || !value) continue;
    push(titleCase(key), value);
  }

  if (typeof p.stock === "number") {
    push("Availability", p.stock > 0 ? `${p.stock} in stock` : "Out of stock", {
      highlight: p.stock > 0,
    });
  }

  return rows;
}