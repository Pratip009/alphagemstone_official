import * as XLSX from 'xlsx';
import {
  SHAPES, COLORS, CLARITIES, WATCH_BRANDS, WATCH_GENDERS,
  type Shape, type Color, type Clarity, type WatchBrand, type WatchGender,
} from '@/models/Product';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  stock: number;
  isActive: boolean;
  description?: string;
  images: string[];

  productKind: 'diamond' | 'gemstone' | 'watch' | 'jewelry';

  shape?: Shape[];
  shapeRaw?: string;
  size?: number;
  color?: Color[];
  colorRaw?: string;
  clarity?: Clarity[];
  clarityRaw?: string;
  gradeRaw?: string;
  // Simple product-page filter fields (see Product.ts) — previously parsed
  // into legacyAttributes only and never reached the actual schema fields,
  // which is why the "Approx Weight" / "Number Of Stones" filter dropdowns
  // came back empty for every product.
  approxWeight?: string;
  numberOfStones?: number;
  gemstoneName?: string;
  cutType?: string;
  luster?: string;
  hardness?: string;
  treatment?: string;
  origin?: string;
  caratWeight?: number;
  dimensions?: string;

  watchBrand?: WatchBrand;
  watchModel?: string;
  watchGender?: WatchGender;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];

  legacyAttributes?: Record<string, string>;
  legacyProductId?: number;
  legacySku?: string;

  // ── "matched categories" export fields ─────────────────────────────────
  weight?: number;
  msrp?: number;
  manufacturerId?: string;
  minOrder?: number;
  maxOrder?: number;
  qtyBlocks?: number;
  makeAnOffer?: boolean;
  parentProductId?: number;
  subcategory2Raw?: string;
  categoryPath?: string;
}

export interface ParseWarning { row: number; field: string; message: string }
export interface ParseError { row: number; error: string }

export interface ParseResult {
  rows: ParsedRow[];
  parseErrors: ParseError[];
  warnings: ParseWarning[];
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

export function deriveSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clean(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s || s.toUpperCase() === 'NULL' || s.toLowerCase() === 'nan') return '';
  return s;
}

function num(val: unknown): number | undefined {
  const s = clean(val);
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

// "True"/"False" (as opposed to the legacy export's "1"/"0" status column).
function bool(val: unknown): boolean {
  return clean(val).toLowerCase() === 'true';
}

// Splits a comma-separated keyword string into a trimmed, de-duplicated,
// empty-filtered array (e.g. "Gift, Voucher, for, $200" -> [...]).
function splitKeywords(val: unknown): string[] | undefined {
  const s = clean(val);
  if (!s) return undefined;
  const parts = Array.from(
    new Set(s.split(',').map((p) => p.trim()).filter(Boolean)),
  );
  return parts.length ? parts : undefined;
}

// ─── Shape normalization ───────────────────────────────────────────────────────
// The catalog's raw shape text (attributes.shape / legacy `shape`) is
// free-form — "Round", "Long Cushion", "Buff Top Oval", "Faceted Briolette
// Drop" — and doesn't map 1:1 onto a fixed enum. This does a keyword-based
// best-effort match against the SHAPES vocabulary (src/lib/productAttributes.ts,
// itself derived from what's actually in attributes.shape across the full
// CSV export — covers ~96% of populated rows). Keywords are checked in an
// order that prefers the more specific/common shape when a raw value
// contains more than one shape-like word (e.g. "Oval Cabochon" → oval, since
// "cabochon" there describes the cut, already captured separately in
// cutType). Anything that matches nothing falls back to "other"; the exact
// original text is always kept in shapeRaw so nothing is lost.
const SHAPE_KEYWORDS: Array<[Shape, string[]]> = [
  ['round', ['round']],
  ['oval', ['oval']],
  ['cushion', ['cushion']],
  ['pear', ['pear']],
  ['marquise', ['marquise']],
  ['octagon', ['octagon']],
  ['emerald', ['emerald']],
  ['heart', ['heart']],
  ['princess', ['princess']],
  ['baguette', ['baguette', 'baggutte']],
  ['trillion', ['trillion']],
  ['bullet', ['bullet']],
  ['square', ['square']],
  ['briolette', ['briolette']],
  ['drop', ['drop']],
  ['bead', ['bead']],
  ['nugget', ['nugget']],
  ['barrel', ['barrel']],
  ['button', ['button']],
  ['cabochon', ['cabochon', 'sugarloaf']],
  ['kite', ['kite']],
  ['hexagon', ['hexagon']],
  ['triangle', ['triangle']],
];

function normalizeShape(raw: string): Shape | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim();
  for (const [shape, keywords] of SHAPE_KEYWORDS) {
    if (keywords.some((kw) => key.includes(kw))) return shape;
  }
  return 'other';
}

