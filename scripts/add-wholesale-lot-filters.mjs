/**
 * Makes the filter dropdowns appear on the Wholesale Lots pages:
 *   /products?category=wholesale-lots&subcategory=diamond-lots
 *   /products?category=wholesale-lots&subcategory=precious-gems-lots
 *   /products?category=wholesale-lots&subcategory=semi-precious-gems-lots
 *   /products?category=wholesale-lots
 *
 * DATA ONLY — works with the code that is already deployed, no deploy needed.
 *
 * Why the pages show no filters: the storefront
 * (getApplicableFilterDefinitions in src/services/categoryFilter.service.ts)
 * shows a filter bar only for pages that have CategoryFilter rows linked to
 * that exact subcategory. final_category_filters.csv only has rows for the
 * legacy "Deals and Steals" categories (ids 194 / 197 / 198), and those rows
 * are linked to the Deals and Steals subcategories, never to the Lots ones.
 *
 * This script copies those rows from data/final_category_filters.csv and
 * links the copies directly to the Lots subcategories (and to the Wholesale
 * Lots category page). The copies use their own legacyCategoryId
 * (900000 + original id for subcategory pages, 910000 + original for the
 * category page) so they never collide with the original rows, which are
 * left untouched. Only filter DEFINITIONS are added — the options and counts
 * shown in each dropdown are still computed live from the products on the
 * page.
 *
 * It also prints a diagnosis: how many products each page has, which
 * filter rows already exist, and how many products have data for each
 * filter. If a filter has no product data, run
 * scripts/backfill-wholesale-lot-filter-fields.mjs --commit as well.
 *
 * Idempotent (upserts). DRY-RUN by default.
 *
 * USAGE (from the project root):
 *   node scripts/add-wholesale-lot-filters.mjs              # diagnose + preview
 *   node scripts/add-wholesale-lot-filters.mjs --commit     # add the filter rows
 *   node scripts/add-wholesale-lot-filters.mjs --undo --commit
 *
 * Requires MONGODB_URI in environment or .env / .env.local file.
 */

import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(ROOT, '.env') });
config({ path: path.join(ROOT, '.env.local'), override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');
const UNDO = process.argv.includes('--undo');
const SOURCE_TAG = 'wholesale-lots-filters';

const CSV_CANDIDATES = [
  path.join(ROOT, 'data', 'final_category_filters.csv'),
  path.join(ROOT, 'final_category_filters.csv'),
];

const CATEGORY_SLUG = 'wholesale-lots';
const PAGES = [
  { subSlug: 'diamond-lots',            legacyIds: [194] },
  { subSlug: 'precious-gems-lots',      legacyIds: [197] },
  { subSlug: 'semi-precious-gems-lots', legacyIds: [198] },
  { subSlug: null,                      legacyIds: [194, 197, 198] }, // Wholesale Lots category page
];

// Product field each filter reads (mirrors src/lib/categoryFilterAttributeMap.ts),
// used only for the diagnosis output.
const FIELD_FOR = {
  TREATMENT: 'treatment', ORIGIN: 'origin', CUT: 'cutType', COLOR: 'colorRaw',
  SHAPE: 'shapeRaw', LUSTER: 'luster', HARDNESS: 'hardness', GRADE: 'gradeRaw',
  CLARITY: 'clarityRaw', NAME: 'gemstoneName', SIZE: 'dimensions',
  WEIGHT: 'caratWeight', 'NUMBER OF STONES': 'numberOfStones',
  'APPROX. NUMBER OF STONES': 'numberOfStones', 'CLARITY/GRADE': 'clarityRaw|gradeRaw',
  'CARAT RANGE': 'legacyAttributes.CARAT RANGE', 'SIZE RANGE': 'legacyAttributes.SIZE RANGE',
};

const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
const Subcategory = mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }), 'subcategories');
const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');
const CategoryFilter = mongoose.model('CategoryFilter', new mongoose.Schema({}, { strict: false, timestamps: true }), 'categoryfilters');

// Minimal CSV parser (handles quoted fields with commas).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

