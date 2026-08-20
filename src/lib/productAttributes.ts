// ─────────────────────────────────────────────────────────────────────────────
// Shared attribute vocabulary — diamonds/gemstones AND watches.
//
// WHY THIS FILE EXISTS
// SearchBar.tsx used to hard-code its own copies of SHAPES / WATCH_BRANDS /
// WATCH_CASE_SIZES / etc. Those copies had drifted from the real values in
// src/models/Product.ts (missing brands like "Rado", "Bulova", "Oris", a
// completely different WATCH_CASE_SIZES list, missing movements like
// "Eco-Drive" / "Kinetic", etc). Any product using one of the missing values
// was effectively unsearchable and un-filterable — that's the "search is
// broken" bug. Both the model and the UI now import from here, so a value
// added in one place is automatically available in the other.
//
// Import this file from Product.ts as:
//   import { SHAPES, COLORS, CLARITIES, CERTIFICATIONS, WATCH_* } from '@/lib/productAttributes';
// and delete the local copies in that file.
// ─────────────────────────────────────────────────────────────────────────────

// Derived from src/models/Product.ts / attributes.shape across the ~18.6k
// rows in the current AlphaGemstone catalog export (products_with_matched_
// categories.csv). Buckets cover ~96% of populated shape values; anything
// that doesn't match a bucket keyword falls back to "other" — see
// normalizeShape() in fileParser.service.ts for the raw→bucket mapping.
export const SHAPES = [
  "round", "oval", "cushion", "pear", "trillion", "square", "marquise",
  "octagon", "heart", "emerald", "princess", "bullet", "baguette",
  "drop", "briolette", "nugget", "barrel", "bead", "button",
  "cabochon", "kite", "hexagon", "triangle",
  "other",
] as const;

// Real gemstone color language used across the catalog (colored stones,
// not GIA diamond-grading letters — the old D-Z / fancy-* list never
// matched anything in this data). Buckets cover ~95% of populated color
// values; see normalizeColor() in fileParser.service.ts.
export const COLORS = [
  "Red", "Blue", "Yellow", "Green", "Violet", "Pink", "Purple",
  "White", "Black", "Brown", "Orange",
  "Champagne", "Cognac", "Canary", "Padparadscha", "Paraiba", "Mystic",
  "Smoky", "Aqua", "Teal", "Peach", "Grey", "Silver", "Clear", "Multicolor", "Rainbow",
  "other",
] as const;

// Mix of formal clarity grades (SI1/SI2/I1-I4/VS1/VS2/VVS1/VVS2/FL) and the
// descriptive clarity language this catalog actually uses for colored
// stones (Eye Clean, Opaque, Translucent, Fine, Regular, Commercial...).
// Covers ~99.9% of populated clarity values; see normalizeClarity().
export const CLARITIES = [
  "VVS1", "VS1", "VS2", "VS",
  "SI1", "SI2", "SI3", "SI",
  "I1", "I2", "I3", "I4",
  "Eye Clean", "Included", "Commercial", "Fine", "Regular",
  "Transparent", "Translucent", "Semi Translucent", "Opaque",
  "other",
] as const;

export const CERTIFICATIONS = [
  "GIA", "IGI", "HRD", "AGS", "EGL",
  "GCAL", "GSI", "NGTC", "SSEF", "GRS", "AGL",
  "none",
] as const;

// Only Men's/Women's Watches subcategories exist in the catalog, plus one
// "Unisex" watch by name (Bulova 'Marine Star' Solano).
export const WATCH_GENDERS = ["Men", "Women", "Unisex"] as const;

// The full luxury-watch-brand list (Rolex, Patek Philippe, etc.) never
// matched a single product — this store's ~11 watch SKUs are Bulova,
// Calvin Klein, Invicta, Movado, Pulsar, and Vellaccio.
export const WATCH_BRANDS = [
  "Bulova", "Calvin Klein", "Invicta", "Movado", "Pulsar", "Vellaccio",
  "other",
] as const;

export const WATCH_MOVEMENTS = [
  "Automatic", "Quartz", "Mechanical", "Manual", "Solar", "Eco-Drive", "Kinetic",
] as const;

export const WATCH_STRAP_TYPES = [
  "Metal Bracelet", "Leather", "Rubber / Silicone", "Fabric", "NATO",
  "Canvas", "Ceramic", "Resin",
] as const;

export const WATCH_CASE_MATERIALS = [
  "Stainless Steel", "Gold", "Rose Gold", "White Gold", "Titanium",
  "Ceramic", "Carbon", "Bronze", "Platinum", "Two-tone",
] as const;

export const WATCH_DIAL_COLORS = [
  "Black", "White", "Blue", "Green", "Gold", "Silver", "Grey", "Brown",
  "Red", "Orange", "Pink", "Purple", "Champagne", "Mother of Pearl",
  "Skeleton", "Transparent",
  "other",
] as const;

export const WATCH_FEATURES = [
  "Chronograph", "Date Display", "Day-Date", "Moonphase", "GMT",
  "Power Reserve", "Water Resistant", "Diamond Studded", "Skeleton Dial",
  "Tourbillon", "Perpetual Calendar", "World Time", "Alarm",
] as const;

export const WATCH_STYLES = [
  "Luxury", "Casual", "Sport", "Dress", "Diver", "Pilot", "Field", "Racing",
] as const;

export const WATCH_CASE_SIZES = [
  "Extra Small", "Small", "Medium", "Large", "Extra Large",
] as const;

export const PRODUCT_KINDS = ["diamond", "gemstone", "watch", "jewelry"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export type Shape = (typeof SHAPES)[number];
export type Color = (typeof COLORS)[number];
export type Clarity = (typeof CLARITIES)[number];
export type Certification = (typeof CERTIFICATIONS)[number];
export type WatchGender = (typeof WATCH_GENDERS)[number];
export type WatchBrand = (typeof WATCH_BRANDS)[number];
export type WatchMovement = (typeof WATCH_MOVEMENTS)[number];
export type WatchStrapType = (typeof WATCH_STRAP_TYPES)[number];
export type WatchCaseMaterial = (typeof WATCH_CASE_MATERIALS)[number];
export type WatchDialColor = (typeof WATCH_DIAL_COLORS)[number];
export type WatchFeature = (typeof WATCH_FEATURES)[number];
export type WatchStyle = (typeof WATCH_STYLES)[number];
export type WatchCaseSize = (typeof WATCH_CASE_SIZES)[number];