// ─── Color normalization ───────────────────────────────────────────────────────
// attributes.color is free-text gemstone-trade color language (243 distinct
// raw values — "Golden Yellow", "Violet Blue", "Mystic Peacock Blue",
// "Raspberry Red"...), not a diamond grading scale. Same keyword-bucket
// approach as shape; covers ~95% of populated rows in the CSV export. The
// exact original text is always kept in colorRaw.
const COLOR_KEYWORDS: Array<[Color, string[]]> = [
  ['Padparadscha', ['padparadscha']],
  ['Canary', ['canary']],
  ['Champagne', ['champagne']],
  ['Cognac', ['cognac']],
  ['Paraiba', ['paraiba']],
  ['Mystic', ['mystic']],
  ['Rainbow', ['rainbow']],
  ['Multicolor', ['multi', 'fancy color']],
  ['Smoky', ['smoky', 'smokey']],
  ['Teal', ['teal']],
  ['Aqua', ['aqua']],
  ['Peach', ['peach']],
  ['Grey', ['grey', 'gray']],
  ['Silver', ['silver']],
  ['Clear', ['clear', 'milky']],
  ['Violet', ['violet']],
  ['Purple', ['purple']],
  ['Pink', ['pink', 'rose', 'strawberry']],
  ['Red', ['red', 'ruby', 'cinnamon']],
  ['Orange', ['orange']],
  ['Yellow', ['yellow', 'golden']],
  ['Green', ['green', 'olive', 'evergreen']],
  ['Blue', ['blue']],
  ['Brown', ['brown']],
  ['Black', ['black']],
  ['White', ['white']],
];

function normalizeColor(raw: string): Color | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim();
  for (const [color, keywords] of COLOR_KEYWORDS) {
    if (keywords.some((kw) => key.includes(kw))) return color;
  }
  return 'other';
}

// ─── Clarity normalization ─────────────────────────────────────────────────────
// attributes.clarity mixes formal grading codes (SI2, I1/I2, VS1/SI1 — often
// as a slash-separated range) with descriptive trade terms (Opaque, "Clean,
// Bright", Semi Translucent, Regular). Combined/ranged codes resolve to
// their first (worse) grade, e.g. "SI1/SI2" -> SI1, "I1-I2" -> I1. Covers
// ~99.9% of populated rows. The exact original text is always kept in
// clarityRaw.
function normalizeClarity(raw: string): Clarity | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  const key = v.toLowerCase();
  if (key.includes('top clean') || key.includes('eye clean') || key.includes('clean, bright') || key.includes('clear, bright')) return 'Eye Clean';
  if (key.includes('semi translucent')) return 'Semi Translucent';
  if (key.includes('translucent')) return 'Translucent';
  if (key.includes('transparent')) return 'Transparent';
  if (key.includes('opaque')) return 'Opaque';
  if (key.includes('commercial')) return 'Commercial';
  if (key.includes('fine')) return 'Fine';
  if (key.includes('regular')) return 'Regular';
  if (key.includes('slight') || key.includes('visible inclusion')) return 'SI';
  if (key.includes('included')) return 'Included';
  if (key === 'vvs') return 'VVS1';
  const codeMatch = v.toUpperCase().match(/^(VVS1|VS1|VS2|VS|SI1|SI2|SI3|SI|I1|I2|I3|I4)/);
  if (codeMatch) return codeMatch[1] as Clarity;
  return 'other';
}

// ─── Watch field normalization ─────────────────────────────────────────────────

function normalizeWatchBrand(raw: string, warnings: ParseWarning[], row: number): WatchBrand | undefined {
  if (!raw) return undefined;
  const match = WATCH_BRANDS.find((b) => b.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  warnings.push({ row, field: 'watchBrand', message: `Unrecognized brand "${raw}" — set to "other"` });
  return 'other';
}

function normalizeWatchGender(raw: string, warnings: ParseWarning[], row: number): WatchGender | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim();
  if (key === 'mens' || key === 'men') return 'Men';
  if (key === 'womens' || key === 'women') return 'Women';
  if (key === 'unisex') return 'Unisex';
  // Boys/Girls/Kids never appear in this catalog (only Men's/Women's
  // Watches subcategories + one Unisex SKU exist) — dropped rather than
  // guessed at, same as any other unrecognized value.
  warnings.push({ row, field: 'watchGender', message: `Unrecognized gender value "${raw}" — dropped` });
  return undefined;
}

// ─── Product kind detection ────────────────────────────────────────────────────
// No single column says "this is a diamond vs. a colored gemstone vs. plain
// jewelry" — it has to be inferred from which fields are populated and what
// the category/gemstone name says.
function detectProductKind(
  watchBrand: string, watchModel: string, watchGender: string,
  gemstoneName: string, categoryName: string,
): ParsedRow['productKind'] {
  if (watchBrand || watchModel || watchGender) return 'watch';

  const gemLower = gemstoneName.toLowerCase();
  const catLower = categoryName.toLowerCase();

  if (gemLower.includes('diamond') || catLower.includes('diamond')) return 'diamond';
  if (catLower.includes('watch')) return 'watch';
  if (gemstoneName) return 'gemstone';

  // No stone name at all — but the category may still indicate one
  // (e.g. "Ruby Bead Necklaces", "Rhodolite Garnet" with a blank
  // gemstone_name column for that particular row).
  const GEM_KEYWORDS = [
    'sapphire', 'ruby', 'emerald', 'amethyst', 'citrine', 'garnet',
    'tanzanite', 'tourmaline', 'topaz', 'peridot', 'aquamarine',
    'iolite', 'quartz', 'pearl', 'opal', 'onyx', 'fluorite', 'gemstone',
    'bead',
  ];
  if (GEM_KEYWORDS.some((kw) => catLower.includes(kw))) return 'gemstone';

  return 'jewelry';
}