const isSectionHeader = (n) => /^<b>.*<\/b>$/i.test(String(n).trim());
const normalize = (v) => String(v).trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : ' (DRY RUN — pass --commit to write)'}${UNDO ? ' [UNDO]' : ''}\n`);

  if (UNDO) {
    const n = await CategoryFilter.countDocuments({ source: SOURCE_TAG });
    console.log(`${n} filter row(s) added by this script.`);
    if (COMMIT) {
      const res = await CategoryFilter.deleteMany({ source: SOURCE_TAG });
      console.log(`✅ Deleted ${res.deletedCount}.`);
    }
    return;
  }

  const csvPath = CSV_CANDIDATES.find((p) => fs.existsSync(p));
  if (!csvPath) throw new Error(`final_category_filters.csv not found (looked in ${CSV_CANDIDATES.join(', ')})`);
  const csvRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  console.log(`Filter CSV: ${csvPath} (${csvRows.length} rows)\n`);

  const category = await Category.findOne({ slug: CATEGORY_SLUG }).lean();
  if (!category) throw new Error(`Category "${CATEGORY_SLUG}" not found`);
  if (category.isActive === false) console.warn(`⚠️  Category "${category.name}" is inactive.`);

  const ops = [];
  for (const page of PAGES) {
    const sub = page.subSlug ? await Subcategory.findOne({ slug: page.subSlug }).lean() : null;
    if (page.subSlug && !sub) {
      console.log(`❌ Subcategory "${page.subSlug}" not found — skipping.\n`);
      continue;
    }
    const label = sub ? `${category.name} > ${sub.name}` : `${category.name} (category page)`;
    console.log('─'.repeat(72));
    console.log(label);

    // Same product scope the storefront uses for this page.
    const productScope = sub
      ? { isActive: true, $or: [{ category: category._id, subcategory: sub._id }, { crossListedSubcategoryIds: sub._id }] }
      : { isActive: true, category: category._id };
    const productCount = await Product.countDocuments(productScope);

    const linkedScope = sub
      ? { subcategory: sub._id, isSectionHeader: { $ne: true } }
      : { category: category._id, subcategory: { $exists: false }, isSectionHeader: { $ne: true } };
    const existingLinked = await CategoryFilter.countDocuments(linkedScope);

    console.log(`  Products shown on this page:         ${productCount}`);
    console.log(`  Filter rows currently linked to it:  ${existingLinked}${existingLinked === 0 ? '   ← why no filters show' : ''}`);

    const rows = csvRows.filter((r) => page.legacyIds.includes(parseInt(r.category_id, 10)) && !isSectionHeader(r.filter_name));
    const names = [...new Set(rows.map((r) => r.filter_name.trim()))];
    console.log(`  Filter rows to link from the CSV:    ${rows.length} (${names.length} filters)`);

    // Diagnosis: how many products on the page have data for each filter.
    if (productCount) {
      const coverage = [];
      for (const name of names) {
        const field = FIELD_FOR[name.toUpperCase()];
        if (!field) continue;
        const conds = field.split('|').map((f) => ({ [f]: { $exists: true, $nin: [null, ''] } }));
        const n = await Product.countDocuments({ $and: [productScope, conds.length > 1 ? { $or: conds } : conds[0]] });
        coverage.push(`${name} ${n}`);
      }
      console.log(`  Products with data per filter:       ${coverage.join(' · ')}`);
    }
    console.log('');

    const offset = sub ? 900000 : 910000;
    for (const r of rows) {
      const legacyCategoryId = offset + parseInt(r.category_id, 10);
      const attributeId = parseInt(r.attribute_id, 10);
      const filterValueId = parseInt(r.filter_value_id, 10);
      const filterName = r.filter_name.trim();
      const filterValue = String(r.filter_value ?? '').trim();
      if (!Number.isFinite(attributeId) || !Number.isFinite(filterValueId) || !filterName || !filterValue) continue;
      const set = {
        legacyCategoryId, attributeId, filterValueId,
        parentId: parseInt(r.parent_id, 10) || undefined,
        categoryName: sub ? sub.name : category.name,
        filterName, isSectionHeader: false,
        filterValue, filterValueNormalized: normalize(filterValue),
        category: category._id,
        source: SOURCE_TAG,
      };
      const update = { $set: set };
      if (sub) set.subcategory = sub._id;
      else update.$unset = { subcategory: '' };
      ops.push({ updateOne: { filter: { legacyCategoryId, attributeId, filterValueId }, update, upsert: true } });
    }
  }

  console.log('─'.repeat(72));
  console.log(`${ops.length} filter row(s) to add/update.`);
  if (!COMMIT) {
    console.log('\nDry run — nothing written. Re-run with --commit to apply.');
    return;
  }
  let upserted = 0, modified = 0;
  for (let i = 0; i < ops.length; i += 500) {
    const res = await CategoryFilter.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    upserted += res.upsertedCount; modified += res.modifiedCount;
  }
  console.log(`\n✅ Added ${upserted}, updated ${modified}. Reload the Lots pages — no deploy needed.`);
}

main()
  .catch((err) => { console.error('❌ Script failed:', err.message ?? err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
