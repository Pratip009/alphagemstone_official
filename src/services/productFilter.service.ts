import { FilterQuery } from 'mongoose';
import { cache } from 'react';
import { IProduct } from '@/models/Product';
import Category from '@/models/Category';
import Subcategory from '@/models/Subcategory';
import { escapeRegex, extractCarat, CARAT_MATCH_TOLERANCE } from '@/lib/search';

// ─── Filter Query Params ──────────────────────────────────────────────────────
export interface ProductFilterParams {
  // Category
  category?: string;
  subcategory?: string;

  // Product kind — 'diamond' | 'gemstone' | 'watch' | 'jewelry'. Independent
  // of category: gemstones are filed under several categories ("Precious
  // Gems", "Semi Precious", "Specials", …) with a subcategory per gem
  // (Emerald, Amethyst, …), so productKind is the reliable way to select
  // "all gemstones" regardless of which category/subcategory they sit in.
  productKind?: string;

  // Diamond / gemstone multi-select filters
  shape?: string | string[];
  color?: string | string[];
  clarity?: string | string[];
  certification?: string | string[];

  // Diamond range filters
  priceMin?: string | number;
  priceMax?: string | number;
  sizeMin?: string | number;
  sizeMax?: string | number;

  // ── Watch filters ────────────────────────────────────────────────────────
  /** Men | Women | Unisex */
  watchGender?: string;
  /** Single brand or comma-separated list */
  watchBrand?: string | string[];
  /** Automatic | Quartz | Mechanical */
  watchMovement?: string | string[];
  /** Metal Bracelet | Leather | Rubber / Silicone */
  watchStrapType?: string | string[];
  /** Stainless Steel | Gold | Two-tone | Titanium */
  watchCaseMaterial?: string | string[];
  /** Black | White | Blue | Green | Gold | … */
  watchDialColor?: string | string[];
  /** Chronograph | Date Display | Water Resistant | Diamond Studded | Skeleton Dial */
  watchFeatures?: string | string[];
  /** Luxury | Casual | Sport | Dress */
  watchStyle?: string | string[];
  /** Small | Medium | Large */
  watchCaseSize?: string;

  // Pagination
  page?: string | number;
  limit?: string | number;

  // Sorting
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'size_asc' | 'size_desc';

  // Search
  q?: string;

  // Stock
  inStock?: string | boolean;
}

export interface ParsedFilters {
  query: FilterQuery<IProduct>;
  sort: Record<string, 1 | -1>;
  page: number;
  limit: number;
  skip: number;
}

// ─── Helper: normalize to array ───────────────────────────────────────────────
function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