// ─── Legacy categories_name → real Category/Subcategory mapping ───────────────
// The legacy export's single `categories_name` column (144 distinct values)
// is actually subcategory-grained ("Blue Sapphire", "Diamond Pendants",
// "Silver Earrings"), not top-level-category-grained. This table maps every
// raw value seen in the AlphaImports export onto the real Category /
// Subcategory names already seeded in this store (gemstone-shop taxonomy:
// Diamonds, Watches, Precious Gems, Semi Precious, Jewelry, Specials,
// Occasions and gifts). Keys are lowercased for case-insensitive lookup.
//
// Entries with no `subcategory` (Certificates, Diamond Loupe, Vouchers) are
// filed under a top-level category only — no matching subcategory exists in
// the store for these, and they're accessories/gift items rather than
// gemstones or jewelry pieces.
//
// Raw values NOT present in this map (NULL/blank, and the stray grade codes
// "A"/"AA"/"AAA" that leaked into this column from a misaligned export) are
// intentionally left unmapped — those rows have no usable category data and
// are dropped by the caller as a parse error, same as before.
const CATEGORY_SUBCATEGORY_MAP: Record<string, { category: string; subcategory?: string }> = {
  '3 stone diamond pendants': { category: 'Jewelry', subcategory: 'Diamond Pendants' },
  'agate': { category: 'Semi Precious', subcategory: 'Agate' },
  'alpha collector\'s gallery': { category: 'Specials', subcategory: 'Alpha Specials' },
  'alpha specials': { category: 'Specials', subcategory: 'Alpha Specials' },
  'amethyst': { category: 'Semi Precious', subcategory: 'Amethyst' },
  'aquamarine': { category: 'Semi Precious', subcategory: 'Aquamarine' },
  'black diamonds': { category: 'Diamonds', subcategory: 'Black Diamonds' },
  'blue diamonds': { category: 'Diamonds', subcategory: 'Blue Diamonds' },
  'blue sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'briolettes': { category: 'Semi Precious', subcategory: 'Briolettes' },
  'brown diamonds': { category: 'Diamonds', subcategory: 'Brown Diamonds' },
  'cabochon garnet': { category: 'Semi Precious', subcategory: 'Garnet' },
  'cabochon ruby': { category: 'Precious Gems', subcategory: 'Ruby' },
  'calibrated tanzanite': { category: 'Precious Gems', subcategory: 'Tanzanite' },
  'calvin klein, basic, men\'s, quartz, watch': { category: 'Watches', subcategory: 'Men\'s Watches' },
  'canary diamonds': { category: 'Diamonds', subcategory: 'Canary Diamonds' },
  'canary green gold quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'carnelian': { category: 'Semi Precious', subcategory: 'Carnelian' },
  'cats eye': { category: 'Semi Precious', subcategory: 'Cats Eye' },
  'certificates': { category: 'Diamonds' },
  'certified diamonds': { category: 'Diamonds', subcategory: 'Certified Diamonds' },
  'chalcedony': { category: 'Semi Precious', subcategory: 'Chalcedony' },
  'champagne diamonds': { category: 'Diamonds', subcategory: 'Champagne Diamonds' },
  'chrome diopside': { category: 'Semi Precious', subcategory: 'Chrome Diopside' },
  'chrysoprase': { category: 'Semi Precious', subcategory: 'Chrysoprase' },
  'cinnamon citrine quartz': { category: 'Semi Precious', subcategory: 'Citrine' },
  'citrine': { category: 'Semi Precious', subcategory: 'Citrine' },
  'cocktail rings': { category: 'Jewelry', subcategory: 'Gemstone Rings' },
  'coffee diamonds': { category: 'Diamonds', subcategory: 'Coffee Diamonds' },
  'cognac diamonds': { category: 'Diamonds', subcategory: 'Cognac Diamonds' },
  'collection gems': { category: 'Semi Precious', subcategory: 'Collection Gems' },
  'color diamond rings': { category: 'Jewelry', subcategory: 'Diamond Rings' },
  'coral': { category: 'Semi Precious', subcategory: 'Coral' },
  'cream diamonds': { category: 'Diamonds', subcategory: 'Cream Diamonds' },
  'crystal quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'cushion tanzanite': { category: 'Precious Gems', subcategory: 'Tanzanite' },
  'diamond deals and steals': { category: 'Specials', subcategory: 'Diamond Specials' },
  'diamond earring bargains': { category: 'Jewelry', subcategory: 'Diamond Earrings' },
  'diamond earrings': { category: 'Jewelry', subcategory: 'Diamond Earrings' },
  'diamond loupe': { category: 'Diamonds' },
  'diamond necklaces': { category: 'Jewelry', subcategory: 'Diamond Necklaces' },
  'diamond pendants': { category: 'Jewelry', subcategory: 'Diamond Pendants' },
  'diamond rings': { category: 'Jewelry', subcategory: 'Diamond Rings' },
  'diamond solitaire pendants': { category: 'Jewelry', subcategory: 'Diamond Pendants' },
  'diamond specials': { category: 'Specials', subcategory: 'Diamond Specials' },
  'diamond stud earrings': { category: 'Jewelry', subcategory: 'Diamond Earrings' },
  'diamond stud earrings (in silver': { category: 'Jewelry', subcategory: 'Diamond Earrings' },
  'drusy quartz': { category: 'Semi Precious', subcategory: 'Drusy Quartz' },
  'emerald': { category: 'Precious Gems', subcategory: 'Emerald' },
  'engagement solitaire rings': { category: 'Jewelry', subcategory: 'Diamond Rings' },
  'faceted blue sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'faceted ruby': { category: 'Precious Gems', subcategory: 'Ruby' },
  'fancy carved gemstones': { category: 'Semi Precious', subcategory: 'Fancy Carved Gemstones' },
  'fluorite': { category: 'Semi Precious', subcategory: 'Fluorite' },
  'garnet': { category: 'Semi Precious', subcategory: 'Garnet' },
  'gemstone bead necklace': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'gemstone bracelets': { category: 'Jewelry', subcategory: 'Gemstone Bracelets' },
  'gemstone earrings': { category: 'Jewelry', subcategory: 'Gemstone Earrings' },
  'gemstone pendants': { category: 'Jewelry', subcategory: 'Gemstone Pendants' },
  'gemstone silver earrings': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'gemstone silver necklaces': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'gemstone silver pendants': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'gemstone specials': { category: 'Specials', subcategory: 'Gemstone Specials' },
  'gold diamond semi-mountings': { category: 'Jewelry', subcategory: 'Gold Diamond Semi-mountings' },
  'green diamonds': { category: 'Diamonds', subcategory: 'Green Diamonds' },
  'green golden quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'green sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'hematite': { category: 'Semi Precious', subcategory: 'Hematite' },
  'iolite': { category: 'Semi Precious', subcategory: 'Iolite' },
  'jewelry display': { category: 'Jewelry', subcategory: 'Jewelry Display' },
  'kunzite': { category: 'Semi Precious', subcategory: 'Kunzite' },
  'lapis': { category: 'Semi Precious', subcategory: 'Lapis' },
  'loose beads': { category: 'Semi Precious', subcategory: 'Loose Beads' },
  'madeira citrine quartz': { category: 'Semi Precious', subcategory: 'Citrine' },
  'men\'s watches': { category: 'Watches', subcategory: 'Men\'s Watches' },
  'moissanite synthetic': { category: 'Diamonds', subcategory: 'Moissanite Synthetic' },
  'moonstone': { category: 'Semi Precious', subcategory: 'Moonstone' },
  'more gemstone rings': { category: 'Jewelry', subcategory: 'Gemstone Rings' },
  'movado, men\'s, series 800, two-tone, chronograph, watch, men\'s watch, movado watch, movado chronograph': { category: 'Watches', subcategory: 'Men\'s Watches' },
  'mozambique garnet': { category: 'Semi Precious', subcategory: 'Mozambique Garnet' },
  'multicolor diamonds': { category: 'Diamonds', subcategory: 'Multicolor Diamonds' },
  'multicolor sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'mystic cz': { category: 'Semi Precious', subcategory: 'Mystic CZ' },
  'mystic luxury topaz': { category: 'Semi Precious', subcategory: 'Mystic Luxury Topaz' },
  'mystic quartz': { category: 'Semi Precious', subcategory: 'Mystic Quartz' },
  'olive quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'onyx': { category: 'Semi Precious', subcategory: 'Onyx' },
  'opal': { category: 'Semi Precious', subcategory: 'Opal' },
  'opal mosaic': { category: 'Semi Precious', subcategory: 'Opal Mosaic' },
  'orange sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'pear tanzanite': { category: 'Precious Gems', subcategory: 'Tanzanite' },
  'pearls': { category: 'Semi Precious', subcategory: 'Pearls' },
  'peridot': { category: 'Semi Precious', subcategory: 'Peridot' },
  'pink diamonds': { category: 'Diamonds', subcategory: 'Pink Diamonds' },
  'pink sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'prasiolite (green amethyst)': { category: 'Semi Precious', subcategory: 'Prasiolite (Green Amethyst)' },
  'precious gems deals and steals': { category: 'Precious Gems', subcategory: 'Precious gems deals and steals' },
  'prehnite': { category: 'Semi Precious', subcategory: 'Prehnite' },
  'rhodolite garnet': { category: 'Semi Precious', subcategory: 'Rhodolite Garnet' },
  'rose quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'rubellite': { category: 'Semi Precious', subcategory: 'Rubellite' },
  'ruby': { category: 'Precious Gems', subcategory: 'Ruby' },
  'ruby bead necklaces': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'ruby diamond rings': { category: 'Jewelry', subcategory: 'Gemstone Rings' },
  'rutilated quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'sapphire bead necklaces': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'sapphire diamond rings': { category: 'Jewelry', subcategory: 'Gemstone Rings' },
  'semi precious deals and steals': { category: 'Semi Precious', subcategory: 'Semi Precious Deals And Steals' },
  'silk cord necklace': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'silk cords': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'silver bracelet': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'silver diamonds': { category: 'Diamonds', subcategory: 'Silver Diamonds' },
  'silver earrings': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'silver rings': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'silver solitaire pendants': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'silver solitaire rings': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'simulated gemstones': { category: 'Semi Precious', subcategory: 'Simulated Gemstones' },
  'sky blue topaz': { category: 'Semi Precious', subcategory: 'Sky Blue Topaz' },
  'smoky quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'solitaire rings with gemstones': { category: 'Jewelry', subcategory: 'Gemstone Rings' },
  'spessartite garnet': { category: 'Semi Precious', subcategory: 'Spessartite Garnet' },
  'swiss blue topaz': { category: 'Semi Precious', subcategory: 'Swiss Blue Topaz' },
  'tanzanite': { category: 'Precious Gems', subcategory: 'Tanzanite' },
  'tanzanite diamond rings': { category: 'Jewelry', subcategory: 'Gemstone Rings' },
  'tanzanite pendants': { category: 'Jewelry', subcategory: 'Tanzanite Jewelry' },
  'three stone diamond rings': { category: 'Jewelry', subcategory: 'Diamond Rings' },
  'tiger eye': { category: 'Semi Precious', subcategory: 'Tiger Eye' },
  'tourmaline': { category: 'Semi Precious', subcategory: 'Tourmaline' },
  'tsavorite': { category: 'Semi Precious', subcategory: 'Tsavorite' },
  'turquoise': { category: 'Semi Precious', subcategory: 'Turquoise' },
  'vouchers': { category: 'Occasions and gifts' },
  'white diamonds': { category: 'Diamonds', subcategory: 'White Diamonds' },
  'white quartz': { category: 'Semi Precious', subcategory: 'Quartz' },
  'white sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
  'white topaz': { category: 'Semi Precious', subcategory: 'White Topaz' },
  'wish pearl necklace': { category: 'Jewelry', subcategory: 'Silver Jewelry' },
  'women\'s watches': { category: 'Watches', subcategory: 'Women\'s Watches' },
  'yellow diamonds': { category: 'Diamonds', subcategory: 'Yellow Diamonds' },
  'yellow sapphire': { category: 'Precious Gems', subcategory: 'Sapphire' },
};

