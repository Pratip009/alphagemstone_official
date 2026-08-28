import mongoose from 'mongoose';
import Product, { IProduct } from '@/models/Product';
import '@/lib/registerModels';
import {
  buildProductFilterQuery,
  buildFacetsPipeline,
  buildSimpleFilterFacetsPipeline,
  resolveSlugFilters,
  ProductFilterParams,
} from './productFilter.service';
import {
  applyCategoryFilterSelection,
  getApplicableFilterDefinitions,
  getCategoryFilterFacets,
  CategoryFilterSelection,
  CategoryFilterGroup,
} from './categoryFilter.service';

export async function listProducts(params: ProductFilterParams) {
  // Resolve category/subcategory slugs → ObjectIds before building the query
  const resolved = await resolveSlugFilters(params);
  const { query, sort, page, limit, skip } = buildProductFilterQuery(resolved);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('subSubcategory', 'name slug')
      .lean(),
    Product.countDocuments(query),
  ]);

  return { products, total, page, limit };
}

// ─── CSV-driven, category-specific filtering ───────────────────────────────
// Extends listProducts with the final_category_filters.csv-backed dynamic
// filter system: applies the customer's selections (AND across filters, OR
// within a filter's own values) server-side via a Mongo query — never loads
// the full catalogue into the browser — and returns the applicable filter
// groups with live, currently-accurate counts alongside the page of
// products. Category/subcategory scoping and every other existing param
// (search, sort, pagination, price/size ranges, etc.) behave exactly as in
// listProducts; this only adds the extra $and clause for the CSV filters.
export async function listProductsWithCategoryFilters(
  params: ProductFilterParams,
  categorySelection: CategoryFilterSelection
) {
  const resolved = await resolveSlugFilters(params);
  const { query, sort, page, limit, skip } = buildProductFilterQuery(resolved);

  const finalQuery = applyCategoryFilterSelection(query, categorySelection);

  const [products, total, definitions] = await Promise.all([
    Product.find(finalQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('subSubcategory', 'name slug')
      .lean(),
    Product.countDocuments(finalQuery),
    getApplicableFilterDefinitions({
      categoryId: resolved.category,
      subcategoryId: resolved.subcategory,
    }),
  ]);

  let categoryFilters: CategoryFilterGroup[] = [];
  if (definitions.length > 0) {
    categoryFilters = await getCategoryFilterFacets(query, definitions, categorySelection);
  }

  return { products, total, page, limit, categoryFilters };
}

// ─── Admin listing ──────────────────────────────────────────────────────────
// Unlike listProducts (storefront-facing: forces isActive:true, text search
// only), this is built for the admin catalogue at /admin/products, which
// needs to see inactive products too and filter by memo eligibility.
// Everything happens in the query — nothing is ever pulled into memory and
// filtered/sorted in JS, because the catalogue can run into the tens of
// thousands of SKUs.
export interface AdminProductQueryParams {
  q?: string;
  category?: string;
  subcategory?: string;
  status?: 'all' | 'active' | 'inactive';
  shape?: string;
  clarity?: string;
  memo?: 'all' | 'eligible' | 'not';
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

const ADMIN_SORT_FIELDS = new Set(['name', 'price', 'stock', 'createdAt']);
const ADMIN_MAX_LIMIT = 100;

// Shared by listProductsAdmin (read) and bulkDeactivateProductsAdmin
// (write) so the two can never drift apart — whatever set of products an
// admin sees on screen for a given filter is exactly the set a bulk action
// against that same filter will touch.
function buildAdminProductQuery(
  params: Pick<AdminProductQueryParams, 'q' | 'category' | 'subcategory' | 'status' | 'shape' | 'clarity' | 'memo'>
): mongoose.FilterQuery<IProduct> {
  const query: mongoose.FilterQuery<IProduct> = {};

  if (params.q && params.q.trim()) {
    // Escape regex metacharacters so a search like "1.5ct" doesn't break.
    const escaped = params.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.name = { $regex: escaped, $options: 'i' };
  }
  if (params.category) query.category = params.category;
  if (params.subcategory) query.subcategory = params.subcategory;
  if (params.status === 'active') query.isActive = true;
  else if (params.status === 'inactive') query.isActive = false;
  if (params.shape) query.shape = params.shape;
  if (params.clarity) query.clarity = params.clarity;
  if (params.memo === 'eligible') query.memoEligible = true;
  else if (params.memo === 'not') query.memoEligible = { $ne: true };

  return query;
}

// True if at least one real filter is set — i.e. this isn't just "match
// everything". Used to stop the bulk-deactivate endpoint from ever being
// called with an empty/no-op filter that would silently match the whole
// catalogue (that's what the separate, explicit "Delete All" flow is for).
function hasAnyAdminFilter(
  params: Pick<AdminProductQueryParams, 'q' | 'category' | 'subcategory' | 'status' | 'shape' | 'clarity' | 'memo'>
): boolean {
  return !!(
    (params.q && params.q.trim()) ||
    params.category ||
    params.subcategory ||
    (params.status && params.status !== 'all') ||
    params.shape ||
    params.clarity ||
    (params.memo && params.memo !== 'all')
  );
}

export async function listProductsAdmin(params: AdminProductQueryParams) {
  const query = buildAdminProductQuery(params);

  const sortField = params.sortBy && ADMIN_SORT_FIELDS.has(params.sortBy) ? params.sortBy : 'name';
  const sortDir: 1 | -1 = params.sortDir === 'desc' ? -1 : 1;
  const sort: Record<string, 1 | -1> = { [sortField]: sortDir };

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('subSubcategory', 'name slug')
      .lean(),
    Product.countDocuments(query),
  ]);

  return { products, total, page, limit };
}

