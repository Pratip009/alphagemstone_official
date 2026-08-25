import { FilterQuery } from 'mongoose';
import { cache } from 'react';
import { IProduct } from '@/models/Product';
import Category from '@/models/Category';
import Subcategory from '@/models/Subcategory';
import { escapeRegex, extractCarat, CARAT_MATCH_TOLERANCE } from '@/lib/search';
import { SPECIALS_VIRTUAL_SUBCATEGORY_MAP } from '@/lib/specialsVirtualSubcategories';

// ─── Filter Query Params ──────────────────────────────────────────────────────
export interface ProductFilterParams {
  // Category
  category?: string;
  subcategory?: string;
  // Internal — set by resolveSlugFilters(), never passed in from a route.
  // When the requested subcategory is one of the "Specials" cross-listing
  // subcategories, this carries its legacy category id so
  // buildProductFilterQuery()/baseSimpleFilter() can match the FULL real
  // membership (via Product.legacyCategoryId) instead of the handful of
  // products whose primary category/subcategory ref is literally Specials.
  // See the SPECIALS_SUBCATEGORY_LEGACY_IDS comment below for why.
  specialsLegacyId?: number;
  // Internal — set by resolveSlugFilters() when the requested subcategory
  // is one of SPECIALS_VIRTUAL_SUBCATEGORIES (e.g. "make-an-offer",
  // "9-99-specials"). These aren't real Subcategory documents — no
  // category/subcategory ref is applied at all, just the criterion's own
  // `match` object, since the matching products span every real category.
  specialsVirtualMatch?: FilterQuery<IProduct>;

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

  // Simple single-select dropdown filters (the simplified /products filter
  // bar — SHAPE / SIZE / CLARITY / APPROX WEIGHT / NUMBER OF STONES). These
  // are exact-value selects rather than the ranges below, and are kept
  // separate from sizeMin/sizeMax so both filter UIs can coexist.
  size?: string | string[];
  approxWeight?: string | string[];
  numberOfStones?: string | string[];

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
const isObjectId = (val: string) => /^[a-f\d]{24}$/i.test(val);

// ─── Specials cross-listing ────────────────────────────────────────────────
// The legacy site merchandised the same product under BOTH its real home
// category (e.g. Jewelry > Diamond Rings) AND a "Specials" subcategory
// (Specials > Jewelry Specials) — see products.csv `category_paths_all` /
// `category_ids_resolved`. Product only stores one category/subcategory
// pair though, so most of those products' PRIMARY category/subcategory
// refs point at their real home, not Specials — a strict
// {category: Specials, subcategory: X} match only ever finds the handful
// of products whose primary ref IS Specials.
//
// The full cross-listing survives on every product as
// `legacyCategoryId` (populated at import time from the CSV's
// `category_id`/`category_ids_resolved` columns — see
// fileParser.service.ts), so that's the real source of truth for "does
// this belong under Specials > X". These ids are the legacy
// products.csv `category_id` values for the four Specials subcategories.
const SPECIALS_SUBCATEGORY_LEGACY_IDS: Record<string, number> = {
  'alpha-specials': 212,
  'diamond-specials': 203,
  'gemstone-specials': 204,
  'jewelry-specials': 205,
};

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

  // Slugs are still raw strings at this point (not yet resolved to
  // ObjectIds below) — the only place we can key off the subcategory slug
  // text to detect a Specials cross-listing request.
  if (
    resolved.category === 'specials' &&
    resolved.subcategory &&
    SPECIALS_SUBCATEGORY_LEGACY_IDS[resolved.subcategory]
  ) {
    resolved.specialsLegacyId = SPECIALS_SUBCATEGORY_LEGACY_IDS[resolved.subcategory];
  }

  // Virtual Specials subcategories (Make An Offer, $9.99/$24.99/$99.00
  // Specials) aren't backed by a Subcategory document at all — skip both
  // the category AND subcategory ObjectId lookups below entirely so we
  // never try to resolve "make-an-offer" as a real subcategory slug (which
  // would just silently match nothing).
  if (
    resolved.category === 'specials' &&
    resolved.subcategory &&
    SPECIALS_VIRTUAL_SUBCATEGORY_MAP[resolved.subcategory]
  ) {
    resolved.specialsVirtualMatch = SPECIALS_VIRTUAL_SUBCATEGORY_MAP[resolved.subcategory].match;
    resolved.category = undefined;
    resolved.subcategory = undefined;
    return resolved;
  }

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