// Resolves a raw legacy `categories_name` value to a real {category,
// subcategory} pair. Returns null when the raw value has no usable mapping
// (missing/garbage data, e.g. NULL/blank or a stray "A"/"AA"/"AAA" grade
// code that leaked into this column) — caller treats that the same as a
// missing category and drops the row as a parse error.
function resolveLegacyCategory(
  raw: string,
): { category: string; subcategory?: string } | null {
  const key = raw.toLowerCase().trim();
  return CATEGORY_SUBCATEGORY_MAP[key] ?? null;
}

// ─── Legacy AlphaImports CSV mapping ───────────────────────────────────────────
// Handles the specific export format: products_id, products_name,
// products_price, categories_name, products_image(_sm_1..6), color,
// gemstone_name, grade, cut, shape, clarity, clarity_grade, luster,
// hardness, treatment, origin, size, approx_weight, metal_material,
// metal_weight, ring_size, carat_range, size_range, watch_brand,
// watch_model, watch_gender, products_weight, products_head_title_tag,
// products_head_desc_tag, products_head_keywords_tag, etc.
//
// Note: `gold_color` and `products_seo_url` are present in the legacy
// export but are empty/garbage on effectively every row (checked against
// the full file) — intentionally not mapped to avoid dead schema fields.
function parseLegacyRow(r: Record<string, unknown>, rowNum: number, warnings: ParseWarning[]): ParsedRow | null {
  const name = clean(r.products_name);
  const categoryRaw = clean(r.categories_name);
  if (!name) return null; // dropped — caller records as parseError
  if (!categoryRaw) return null;

  // The raw categories_name value ("Blue Sapphire", "Diamond Pendants", ...)
  // is subcategory-grained, not a real top-level category — resolve both
  // from it via the mapping table above rather than treating it as the
  // category directly.
  const resolvedCategory = resolveLegacyCategory(categoryRaw);
  if (!resolvedCategory) {
    warnings.push({
      row: rowNum,
      field: 'category',
      message: `Raw category "${categoryRaw}" has no mapping to a real category/subcategory — row dropped`,
    });
    return null; // caller records this as a parseError too
  }
  const categoryName = resolvedCategory.category;
  const subcategoryName = resolvedCategory.subcategory;

  const priceRaw = num(r.products_price);
  const price = priceRaw !== undefined ? priceRaw : 0;
  if (priceRaw === undefined) warnings.push({ row: rowNum, field: 'price', message: 'Missing/invalid price — defaulted to 0' });

  const stockRaw = num(r.products_quantity);
  const stock = stockRaw !== undefined ? Math.max(0, Math.round(stockRaw)) : 0;
  if (stockRaw === undefined) warnings.push({ row: rowNum, field: 'stock', message: 'Missing/invalid quantity — defaulted to 0' });

  const statusRaw = clean(r.products_status);
  let isActive = true;
  if (statusRaw === '0') isActive = false;
  else if (statusRaw !== '1' && statusRaw !== '') {
    warnings.push({ row: rowNum, field: 'isActive', message: `Unexpected status "${statusRaw}" — defaulted to active` });
  }

  // merge + dedupe all image columns, drop empties
  const images = Array.from(new Set(
    [
      r.products_image, r.products_image_sm_1, r.products_image_sm_2,
      r.products_image_sm_3, r.products_image_sm_4, r.products_image_sm_5,
      r.products_image_sm_6,
    ].map(clean).filter(Boolean),
  ));

  const watchBrandRaw = clean(r.watch_brand);
  const watchModelRaw = clean(r.watch_model);
  const watchGenderRaw = clean(r.watch_gender);
  const gemstoneNameRaw = clean(r.gemstone_name);

  // Keyword detection (below) needs the original granular text ("Blue
  // Sapphire", "Diamond Pendants") — the resolved top-level categoryName
  // ("Precious Gems", "Jewelry") is too coarse to contain gem-type keywords.
  const productKind = detectProductKind(watchBrandRaw, watchModelRaw, watchGenderRaw, gemstoneNameRaw, categoryRaw);

  const shapeRaw = clean(r.shape);
  const shapeNormalized = normalizeShape(shapeRaw);
  const colorRaw = clean(r.color);
  const colorNormalized = normalizeColor(colorRaw);

  const sizeCt = productKind === 'diamond' || productKind === 'gemstone'
    ? num(r.approx_weight) ?? num(r.size)
    : undefined;

  // `clarity` (code, e.g. "SI2") and `clarity_grade` (human text, e.g.
  // "Slightly Included") are two distinct legacy columns with genuinely
  // different values on many rows — previously only one survived via
  // `clarity || clarity_grade`, silently dropping the other. Now the code
  // stays in clarityRaw and the descriptive text is preserved separately.
  const clarityCode = clean(r.clarity);
  const clarityGradeText = clean(r.clarity_grade);
  const clarityNormalized = normalizeClarity(clarityCode || clarityGradeText);

  // everything with too much free-form variance to enum-constrain safely —
  // preserved verbatim rather than dropped or guessed at.
  const legacyAttributes: Record<string, string> = {};
  const rawFields: Array<[string, unknown]> = [
    ['grade', r.grade], ['cut', r.cut], ['luster', r.luster],
    ['hardness', r.hardness], ['treatment', r.treatment], ['origin', r.origin],
    ['metalMaterial', r.metal_material], ['metalWeight', r.metal_weight],
    ['ringSize', r.ring_size], ['caratRange', r.carat_range],
    ['sizeRange', r.size_range], ['dimensions', r.size],
    ['approxWeight', r.approx_weight], ['shippingWeight', r.products_weight],
    ['legacyCategoryRaw', categoryRaw],
  ];
  // Only stash clarity_grade separately when it isn't already the value
  // that ended up in clarityRaw (i.e. when clarity code is also present).
  if (clarityGradeText && clarityCode) {
    rawFields.push(['clarityDescription', r.clarity_grade]);
  }
  for (const [key, val] of rawFields) {
    const v = clean(val);
    if (v) legacyAttributes[key] = v;
  }

  return {
    name,
    category: categoryName,
    subcategory: subcategoryName,
    price,
    stock,
    isActive,
    description: clean(r.products_description) || undefined,
    images,
    productKind,

    shape: shapeNormalized ? [shapeNormalized] : undefined,
    shapeRaw: shapeRaw || undefined,
    size: sizeCt,
    color: colorNormalized ? [colorNormalized] : undefined,
    colorRaw: colorRaw || undefined,
    clarity: clarityNormalized ? [clarityNormalized] : undefined,
    clarityRaw: clarityCode || clarityGradeText || undefined,
    gradeRaw: clean(r.grade) || undefined,
    approxWeight: clean(r.approx_weight) || undefined,
    gemstoneName: gemstoneNameRaw || undefined,

    watchBrand: normalizeWatchBrand(watchBrandRaw, warnings, rowNum),
    watchModel: watchModelRaw || undefined,
    watchGender: normalizeWatchGender(watchGenderRaw, warnings, rowNum),

    metaTitle: clean(r.products_head_title_tag) || undefined,
    metaDescription: clean(r.products_head_desc_tag) || undefined,
    metaKeywords: splitKeywords(r.products_head_keywords_tag),

    legacyAttributes: Object.keys(legacyAttributes).length ? legacyAttributes : undefined,
    legacyProductId: num(r.products_id),
    legacySku: clean(r.products_model) || undefined,
  };
}

