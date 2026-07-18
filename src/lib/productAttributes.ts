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

export const SHAPES = [
  "round", "oval", "princess", "cushion", "emerald", "pear", "marquise",
  "radiant", "asscher", "heart",
  "trillion", "triangle", "baguette", "tapered-baguette", "bullet", "kite",
  "hexagon", "octagon", "shield", "rose-cut", "cabochon",
  "other",
] as const;

export const COLORS = [
  "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "VIOLET",
  "fancy-yellow", "fancy-light-yellow", "fancy-intense-yellow", "fancy-vivid-yellow",
  "RASPBERRY RED",
  "fancy-pink", "fancy-purple-pink",
  "fancy-blue", "fancy-green", "fancy-red", "fancy-orange", "fancy-brown",
  "fancy-grey", "fancy-black", "fancy-white",
  "champagne", "cognac",
  "other",
] as const;

export const CLARITIES = [
  "FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3",
  "I1", "I2", "I3", "P1", "P2", "P3",
  "other",
] as const;

export const CERTIFICATIONS = [
  "GIA", "IGI", "HRD", "AGS", "EGL",
  "GCAL", "GSI", "NGTC", "SSEF", "GRS", "AGL",
  "none",
] as const;

export const WATCH_GENDERS = ["Men", "Women", "Unisex", "Boys", "Girls", "Kids"] as const;

export const WATCH_BRANDS = [
  "Rolex", "Omega", "Cartier", "Citizen", "Seiko",
  "Patek Philippe", "Audemars Piguet", "Vacheron Constantin",
  "A. Lange & Söhne", "Jaeger-LeCoultre", "IWC", "Panerai",
  "Breitling", "TAG Heuer", "Richard Mille", "Hublot",
  "Zenith", "Blancpain", "Breguet", "Tudor",
  "Grand Seiko", "Longines", "Tissot", "Hamilton",
  "Frederique Constant", "Fossil", "Casio", "Rado", "Bulova", "Oris",
  "Movado", "Mido", "Bell & Ross", "Ulysse Nardin", "Corum", "Piaget",
  "Chopard", "Bulgari", "Montblanc", "Maurice Lacroix", "Raymond Weil",
  "Baume & Mercier", "Nomos", "Sinn", "Christopher Ward", "Victorinox",
  "Invicta", "Timex", "Orient", "Daniel Wellington", "Michael Kors",
  "Armani Exchange", "Emporio Armani", "Diesel", "Guess", "Nixon",
  "Skagen", "Calvin Klein", "Pulsar",
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