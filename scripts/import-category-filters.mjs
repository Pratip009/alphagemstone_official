/**
 * Import / migrate `final_category_filters.csv` into MongoDB.
 *
 * Safe to run repeatedly: every row is upserted on its natural key
 * (legacyCategoryId, attributeId, filterValueId), so re-running never
 * creates duplicate filter definitions — it only adds new rows / updates
 * changed ones.
 *
 * Usage:
 *   MONGODB_URI=... node scripts/import-category-filters.mjs [path/to/csv]
 *
 * Defaults to data/final_category_filters.csv (the master config copied
 * verbatim from the upload — never edit that file by hand).
 *
 * What it does:
 *   1. Reads and parses the CSV (category_id, parent_id, category_name,
 *      attribute_id, filter_name, filter_value_id, filter_value).
 *   2. Flags pure HTML section-header rows (e.g. "<b>DIAMOND INFO</b>") so
 *      query building always skips them — they were never real filters.
 *   3. Resolves each distinct category_name to the app's real taxonomy by
 *      matching Subcategory.name first, then Category.name
 *      (case-insensitive, whitespace-trimmed) — logs anything unmatched
 *      rather than guessing.
 *   4. Bulk-upserts every row into the CategoryFilter collection.
 *   5. Backfills Product.legacyCategoryId from data/products.csv (or
 *      src/lib/products.csv) by legacyProductId, so products can be looked
 *      up by the same category_id the filter CSV uses.
 */
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import csv from 'csv-parser';
import { config } from 'dotenv';
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Aborting — refusing to run against no database.');
  process.exit(1);
}

const CSV_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'data', 'final_category_filters.csv');

const PRODUCTS_CSV_PATH = fs.existsSync(path.join(ROOT, 'data', 'products.csv'))
  ? path.join(ROOT, 'data', 'products.csv')
  : path.join(ROOT, 'src', 'lib', 'products.csv');