// ─── "Matched categories" legacy export mapping ────────────────────────────────
// Handles the newer re-export of the same legacy catalogue: product_id, model,
// name, price, msrp, quantity, weight, status, manufacturer_id, min_order,
// max_order, qty_blocks, make_an_offer, parent_product_id, category_ids,
// imageurl, matched_image_path, image_matched, description, seo.title,
// seo.description, seo.keywords, attributes.* (gemstoneName, cutType, color,
// shape, luster, hardness, treatment, origin, grade, size, caratWeight,
// clarity), additional_attributes.extra_field_NNNN (unnamed dynamic
// attributes — no id→label mapping ships with the file, so they're preserved
// verbatim rather than guessed at), and pre-resolved category / subcategory /
// subcategory_2 / category_path columns (this file has already been matched
// against the real taxonomy, unlike the raw legacy `categories_name` export).
function parseMatchedRow(r: Record<string, unknown>, rowNum: number, warnings: ParseWarning[]): ParsedRow | null {
  const name = clean(r.name);
  const categoryName = clean(r.category);
  if (!name) return null;
  if (!categoryName) return null;

  const priceRaw = num(r.price);
  const price = priceRaw !== undefined ? priceRaw : 0;
  if (priceRaw === undefined) warnings.push({ row: rowNum, field: 'price', message: 'Missing/invalid price — defaulted to 0' });

  const stockRaw = num(r.quantity);
  const stock = stockRaw !== undefined ? Math.max(0, Math.round(stockRaw)) : 0;

  // status is "True"/"False" text in this export (vs. "1"/"0" in the raw
  // legacy one) — anything else defaults to active with a warning.
  const statusRaw = clean(r.status);
  let isActive = true;
  if (statusRaw.toLowerCase() === 'false') isActive = false;
  else if (statusRaw.toLowerCase() !== 'true' && statusRaw !== '') {
    warnings.push({ row: rowNum, field: 'isActive', message: `Unexpected status "${statusRaw}" — defaulted to active` });
  }

  // Local, project-served images — NOT R2. The uploaded local folder mirrors
  // matched_image_path's layout exactly (e.g.
  // product-images-migration/alphagemsgems/100/G003235.gif), so it's copied
  // straight into /public and served as a root-relative path — no R2 upload
  // for this bulk import. New products added afterward through the normal
  // admin flow still upload to R2 via lib/r2.ts, completely unchanged.
  const matchedPath = clean(r.matched_image_path);
  const images = bool(r.image_matched) && matchedPath
    ? [`/${matchedPath.replace(/^\/+/, '')}`]
    : [];

  const gemstoneNameRaw = clean(r['attributes.gemstoneName']);
  const shapeRaw = clean(r['attributes.shape']);
  const shapeNormalized = normalizeShape(shapeRaw);
  const colorRaw = clean(r['attributes.color']);
  const colorNormalized = normalizeColor(colorRaw);
  const clarityRaw = clean(r['attributes.clarity']);
  const clarityNormalized = normalizeClarity(clarityRaw);

  const productKind = detectProductKind('', '', '', gemstoneNameRaw, categoryName);

  const caratWeight = num(r['attributes.caratWeight']);
  // `size` on the Product model is the carat-weight filter field for
  // diamonds/gemstones (see normalizeShape/legacy parser above) — the
  // physical mm dimensions ("4x3 mm") go in `dimensions` instead so nothing
  // gets silently coerced to NaN.
  const sizeCt = productKind === 'diamond' || productKind === 'gemstone' ? caratWeight : undefined;

  // Every additional_attributes.extra_field_NNNN column that has a value on
  // this row, plus a few identifiers worth keeping for traceability. No
  // label mapping ships with this file, so the raw column name is the key.
  const legacyAttributes: Record<string, string> = {};
  for (const [key, val] of Object.entries(r)) {
    if (!key.startsWith('additional_attributes.')) continue;
    const v = clean(val);
    if (!v) continue;
    legacyAttributes[key.replace('additional_attributes.', '')] = v;
  }
  const categoryIdsRaw = clean(r.category_ids);
  if (categoryIdsRaw) legacyAttributes.legacyCategoryIds = categoryIdsRaw;
  const categoryPathsAll = clean(r.category_paths_all);
  if (categoryPathsAll && categoryPathsAll !== clean(r.category_path)) {
    legacyAttributes.categoryPathsAll = categoryPathsAll;
  }
  // image_matched=False (or blank matched_image_path) — no local file to
  // point at, so the product is saved with no image rather than a broken
  // local path. The raw legacy fragment is kept here so these ~9 rows are
  // easy to find and fix by hand later.
  if (!images.length) {
    const rawImageUrl = clean(r.imageurl);
    if (rawImageUrl) legacyAttributes.unmatchedImageUrl = rawImageUrl;
  }

  const parentProductIdNum = num(r.parent_product_id);

  return {
    name,
    category: categoryName,
    subcategory: clean(r.subcategory) || undefined,
    price,
    stock,
    isActive,
    description: clean(r.description) || undefined,
    images,
    productKind,

    shape: shapeNormalized ? [shapeNormalized] : undefined,
    shapeRaw: shapeRaw || undefined,
    size: sizeCt,
    color: colorNormalized ? [colorNormalized] : undefined,
    colorRaw: colorRaw || undefined,
    clarity: clarityNormalized ? [clarityNormalized] : undefined,
    clarityRaw: clarityRaw || undefined,
    gradeRaw: clean(r['attributes.grade']) || undefined,
    gemstoneName: gemstoneNameRaw || undefined,
    cutType: clean(r['attributes.cutType']) || undefined,
    luster: clean(r['attributes.luster']) || undefined,
    hardness: clean(r['attributes.hardness']) || undefined,
    treatment: clean(r['attributes.treatment']) || undefined,
    origin: clean(r['attributes.origin']) || undefined,
    caratWeight,
    dimensions: clean(r['attributes.size']) || undefined,

    metaTitle: clean(r['seo.title']) || undefined,
    metaDescription: clean(r['seo.description']) || undefined,
    metaKeywords: splitKeywords(r['seo.keywords']),

    legacyAttributes: Object.keys(legacyAttributes).length ? legacyAttributes : undefined,
    legacyProductId: num(r.product_id),
    legacySku: clean(r.model) || undefined,

    weight: num(r.weight),
    msrp: num(r.msrp),
    manufacturerId: clean(r.manufacturer_id) || undefined,
    minOrder: num(r.min_order),
    maxOrder: num(r.max_order),
    qtyBlocks: num(r.qty_blocks),
    makeAnOffer: bool(r.make_an_offer),
    parentProductId: parentProductIdNum ? parentProductIdNum : undefined,
    subcategory2Raw: clean(r.subcategory_2) || undefined,
    categoryPath: clean(r.category_path) || undefined,
  };
}