  // Conditions that must each independently be ANDed onto the filter as
  // their own $or block. Populated by the Specials cross-listing branch
  // and the general subcategory cross-listing branch below — kept separate
  // from filter.$or (used later by the full-text search branch) since a
  // plain object can only carry one $or key and the two would otherwise
  // silently clobber each other.
  const andConditions: FilterQuery<IProduct>[] = [];

  // ── Category ───────────────────────────────────────────────────────────────
  if (params.specialsVirtualMatch) {
    // No category/subcategory ref at all — these span every real category,
    // so the criterion's own match object (price range, makeAnOffer, …) is
    // the entire scope.
    Object.assign(filter, params.specialsVirtualMatch);
  } else if (params.specialsLegacyId != null) {
    const scopeOr: FilterQuery<IProduct>[] = [
      { legacyCategoryId: params.specialsLegacyId },
    ];
    if (params.category && params.subcategory) {
      scopeOr.push({ category: params.category, subcategory: params.subcategory });
    }
    andConditions.push({ $or: scopeOr });
  } else if (params.subcategory) {
    // Match either real membership (category + subcategory both match) OR
    // a thematic cross-listing (crossListedSubcategoryIds contains this
    // subcategory) — e.g. Occasions & Gifts > Valentine Jewelry pulls in
    // ruby/pink-sapphire rings that live primarily under Jewelry > Gemstone
    // Rings. See Product.crossListedSubcategoryIds for why this exists.
    const scopeOr: FilterQuery<IProduct>[] = [
      { crossListedSubcategoryIds: params.subcategory },
    ];
    if (params.category) {
      scopeOr.push({ category: params.category, subcategory: params.subcategory });
    } else {
      scopeOr.push({ subcategory: params.subcategory });
    }
    andConditions.push({ $or: scopeOr });
  } else if (params.category) {
    filter.category = params.category;
  }
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

  // ── Simple exact-value select filters ───────────────────────────────────────
  // (the simplified /products dropdown filter — single-select, but built on
  // $in so a future multi-select wouldn't require any query changes)
  const exactSizes = toArray(params.size).map(Number).filter((n) => !isNaN(n));
  if (exactSizes.length > 0) {
    filter.size = { ...(filter.size as object || {}), $in: exactSizes };
  }

  const approxWeights = toArray(params.approxWeight);
  if (approxWeights.length > 0) filter.approxWeight = { $in: approxWeights };

  const stoneCounts = toArray(params.numberOfStones).map(Number).filter((n) => !isNaN(n));
  if (stoneCounts.length > 0) filter.numberOfStones = { $in: stoneCounts };

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
    filter.size = { ...(filter.size as object || {}) };
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
    if (andConditions.length > 0) {
      andConditions.push({ $or: orConditions });
    } else {
      filter.$or = orConditions;
    }
  }

  if (andConditions.length > 0) filter.$and = andConditions;

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
// `kind` scopes which $facet branches actually get computed. A single
// $facet with all ~16 branches was being run on EVERY /products request
// regardless of whether the page was showing watches or diamonds — so a
// diamond listing was still grouping/unwinding watchFeatures, watchBrands,
// etc. across every matched document (post-$match, in memory), and vice
// versa. That extra, entirely-unused work was a big part of why the page
// sat behind the full-page loading.tsx skeleton far longer than the actual
// product query needed. Passing the resolved productType cuts the branch
// count roughly in half and skips work whose result is never rendered.
export function buildFacetsPipeline(
  baseFilter: FilterQuery<IProduct>,
  kind?: 'watch' | 'diamond' | 'gemstone',
) {
  const diamondFacets = {
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
    sizeRange: [
      { $group: { _id: null, min: { $min: '$size' }, max: { $max: '$size' } } },
    ],
  };

  const watchFacets = {
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
  };

  // Always cheap, always relevant regardless of kind.
  const common = {
    priceRange: [
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ],
    totalCount: [{ $count: 'count' }],
  };

  const facetBranches =
    kind === 'watch'
      ? { ...watchFacets, ...common }
      : kind === 'diamond' || kind === 'gemstone'
        ? { ...diamondFacets, ...common }
        // Unknown kind (e.g. empty result set, no prior signal) — compute
        // everything, same as before, so nothing regresses.
        : { ...diamondFacets, ...watchFacets, ...common };

  return [{ $match: baseFilter }, { $facet: facetBranches }];
}

