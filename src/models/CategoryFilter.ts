import mongoose, { Document, Schema } from 'mongoose';

// ─── CategoryFilter ─────────────────────────────────────────────────────────
// One document per (legacyCategoryId, attributeId, filterValueId) row of
// `final_category_filters.csv` — the master, category-specific filter
// configuration exported from the legacy catalogue.
//
// This is intentionally a separate collection from Product: it describes
// *which filters/values a category is allowed to show*, not the products
// themselves. The actual counts shown next to each value are always
// computed live from Product (see categoryFilter.service.ts) so they never
// drift from the real catalogue — this collection only answers "does this
// category have a SHAPE filter, and is 'Marquise' one of its known values".
//
// legacyCategoryId is the join key back to the legacy catalogue export
// (products.csv `category_id` / `category_ids`), which is also written onto
// Product.legacyCategoryId during import. category/subcategory are resolved
// best-effort references into the real Category/Subcategory taxonomy (by
// name) purely so the admin UI and category-scoped queries can look things
// up without re-doing the name match every time; the source of truth for
// "which products does this apply to" is always legacyCategoryId.
export interface ICategoryFilter extends Document {
  _id: mongoose.Types.ObjectId;
  legacyCategoryId: number;
  parentId?: number;
  categoryName: string;

  attributeId: number;
  // Raw filter_name text from the CSV, exactly as exported (e.g. "WEIGHT",
  // "CLARITY/GRADE"). Some rows are HTML section headers rather than real
  // filters (e.g. "<b>DIAMOND INFO</b>") — those are imported too (for
  // completeness/auditability) but flagged via `isSectionHeader` so query
  // building always skips them.
  filterName: string;
  isSectionHeader: boolean;

  filterValueId: number;
  filterValue: string;
  // Case/whitespace-normalized form of filterValue, used for de-duplication
  // and for matching against product attribute values that may have
  // inconsistent capitalization/whitespace in the source data.
  filterValueNormalized: string;

  // Resolved links into the real taxonomy — best-effort, may be null if no
  // Category/Subcategory could be matched by name at import time.
  category?: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const CategoryFilterSchema = new Schema<ICategoryFilter>(
  {
    legacyCategoryId: { type: Number, required: true },
    parentId: { type: Number },
    categoryName: { type: String, required: true, trim: true },

    attributeId: { type: Number, required: true },
    filterName: { type: String, required: true, trim: true },
    isSectionHeader: { type: Boolean, default: false },

    filterValueId: { type: Number, required: true },
    filterValue: { type: String, required: true, trim: true },
    filterValueNormalized: { type: String, required: true },

    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    subcategory: { type: Schema.Types.ObjectId, ref: 'Subcategory' },
  },
  { timestamps: true }
);

// The natural key of a CSV row. Unique + upserted on this in the import
// script, so re-running the import is always safe (no duplicate filter
// definitions) whether it's the first run or the hundredth.
CategoryFilterSchema.index(
  { legacyCategoryId: 1, attributeId: 1, filterValueId: 1 },
  { unique: true }
);

// Primary read pattern: "give me every filter for this category, grouped
// by attribute" — category page load, one query.
CategoryFilterSchema.index({ legacyCategoryId: 1, attributeId: 1 });
CategoryFilterSchema.index({ subcategory: 1 });
CategoryFilterSchema.index({ category: 1 });
CategoryFilterSchema.index({ filterName: 1 });

const CategoryFilter = (() => {
  if (mongoose.models && mongoose.models.CategoryFilter) {
    return mongoose.models.CategoryFilter as mongoose.Model<ICategoryFilter>;
  }
  return mongoose.model<ICategoryFilter>('CategoryFilter', CategoryFilterSchema);
})();

export default CategoryFilter;