// ─── Standard (non-legacy) mapping ─────────────────────────────────────────────
// For future manual uploads using the clean template from generateCSVTemplate().
function parseStandardRow(r: Record<string, unknown>, rowNum: number, warnings: ParseWarning[]): ParsedRow | null {
  const name = clean(r.name);
  const category = clean(r.category);
  if (!name || !category) return null;

  const priceRaw = num(r.price);
  const price = priceRaw !== undefined ? priceRaw : 0;
  if (priceRaw === undefined) warnings.push({ row: rowNum, field: 'price', message: 'Missing/invalid price — defaulted to 0' });

  const stockRaw = num(r.stock);
  const stock = stockRaw !== undefined ? Math.max(0, Math.round(stockRaw)) : 0;

  const images = clean(r.images).split(',').map((s) => s.trim()).filter(Boolean);

  const watchBrandRaw = clean(r.watchBrand);
  const watchGenderRaw = clean(r.watchGender);
  const gemstoneNameRaw = clean(r.gemstoneName);
  const productKind = detectProductKind(watchBrandRaw, clean(r.watchModel), watchGenderRaw, gemstoneNameRaw, category);

  const shapeRaw = clean(r.shape);

  return {
    name,
    category,
    subcategory: clean(r.subcategory) || undefined,
    price,
    stock,
    isActive: clean(r.isActive) !== 'false',
    description: clean(r.description) || undefined,
    images,
    productKind,
    shape: shapeRaw ? [normalizeShape(shapeRaw)!] : undefined,
    shapeRaw: shapeRaw || undefined,
    size: num(r.size),
    color: normalizeColor(clean(r.color)) ? [normalizeColor(clean(r.color))!] : undefined,
    colorRaw: clean(r.color) || undefined,
    clarity: normalizeClarity(clean(r.clarity)) ? [normalizeClarity(clean(r.clarity))!] : undefined,
    clarityRaw: clean(r.clarity) || undefined,
    approxWeight: clean(r.approxWeight) || undefined,
    numberOfStones: num(r.numberOfStones),
    gemstoneName: gemstoneNameRaw || undefined,
    watchBrand: normalizeWatchBrand(watchBrandRaw, warnings, rowNum),
    watchModel: clean(r.watchModel) || undefined,
    watchGender: normalizeWatchGender(watchGenderRaw, warnings, rowNum),
    metaTitle: clean(r.metaTitle) || undefined,
    metaDescription: clean(r.metaDescription) || undefined,
    metaKeywords: splitKeywords(r.metaKeywords),
  };
}