// How many products the given filter currently matches — used to preview a
// bulk-deactivate before it runs, with the exact same query the write will
// use (see buildAdminProductQuery above).
export async function countProductsAdmin(
  params: Pick<AdminProductQueryParams, 'q' | 'category' | 'subcategory' | 'status' | 'shape' | 'clarity' | 'memo'>
): Promise<number> {
  const query = buildAdminProductQuery(params);
  return Product.countDocuments(query);
}

export interface BulkDeactivateResult {
  matched: number;
  modified: number;
}

// Soft-deletes (isActive: false) every product matching the given filter —
// the same behavior as the existing single-product delete endpoint
// (deleteProduct below), just applied to a whole filtered set at once
// instead of one _id at a time. Deliberately refuses to run against an
// empty filter (see hasAnyAdminFilter) so this can never become a second,
// accidental "delete everything" path.
export async function bulkDeactivateProductsAdmin(
  params: Pick<AdminProductQueryParams, 'q' | 'category' | 'subcategory' | 'status' | 'shape' | 'clarity' | 'memo'>
): Promise<BulkDeactivateResult> {
  if (!hasAnyAdminFilter(params)) {
    throw new Error('At least one filter is required for a bulk deactivate — refusing to match the whole catalogue.');
  }
  const query = buildAdminProductQuery(params);
  const result = await Product.updateMany(query, { $set: { isActive: false } });
  return {
    matched: result.matchedCount ?? 0,
    modified: result.modifiedCount ?? 0,
  };
}
// Re-activates (isActive: true) every product matching the given filter —
// the mirror image of bulkDeactivateProductsAdmin above, same guardrail
// against an empty/no-op filter.
export async function bulkReactivateProductsAdmin(
  params: Pick<AdminProductQueryParams, 'q' | 'category' | 'subcategory' | 'status' | 'shape' | 'clarity' | 'memo'>
): Promise<BulkDeactivateResult> {
  if (!hasAnyAdminFilter(params)) {
    throw new Error('At least one filter is required for a bulk reactivate — refusing to match the whole catalogue.');
  }
  const query = buildAdminProductQuery(params);
  const result = await Product.updateMany(query, { $set: { isActive: true } });
  return {
    matched: result.matchedCount ?? 0,
    modified: result.modifiedCount ?? 0,
  };
}

// Global catalogue stats for the admin dashboard cards. Deliberately
// unfiltered (independent of whatever search/filter the admin currently has
// applied) and computed entirely in the database via a single aggregation,
// so it stays fast regardless of catalogue size.
export async function getProductStats() {
  const [result] = await Product.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        active: [{ $match: { isActive: true } }, { $count: 'count' }],
        memoEligible: [{ $match: { memoEligible: true } }, { $count: 'count' }],
        inventoryValue: [
          { $group: { _id: null, value: { $sum: { $multiply: ['$price', '$stock'] } } } },
        ],
      },
    },
  ]);

  const total = result?.total?.[0]?.count ?? 0;
  const active = result?.active?.[0]?.count ?? 0;
  const memoEligible = result?.memoEligible?.[0]?.count ?? 0;
  const inventoryValue = result?.inventoryValue?.[0]?.value ?? 0;

  return { total, active, inactive: total - active, memoEligible, inventoryValue };
}