// ─── Helper: parse numeric safely ────────────────────────────────────────────
function toNumber(val: string | number | undefined): number | undefined {
  if (val === undefined || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

// ─── Slug resolver ────────────────────────────────────────────────────────────
// ─── Slug resolver ────────────────────────────────────────────────────────────
const isObjectId = (val: string) => /^[a-f\d]{24}$/i.test(val);

// listProducts() and getProductFacets() are both called (in parallel) from
// every /products-style page, and both independently need the same
// category/subcategory slug resolved to an ObjectId. Without this, that's
// two extra DB round trips duplicated into four. React's cache() dedupes
// calls with identical arguments within a single request/render pass, so
// as long as both call sites ask for the same slug, only one of them
// actually hits Mongo — the other gets the already-in-flight/resolved
// result for free.
const lookupCategoryId = cache(async (slug: string) => {
  const cat = await Category.findOne({ slug, isActive: true })
    .select('_id')
    .lean();
  return cat ? cat._id.toString() : '000000000000000000000000';
});

const lookupSubcategoryId = cache(async (slug: string) => {
  const sub = await Subcategory.findOne({ slug, isActive: true })
    .select('_id')
    .lean();
  return sub ? sub._id.toString() : '000000000000000000000000';
});

export async function resolveSlugFilters(
  params: ProductFilterParams
): Promise<ProductFilterParams> {
  const resolved = { ...params };

  const needsCategory =
    !!resolved.category && !isObjectId(resolved.category);
  const needsSubcategory =
    !!resolved.subcategory && !isObjectId(resolved.subcategory);

  // Independent lookups — run concurrently instead of one after another.
  const [catId, subId] = await Promise.all([
    needsCategory ? lookupCategoryId(resolved.category as string) : null,
    needsSubcategory ? lookupSubcategoryId(resolved.subcategory as string) : null,
  ]);

  if (needsCategory) resolved.category = catId as string;
  if (needsSubcategory) resolved.subcategory = subId as string;

  return resolved;
}

// ─── Core Filter Builder ──────────────────────────────────────────────────────
export function buildProductFilterQuery(params: ProductFilterParams): ParsedFilters {
  const filter: FilterQuery<IProduct> = {};

  filter.isActive = true;

  // ── Category ───────────────────────────────────────────────────────────────
  if (params.category)    filter.category    = params.category;
  if (params.subcategory) filter.subcategory = params.subcategory;
  if (params.productKind) filter.productKind = params.productKind;

  // ── Diamond / gemstone multi-select filters ────────────────────────────────
  const shapes = toArray(params.shape);
  if (shapes.length > 0) filter.shape = { $in: shapes };

  const colors = toArray(params.color);
  if (colors.length > 0) filter.color = { $in: colors };

  const clarities = toArray(params.clarity);
  if (clarities.length > 0) filter.clarity = { $in: clarities };

  const certifications = toArray(params.certification);
  if (certifications.length > 0) filter.certification = { $in: certifications };

  // ── Diamond range filters ──────────────────────────────────────────────────
  const priceMin = toNumber(params.priceMin);
  const priceMax = toNumber(params.priceMax);
  if (priceMin !== undefined || priceMax !== undefined) {
    filter.price = {};
    if (priceMin !== undefined) filter.price.$gte = priceMin;
    if (priceMax !== undefined) filter.price.$lte = priceMax;
  }

  const sizeMin = toNumber(params.sizeMin);
  const sizeMax = toNumber(params.sizeMax);
  if (sizeMin !== undefined || sizeMax !== undefined) {
    filter.size = {};
    if (sizeMin !== undefined) filter.size.$gte = sizeMin;
    if (sizeMax !== undefined) filter.size.$lte = sizeMax;
  }

  // ── Watch filters ──────────────────────────────────────────────────────────

  // Single-value selects
  if (params.watchGender)       filter.watchGender       = params.watchGender;
  if (params.watchCaseSize)     filter.watchCaseSize     = params.watchCaseSize;

  // Multi-select watch filters
  const watchBrands = toArray(params.watchBrand);
  if (watchBrands.length > 0) filter.watchBrand = { $in: watchBrands };

  const watchMovements = toArray(params.watchMovement);
  if (watchMovements.length > 0) filter.watchMovement = { $in: watchMovements };

  const watchStrapTypes = toArray(params.watchStrapType);
  if (watchStrapTypes.length > 0) filter.watchStrapType = { $in: watchStrapTypes };

  const watchCaseMaterials = toArray(params.watchCaseMaterial);
  if (watchCaseMaterials.length > 0) filter.watchCaseMaterial = { $in: watchCaseMaterials };

  const watchDialColors = toArray(params.watchDialColor);
  if (watchDialColors.length > 0) filter.watchDialColor = { $in: watchDialColors };

  const watchFeatures = toArray(params.watchFeatures);
  if (watchFeatures.length > 0) filter.watchFeatures = { $in: watchFeatures };

  const watchStyles = toArray(params.watchStyle);
  if (watchStyles.length > 0) filter.watchStyle = { $in: watchStyles };

  // ── Stock filter ───────────────────────────────────────────────────────────
  if (params.inStock === 'true' || params.inStock === true) {
    filter.stock = { $gt: 0 };
  }

  // ── Full-text search ───────────────────────────────────────────────────────
  // Was `filter.$text = { $search: params.q.trim() }`, which only matches
  // whole, stemmed words indexed on `name`/`description` — so partial input
  // ("diam"), watch brands/models, gemstone names, SKUs, and carat weights
  // (e.g. "0.35 carat") all silently returned nothing or missed obvious hits.
  // This mirrors the regex + carat matching already used by the working
  // autocomplete dropdown (/api/products/search) so both search paths agree.
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    const rx = new RegExp(escapeRegex(q), 'i');
    const orConditions: FilterQuery<IProduct>[] = [
      { name: rx },
      { watchBrand: rx },
      { watchModel: rx },
      { gemstoneName: rx },
      { legacySku: rx },
    ];
    const carat = extractCarat(q);
    if (carat !== null) {
      orConditions.push({ size: { $gte: carat - CARAT_MATCH_TOLERANCE, $lte: carat + CARAT_MATCH_TOLERANCE } });
    }
    filter.$or = orConditions;
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sortMap: Record<string, Record<string, 1 | -1>> = {
    price_asc:  { price: 1 },
    price_desc: { price: -1 },
    newest:     { createdAt: -1 },
    oldest:     { createdAt: 1 },
    size_asc:   { size: 1 },
    size_desc:  { size: -1 },
  };

  const sort = sortMap[params.sortBy || 'newest'] || { createdAt: -1 };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const page  = Math.max(1, toNumber(params.page) || 1);
  const limit = Math.min(100, Math.max(1, toNumber(params.limit) || 20));
  const skip  = (page - 1) * limit;

  return { query: filter, sort, page, limit, skip };
}

// ─── Facets pipeline ──────────────────────────────────────────────────────────
export function buildFacetsPipeline(baseFilter: FilterQuery<IProduct>) {
  return [
    { $match: baseFilter },
    {
      $facet: {
        // Diamond facets
        shapes: [
          { $group: { _id: '$shape', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        colors: [
          { $group: { _id: '$color', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        clarities: [
          { $group: { _id: '$clarity', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        certifications: [
          { $group: { _id: '$certification', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        priceRange: [
          { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
        ],
        sizeRange: [
          { $group: { _id: null, min: { $min: '$size' }, max: { $max: '$size' } } },
        ],

        // Watch facets
        watchGenders: [
          { $match: { watchGender: { $exists: true } } },
          { $group: { _id: '$watchGender', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        watchBrands: [
          { $match: { watchBrand: { $exists: true } } },
          { $group: { _id: '$watchBrand', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchMovements: [
          { $match: { watchMovement: { $exists: true } } },
          { $group: { _id: '$watchMovement', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchStrapTypes: [
          { $match: { watchStrapType: { $exists: true } } },
          { $group: { _id: '$watchStrapType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchCaseMaterials: [
          { $match: { watchCaseMaterial: { $exists: true } } },
          { $group: { _id: '$watchCaseMaterial', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchDialColors: [
          { $match: { watchDialColor: { $exists: true } } },
          { $group: { _id: '$watchDialColor', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchFeatures: [
          { $match: { watchFeatures: { $exists: true, $not: { $size: 0 } } } },
          { $unwind: '$watchFeatures' },
          { $group: { _id: '$watchFeatures', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchStyles: [
          { $match: { watchStyle: { $exists: true } } },
          { $group: { _id: '$watchStyle', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        watchCaseSizes: [
          { $match: { watchCaseSize: { $exists: true } } },
          { $group: { _id: '$watchCaseSize', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],

        totalCount: [{ $count: 'count' }],
      },
    },
  ];
}