// ─── Entry point ────────────────────────────────────────────────────────────────

export async function parseUploadedFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  const isLegacyFormat = raw.length > 0 && ('products_id' in raw[0] || 'products_name' in raw[0]);
  const isMatchedFormat = !isLegacyFormat && raw.length > 0 &&
    ('category_path' in raw[0] || 'attributes.gemstoneName' in raw[0]);

  const rows: ParsedRow[] = [];
  const parseErrors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  raw.forEach((r, i) => {
    const rowNum = i + 2; // header = row 1
    // skip fully blank rows
    if (Object.values(r).every((v) => clean(v) === '')) return;

    const parsed = isLegacyFormat
      ? parseLegacyRow(r, rowNum, warnings)
      : isMatchedFormat
      ? parseMatchedRow(r, rowNum, warnings)
      : parseStandardRow(r, rowNum, warnings);

    if (!parsed) {
      parseErrors.push({ row: rowNum, error: 'Missing required field: name and/or category' });
      return;
    }
    rows.push(parsed);
  });

  return { rows, parseErrors, warnings };
}

export function generateCSVTemplate(): string {
  const headers = [
    'name', 'category', 'subcategory', 'price', 'stock', 'isActive', 'description',
    'images', 'productKind',
    'shape', 'size', 'color', 'clarity', 'gemstoneName',
    'watchBrand', 'watchModel', 'watchGender', 'watchMovement',
    'watchStrapType', 'watchCaseMaterial', 'watchDialColor', 'watchStyle', 'watchCaseSize',
    'metaTitle', 'metaDescription', 'metaKeywords',
  ];
  const example = [
    'Oval Blue Sapphire 2.4ct', 'Sapphire', '', '850', '3', 'true', 'Natural oval-cut blue sapphire.',
    'https://res.cloudinary.com/.../img1.jpg,https://res.cloudinary.com/.../img2.jpg', 'gemstone',
    'oval', '2.4', 'Royal Blue', 'VS', 'Blue Sapphire',
    '', '', '', '', '', '', '', '', '',
    'Oval Blue Sapphire 2.4ct | AlphaImports', 'Natural oval-cut blue sapphire, 2.4 carats.', 'sapphire, blue sapphire, oval sapphire',
  ];
  return [headers.join(','), example.join(',')].join('\n');
}