export async function getProductFacets(
  params: ProductFilterParams,
  kind?: 'watch' | 'diamond' | 'gemstone',
) {
  // Also resolve slugs for facets so counts are scoped correctly
  const resolved = await resolveSlugFilters({
    category: params.category,
    subcategory: params.subcategory,
    productKind: params.productKind,
  });

  const { query } = buildProductFilterQuery(resolved);

  const pipeline = buildFacetsPipeline(query, kind) as Parameters<typeof Product.aggregate>[0];
  const [result] = await Product.aggregate(pipeline);
  return result;
}

// Cascading option lists for the simplified /products dropdown filter
// (SHAPE / SIZE / COLOR / CLARITY / APPROX WEIGHT / NUMBER OF STONES). See
// buildSimpleFilterFacetsPipeline for the self-excluding logic.
export interface SimpleFilterFacetValue { _id: string | number; count: number }
export interface SimpleFilterFacets {
  shape: SimpleFilterFacetValue[];
  size: SimpleFilterFacetValue[];
  color: SimpleFilterFacetValue[];
  clarity: SimpleFilterFacetValue[];
  approxWeight: SimpleFilterFacetValue[];
  numberOfStones: SimpleFilterFacetValue[];
}

export async function getSimpleFilterFacets(
  params: ProductFilterParams,
): Promise<SimpleFilterFacets> {
  const resolved = await resolveSlugFilters({
    category: params.category,
    subcategory: params.subcategory,
    productKind: params.productKind,
  });

  const pipeline = buildSimpleFilterFacetsPipeline({
    ...params,
    category: resolved.category,
    subcategory: resolved.subcategory,
  }) as Parameters<typeof Product.aggregate>[0];

  const [result] = await Product.aggregate(pipeline);
  return (result ?? { shape: [], size: [], color: [], clarity: [], approxWeight: [], numberOfStones: [] }) as SimpleFilterFacets;
}

export async function getProductById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Product.findOne({ _id: id, isActive: true })
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .populate('subSubcategory', 'name slug')
    .lean();
}

// Used by the "Recently Viewed" feature to hydrate a list of localStorage
// ids into full product docs in one round trip. Silently drops invalid
// ObjectId strings and inactive/deleted products rather than erroring, so a
// stale id in a visitor's browser history never breaks the request.
export async function getProductsByIds(ids: string[]) {
  const validIds = Array.from(new Set(ids)).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length === 0) return [];

  return Product.find({ _id: { $in: validIds }, isActive: true })
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .populate('subSubcategory', 'name slug')
    .lean();
}

export async function createProduct(data: Partial<IProduct>) {
  // console.log("CREATE PRODUCT DATA:", JSON.stringify(data, null, 2));
  const product = new Product(data);
  // console.log("MONGOOSE VALIDATION:", product.validateSync());
  await product.save();
  return product.toObject();
}

export async function updateProduct(id: string, data: Partial<IProduct>) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Product.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  ).lean();
}

export async function deleteProduct(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Product.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
}

export interface BulkInsertResult {
  inserted: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: Record<string, unknown> }>;
}

export async function bulkCreateProducts(
  rows: Record<string, unknown>[]
): Promise<BulkInsertResult> {
  const result: BulkInsertResult = { inserted: 0, failed: 0, errors: [] };
  const CHUNK_SIZE = 500;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const validDocs: object[] = [];

    for (let j = 0; j < chunk.length; j++) {
      const rowIndex = i + j + 2;
      const row = chunk[j];
      try {
        const doc = new Product(row);
        await doc.validate();
        validDocs.push(doc.toObject());
      } catch (err: unknown) {
        result.failed++;
        result.errors.push({
          row: rowIndex,
          error: err instanceof Error ? err.message : 'Validation failed',
          data: row,
        });
      }
    }

    if (validDocs.length > 0) {
      try {
        const inserted = await Product.insertMany(validDocs, { ordered: false });
        result.inserted += inserted.length;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'insertedDocs' in err) {
          const bulkErr = err as {
            insertedDocs?: unknown[];
            writeErrors?: Array<{ errmsg?: string; index?: number }>;
          };
          result.inserted += bulkErr.insertedDocs?.length || 0;
          for (const we of bulkErr.writeErrors || []) {
            result.failed++;
            result.errors.push({
              row: i + (we.index || 0) + 2,
              error: we.errmsg || 'Insert failed',
              data: (validDocs[we.index || 0] as Record<string, unknown>) || {},
            });
          }
        } else {
          result.failed += validDocs.length;
          result.errors.push({
            row: i + 2,
            error: err instanceof Error ? err.message : 'Bulk insert failed',
            data: {},
          });
        }
      }
    }
  }

  return result;
}