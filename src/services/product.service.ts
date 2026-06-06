import mongoose from 'mongoose';
import Product, { IProduct } from '@/models/Product';
import '@/lib/registerModels';
import {
  buildProductFilterQuery,
  buildFacetsPipeline,
  resolveSlugFilters,
  ProductFilterParams,
} from './productFilter.service';

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
      .lean(),
    Product.countDocuments(query),
  ]);

  return { products, total, page, limit };
}

export async function getProductFacets(params: ProductFilterParams) {
  // Also resolve slugs for facets so counts are scoped correctly
  const resolved = await resolveSlugFilters({
    category: params.category,
    subcategory: params.subcategory,
  });

  const { query } = buildProductFilterQuery(resolved);

  const pipeline = buildFacetsPipeline(query) as Parameters<typeof Product.aggregate>[0];
  const [result] = await Product.aggregate(pipeline);
  return result;
}

export async function getProductById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return Product.findOne({ _id: id, isActive: true })
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug')
    .lean();
}

export async function createProduct(data: Partial<IProduct>) {
  console.log("CREATE PRODUCT DATA:", JSON.stringify(data, null, 2));
  const product = new Product(data);
  console.log("MONGOOSE VALIDATION:", product.validateSync());
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