// ─── Minimal inline schemas (mirrors src/models/*.ts — kept dependency-free
// so this script runs under plain node without a TS build step, same
// pattern as scripts/seed.mjs) ──────────────────────────────────────────────
const CategorySchema = new mongoose.Schema({ name: String, slug: String });
const SubcategorySchema = new mongoose.Schema({
  name: String, slug: String, category: mongoose.Schema.Types.ObjectId,
});
const ProductSchema = new mongoose.Schema({}, { strict: false });
const CategoryFilterSchema = new mongoose.Schema(
  {
    legacyCategoryId: Number,
    parentId: Number,
    categoryName: String,
    attributeId: Number,
    filterName: String,
    isSectionHeader: Boolean,
    filterValueId: Number,
    filterValue: String,
    filterValueNormalized: String,
    category: mongoose.Schema.Types.ObjectId,
    subcategory: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);
CategoryFilterSchema.index(
  { legacyCategoryId: 1, attributeId: 1, filterValueId: 1 },
  { unique: true }
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const CategoryFilter = mongoose.models.CategoryFilter || mongoose.model('CategoryFilter', CategoryFilterSchema);

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function isSectionHeader(filterName) {
  return /^<b>.*<\/b>$/i.test(String(filterName ?? '').trim());
}

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  console.log(`Reading filter CSV: ${CSV_PATH}`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }
  const rows = await readCsv(CSV_PATH);
  console.log(`  ${rows.length} rows read`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // ── Resolve category_name → real Category/Subcategory ObjectId ───────────
  const distinctCategoryNames = Array.from(
    new Set(rows.map((r) => normalize(r.category_name)).filter(Boolean))
  );

  const [allSubcategories, allCategories] = await Promise.all([
    Subcategory.find({}).select('name slug category').lean(),
    Category.find({}).select('name slug').lean(),
  ]);
  const subByName = new Map(allSubcategories.map((s) => [normalize(s.name), s]));
  const catByName = new Map(allCategories.map((c) => [normalize(c.name), c]));

  const resolution = new Map(); // normalized category_name -> { category, subcategory }
  const unmatched = [];
  for (const name of distinctCategoryNames) {
    const sub = subByName.get(name);
    if (sub) {
      resolution.set(name, { category: sub.category, subcategory: sub._id });
      continue;
    }
    const cat = catByName.get(name);
    if (cat) {
      resolution.set(name, { category: cat._id, subcategory: undefined });
      continue;
    }
    resolution.set(name, {});
    unmatched.push(name);
  }

  if (unmatched.length) {
    console.warn(
      `⚠️  ${unmatched.length}/${distinctCategoryNames.length} category_name values could not be matched to an existing Category/Subcategory (filters for these still import, just without a resolved category/subcategory link — facet lookups by legacyCategoryId still work once products.legacyCategoryId is backfilled):`
    );
    unmatched.slice(0, 30).forEach((n) => console.warn(`   - ${n}`));
    if (unmatched.length > 30) console.warn(`   ...and ${unmatched.length - 30} more`);
  }

  // ── Bulk upsert every row on its natural key ──────────────────────────────
  let ops = [];
  let imported = 0;
  let skippedInvalid = 0;
  const BATCH = 1000;

  for (const r of rows) {
    const legacyCategoryId = parseInt(r.category_id, 10);
    const attributeId = parseInt(r.attribute_id, 10);
    const filterValueId = parseInt(r.filter_value_id, 10);
    const filterName = String(r.filter_name ?? '').trim();
    const filterValue = String(r.filter_value ?? '').trim();
    const categoryName = String(r.category_name ?? '').trim();
    const parentId = r.parent_id ? parseInt(r.parent_id, 10) : undefined;

    if (!Number.isFinite(legacyCategoryId) || !Number.isFinite(attributeId) || !Number.isFinite(filterValueId) || !filterName) {
      skippedInvalid++;
      continue;
    }

    const resolved = resolution.get(normalize(categoryName)) || {};

    ops.push({
      updateOne: {
        filter: { legacyCategoryId, attributeId, filterValueId },
        update: {
          $set: {
            legacyCategoryId,
            parentId,
            categoryName,
            attributeId,
            filterName,
            isSectionHeader: isSectionHeader(filterName),
            filterValueId,
            filterValue,
            filterValueNormalized: normalize(filterValue),
            category: resolved.category,
            subcategory: resolved.subcategory,
          },
        },
        upsert: true,
      },
    });

    if (ops.length >= BATCH) {
      await CategoryFilter.bulkWrite(ops, { ordered: false });
      imported += ops.length;
      process.stdout.write(`\r  upserted ${imported}/${rows.length}`);
      ops = [];
    }
  }
  if (ops.length) {
    await CategoryFilter.bulkWrite(ops, { ordered: false });
    imported += ops.length;
  }
  console.log(`\n✅ CategoryFilter: ${imported} rows upserted, ${skippedInvalid} invalid rows skipped`);

  // ── Backfill Product.legacyCategoryId from the products export ───────────
  if (fs.existsSync(PRODUCTS_CSV_PATH)) {
    console.log(`\nBackfilling Product.legacyCategoryId from ${PRODUCTS_CSV_PATH}`);
    const productRows = await readCsv(PRODUCTS_CSV_PATH);
    let productOps = [];
    let backfilled = 0;
    let productBatch = 2000;

    for (const r of productRows) {
      const legacyProductId = parseInt(r.product_id, 10);
      if (!Number.isFinite(legacyProductId)) continue;

      const idSet = new Set();
      const primary = parseInt(r.category_id, 10);
      if (Number.isFinite(primary)) idSet.add(primary);
      for (const raw of [r.category_ids, r.category_ids_resolved]) {
        if (!raw) continue;
        const matches = String(raw).match(/\d+/g);
        if (matches) matches.forEach((m) => idSet.add(parseInt(m, 10)));
      }
      if (idSet.size === 0) continue;

      productOps.push({
        updateOne: {
          filter: { legacyProductId },
          update: { $set: { legacyCategoryId: Array.from(idSet) } },
        },
      });

      if (productOps.length >= productBatch) {
        const res = await Product.bulkWrite(productOps, { ordered: false });
        backfilled += res.modifiedCount || 0;
        process.stdout.write(`\r  backfilled ${backfilled}`);
        productOps = [];
      }
    }
    if (productOps.length) {
      const res = await Product.bulkWrite(productOps, { ordered: false });
      backfilled += res.modifiedCount || 0;
    }
    console.log(`\n✅ Product.legacyCategoryId backfilled on ${backfilled} products`);
  } else {
    console.warn(`⚠️  No products CSV found at ${PRODUCTS_CSV_PATH} — skipping legacyCategoryId backfill.`);
  }

  await mongoose.disconnect();
  console.log('\n🎉 Done.');
}

main().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