// ─── Simple filter facets (cascading dropdowns) ────────────────────────────────
// Powers the simplified /products filter bar: SHAPE / SIZE / CLARITY /
// APPROX WEIGHT / NUMBER OF STONES. Each dropdown's option list is
// "self-excluding" — computed from every OTHER active selection but never
// the field's own, so e.g. picking a shape narrows the Size/Clarity/Approx
// Weight/Number of Stones options to what's actually available for that
// shape, without the Shape dropdown itself collapsing to one option.
const SIMPLE_FILTER_FIELDS = ['shape', 'size', 'color', 'clarity', 'approxWeight', 'numberOfStones'] as const;
export type SimpleFilterField = (typeof SIMPLE_FILTER_FIELDS)[number];

// shape/color/clarity are stored as arrays on the product; size/approxWeight/
// numberOfStones are scalars. Determines whether a branch needs an $unwind
// before grouping, and how the "has a value" existence check is written.
const ARRAY_FIELDS = new Set<SimpleFilterField>(['shape', 'color', 'clarity']);

function simpleFieldSelection(field: SimpleFilterField, params: ProductFilterParams): string[] {
  switch (field) {
    case 'shape':          return toArray(params.shape);
    case 'color':           return toArray(params.color);
    case 'clarity':        return toArray(params.clarity);
    case 'size':            return toArray(params.size);
    case 'approxWeight':    return toArray(params.approxWeight);
    case 'numberOfStones': return toArray(params.numberOfStones);
  }
}

function baseSimpleFilter(params: ProductFilterParams): FilterQuery<IProduct> {
  const filter: FilterQuery<IProduct> = { isActive: true };
  if (params.specialsVirtualMatch) {
    Object.assign(filter, params.specialsVirtualMatch);
  } else if (params.specialsLegacyId != null) {
    const scopeOr: FilterQuery<IProduct>[] = [
      { legacyCategoryId: params.specialsLegacyId },
    ];
    if (params.category && params.subcategory) {
      scopeOr.push({ category: params.category, subcategory: params.subcategory });
    }
    filter.$or = scopeOr;
  } else if (params.subcategory) {
    const scopeOr: FilterQuery<IProduct>[] = [
      { crossListedSubcategoryIds: params.subcategory },
    ];
    if (params.category) {
      scopeOr.push({ category: params.category, subcategory: params.subcategory });
    } else {
      scopeOr.push({ subcategory: params.subcategory });
    }
    filter.$or = scopeOr;
  } else if (params.category) {
    filter.category = params.category;
  }
  if (params.productKind) filter.productKind = params.productKind;
  return filter;
}

export function buildSimpleFilterFacetsPipeline(params: ProductFilterParams) {
  const branches: Record<string, object[]> = {};

  SIMPLE_FILTER_FIELDS.forEach((field) => {
    const filter = baseSimpleFilter(params) as Record<string, unknown>;

    // Apply every other active selection, never this field's own.
    SIMPLE_FILTER_FIELDS.forEach((other) => {
      if (other === field) return;
      const values = simpleFieldSelection(other, params);
      if (values.length === 0) return;
      const numeric = other === 'size' || other === 'numberOfStones';
      const parsed = numeric ? values.map(Number).filter((n) => !isNaN(n)) : values;
      if (parsed.length > 0) filter[other] = { $in: parsed };
    });

    // Only offer values that actually exist on at least one matching product.
    filter[field] = ARRAY_FIELDS.has(field)
      ? { $exists: true, $not: { $size: 0 } }
      : { $exists: true, $nin: [null, ''] };

    branches[field] = [
      { $match: filter },
      ...(ARRAY_FIELDS.has(field) ? [{ $unwind: `$${field}` }] : []),
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
  });

  return [{ $facet: branches }];
}