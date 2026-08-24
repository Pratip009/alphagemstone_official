/**
 * Populate the "Wholesale Lots" category (and its Diamond Lots / Precious
 * Gems Lots / Semi Precious Gems Lots subcategories) with product data that
 * already exists in the legacy catalogue export — just filed under
 * different names ("Diamond Deals and Steals" / "Precious gems deals and
 * steals" / "Semi Precious Deals And Steals") — plus the matching dropdown
 * filters (NAME, SHAPE, CUT, COLOR, ORIGIN, SIZE, GRADE, WEIGHT, NUMBER OF
 * STONES, ...) from final_category_filters.csv.
 *
 * Safe to run repeatedly:
 *  - Category/Subcategory are upserted on slug.
 *  - Products are upserted on legacyProductId — re-running only updates
 *    existing docs, never duplicates them. If a product with the same
 *    legacyProductId currently lives in a different category (e.g. it was
 *    previously imported under "Specials > Diamond Specials"), this MOVES
 *    it into Wholesale Lots by overwriting its category/subcategory.
 *  - CategoryFilter rows are upserted on their natural key
 *    (legacyCategoryId, attributeId, filterValueId).
 *
 * Usage:
 *   MONGODB_URI=... node scripts/populate-wholesale-lots.mjs
 *
 * Reads:
 *   - data/products.csv (falls back to src/lib/products.csv)
 *   - data/final_category_filters.csv
 */
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import csv from 'csv-parser';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Next.js convention is `.env.local` for secrets (not the plain `.env`
// dotenv loads by default) — load both, .env.local taking precedence, so
// this works with whichever file the project already keeps MONGODB_URI in.
const envResult = config({ path: path.join(ROOT, '.env') });
const envLocalResult = config({ path: path.join(ROOT, '.env.local'), override: true });

if (process.argv.includes('--debug-env')) {
  console.log('── env debug ──────────────────────────────────────');
  console.log('ROOT:', ROOT);
  console.log('.env      found:', !envResult.error, envResult.error?.code || '');
  console.log('.env.local found:', !envLocalResult.error, envLocalResult.error?.code || '');
  console.log('MONGODB_URI set:', !!process.env.MONGODB_URI, process.env.MONGODB_URI ? `(${process.env.MONGODB_URI.length} chars)` : '');
  console.log('────────────────────────────────────────────────────');
}

const DRY_RUN = process.argv.includes('--dry-run');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI && !DRY_RUN) {
  console.error('❌ MONGODB_URI is not set. Aborting — refusing to run against no database. (Use --dry-run to test CSV parsing without a database.)');
  process.exit(1);
}

const PRODUCTS_CSV_PATH = fs.existsSync(path.join(ROOT, 'data', 'products.csv'))
  ? path.join(ROOT, 'data', 'products.csv')
  : path.join(ROOT, 'src', 'lib', 'products.csv');

const FILTERS_CSV_PATH = path.join(ROOT, 'data', 'final_category_filters.csv');

// ─── Map: legacy subcategory name (in products.csv) → new taxonomy ───────────
const LOT_MAP = {
  'Diamond Deals and Steals': {
    slug: 'diamond-lots',
    name: 'Diamond Lots',
    productKind: 'diamond',
    legacyCategoryId: 194, // matches final_category_filters.csv category_id
  },
  'Precious gems deals and steals': {
    slug: 'precious-gems-lots',
    name: 'Precious Gems Lots',
    productKind: 'gemstone',
    legacyCategoryId: 197,
  },
  'Semi Precious Deals And Steals': {
    slug: 'semi-precious-gems-lots',
    name: 'Semi Precious Gems Lots',
    productKind: 'gemstone',
    legacyCategoryId: 198,
  },
};

// ─── Minimal inline schemas (mirrors src/models/*.ts, same dependency-free
// pattern as scripts/import-category-filters.mjs) ─────────────────────────
const CategorySchema = new mongoose.Schema(
  { name: String, slug: String, description: String, isActive: Boolean, sortOrder: Number },
  { timestamps: true }
);
const SubcategorySchema = new mongoose.Schema(
  {
    name: String, slug: String,
    category: mongoose.Schema.Types.ObjectId,
    description: String, isActive: Boolean,
  },
  { timestamps: true }
);
// strict:false — Product has ~40 real schema fields with enum validators
// (src/models/Product.ts). Re-declaring all of them here would be brittle;
// this script writes the same field names/shapes the real model expects,
// and enum validation only ever runs on save()/validate() (never on plain
// reads), so the live app reads these documents exactly like any other
// product once it loads them through its own Product model.
const ProductSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
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

// ─── Helpers (ported from src/services/fileParser.service.ts so normalized
// shape/color/clarity values match exactly what the rest of the app
// produces for every other bulk-imported product) ─────────────────────────
function clean(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s || s.toUpperCase() === 'NULL' || s.toLowerCase() === 'nan') return '';
  return s;
}
function num(val) {
  const s = clean(val);
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
function bool(val) {
  return clean(val).toLowerCase() === 'true';
}
function splitKeywords(val) {
  const s = clean(val);
  if (!s) return undefined;
  const parts = Array.from(new Set(s.split(',').map((p) => p.trim()).filter(Boolean)));
  return parts.length ? parts : undefined;
}

const SHAPE_KEYWORDS = [
  ['round', ['round']], ['oval', ['oval']], ['cushion', ['cushion']], ['pear', ['pear']],
  ['marquise', ['marquise']], ['octagon', ['octagon']], ['emerald', ['emerald']],
  ['heart', ['heart']], ['princess', ['princess']], ['baguette', ['baguette', 'baggutte']],
  ['trillion', ['trillion']], ['bullet', ['bullet']], ['square', ['square']],
  ['briolette', ['briolette']], ['drop', ['drop']], ['bead', ['bead']], ['nugget', ['nugget']],
  ['barrel', ['barrel']], ['button', ['button']], ['cabochon', ['cabochon', 'sugarloaf']],
  ['kite', ['kite']], ['hexagon', ['hexagon']], ['triangle', ['triangle']],
];
function normalizeShape(raw) {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim();
  for (const [shape, keywords] of SHAPE_KEYWORDS) {
    if (keywords.some((kw) => key.includes(kw))) return shape;
  }
  return 'other';
}

const COLOR_KEYWORDS = [
  ['Padparadscha', ['padparadscha']], ['Canary', ['canary']], ['Champagne', ['champagne']],
  ['Cognac', ['cognac']], ['Paraiba', ['paraiba']], ['Mystic', ['mystic']], ['Rainbow', ['rainbow']],
  ['Multicolor', ['multi', 'fancy color']], ['Smoky', ['smoky', 'smokey']], ['Teal', ['teal']],
  ['Aqua', ['aqua']], ['Peach', ['peach']], ['Grey', ['grey', 'gray']], ['Silver', ['silver']],
  ['Clear', ['clear', 'milky']], ['Violet', ['violet']], ['Purple', ['purple']],
  ['Pink', ['pink', 'rose', 'strawberry']], ['Red', ['red', 'ruby', 'cinnamon']],
  ['Orange', ['orange']], ['Yellow', ['yellow', 'golden']], ['Green', ['green', 'olive', 'evergreen']],
  ['Blue', ['blue']], ['Brown', ['brown']], ['Black', ['black']], ['White', ['white']],
];
function normalizeColor(raw) {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim();
  for (const [color, keywords] of COLOR_KEYWORDS) {
    if (keywords.some((kw) => key.includes(kw))) return color;
  }
  return 'other';
}

function normalizeClarity(raw) {
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
  if (codeMatch) return codeMatch[1];
  return 'other';
}

// Best-effort "number of stones" extraction — no dedicated CSV column, but
// ~500 rows spell it out in the name/description ("15 Pieces...", "5 Pcs
// Lot"), and diamond-melee lots give a per-stone carat range
// (extra_field_38, e.g. "0.01-0.10 ct.") that combined with the total lot
// weight (attributes.caratWeight) yields a reasonable estimate. Left
// undefined (never guessed at) when neither signal is present.
const PIECE_COUNT_RE = /(\d+)\s*(pieces|pcs\b|pc\.|stones\b)/i;
function extractNumberOfStones(row, caratWeight) {
  const text = `${clean(row.name)} ${clean(row.description)}`;
  const m = text.match(PIECE_COUNT_RE);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const perStoneRange = clean(row['additional_attributes.extra_field_38']);
  if (perStoneRange && caratWeight) {
    const nums = perStoneRange.match(/[\d.]+/g)?.map(Number).filter(Number.isFinite);
    if (nums && nums.length) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      if (avg > 0) {
        const estimate = Math.round(caratWeight / avg);
        if (estimate >= 1 && estimate <= 100000) return estimate;
      }
    }
  }
  return undefined;
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

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function isSectionHeader(filterName) {
  return /^<b>.*<\/b>$/i.test(String(filterName ?? '').trim());
}

async function main() {
  if (DRY_RUN) {
    console.log('🧪 DRY RUN — no database connection, no writes. Parsing CSVs only.\n');
  } else {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  }

  // ── 1. Category + 3 Subcategories ─────────────────────────────────────────
  let category;
  const subcategoryDocs = {}; // legacy subcategory name -> Subcategory doc

  if (DRY_RUN) {
    category = { _id: '<wholesale-lots-category-id>' };
    for (const [legacyName, meta] of Object.entries(LOT_MAP)) {
      subcategoryDocs[legacyName] = { _id: `<${meta.slug}-id>` };
    }
  } else {
    category = await Category.findOneAndUpdate(
      { slug: 'wholesale-lots' },
      { $set: { name: 'Wholesale Lots', slug: 'wholesale-lots', isActive: true }, $setOnInsert: { sortOrder: 0 } },
      { upsert: true, new: true }
    );
    console.log(`✅ Category "Wholesale Lots" ready (${category._id})`);

    for (const [legacyName, meta] of Object.entries(LOT_MAP)) {
      const sub = await Subcategory.findOneAndUpdate(
        { slug: meta.slug, category: category._id },
        { $set: { name: meta.name, slug: meta.slug, category: category._id, isActive: true } },
        { upsert: true, new: true }
      );
      subcategoryDocs[legacyName] = sub;
      console.log(`✅ Subcategory "${meta.name}" ready (${sub._id})`);
    }
  }

  // ── 2. Products ────────────────────────────────────────────────────────────
  console.log(`\nReading products CSV: ${PRODUCTS_CSV_PATH}`);
  const productRows = await readCsv(PRODUCTS_CSV_PATH);
  console.log(`  ${productRows.length} rows read`);

  let ops = [];
  let matched = 0;
  let written = 0;
  const BATCH = 500;

  for (const row of productRows) {
    const legacyName = clean(row.subcategory);
    const meta = LOT_MAP[legacyName];
    if (!meta) continue;
    matched++;

    const legacyProductId = num(row.product_id);
    if (legacyProductId === undefined) continue;

    const name = clean(row.name);
    if (!name) continue;

    const priceRaw = num(row.price);
    const price = priceRaw !== undefined ? priceRaw : 0;
    const stockRaw = num(row.quantity);
    const stock = stockRaw !== undefined ? Math.max(0, Math.round(stockRaw)) : 0;

    const statusRaw = clean(row.status);
    const isActive = statusRaw.toLowerCase() !== 'false';

    const matchedPath = clean(row.matched_image_path);
    const images = bool(row.image_matched) && matchedPath
      ? [`/${matchedPath.replace(/^\/+/, '')}`]
      : [];

    const shapeRaw = clean(row['attributes.shape']);
    const colorRaw = clean(row['attributes.color']);
    const clarityRaw = clean(row['attributes.clarity']);
    const gemstoneNameRaw = clean(row['attributes.gemstoneName']);
    const caratWeight = num(row['attributes.caratWeight']);
    const numberOfStones = extractNumberOfStones(row, caratWeight);

    const categoryIdsRaw = clean(row.category_ids);
    const legacyCategoryIdSet = new Set();
    const primaryCategoryId = num(row.category_id);
    if (primaryCategoryId !== undefined) legacyCategoryIdSet.add(Math.round(primaryCategoryId));
    for (const raw of [categoryIdsRaw, clean(row.category_ids_resolved)]) {
      if (!raw) continue;
      const matches = raw.match(/\d+/g);
      if (matches) matches.forEach((m) => legacyCategoryIdSet.add(parseInt(m, 10)));
    }

    const doc = {
      name,
      category: category._id,
      subcategory: subcategoryDocs[legacyName]._id,
      price,
      stock,
      isActive,
      description: clean(row.description) || undefined,
      images,
      productKind: meta.productKind,

      shape: normalizeShape(shapeRaw) ? [normalizeShape(shapeRaw)] : undefined,
      shapeRaw: shapeRaw || undefined,
      size: caratWeight,
      color: normalizeColor(colorRaw) ? [normalizeColor(colorRaw)] : undefined,
      colorRaw: colorRaw || undefined,
      clarity: normalizeClarity(clarityRaw) ? [normalizeClarity(clarityRaw)] : undefined,
      clarityRaw: clarityRaw || undefined,
      gradeRaw: clean(row['attributes.grade']) || undefined,

      approxWeight: clean(row['attributes.caratWeight']) || undefined,
      numberOfStones,
      gemstoneName: gemstoneNameRaw || undefined,
      cutType: clean(row['attributes.cutType']) || undefined,
      luster: clean(row['attributes.luster']) || undefined,
      hardness: clean(row['attributes.hardness']) || undefined,
      treatment: clean(row['attributes.treatment']) || undefined,
      origin: clean(row['attributes.origin']) || undefined,
      caratWeight,
      dimensions: clean(row['attributes.size']) || undefined,

      metaTitle: clean(row['seo.title']) || undefined,
      metaDescription: clean(row['seo.description']) || undefined,
      metaKeywords: splitKeywords(row['seo.keywords']),

      legacyProductId,
      legacySku: clean(row.model) || undefined,
      legacyCategoryId: legacyCategoryIdSet.size ? Array.from(legacyCategoryIdSet) : undefined,

      weight: num(row.weight),
      msrp: num(row.msrp),
      manufacturerId: clean(row.manufacturer_id) || undefined,
      minOrder: num(row.min_order),
      maxOrder: num(row.max_order),
      qtyBlocks: num(row.qty_blocks),
      makeAnOffer: bool(row.make_an_offer),
      parentProductId: num(row.parent_product_id) || undefined,
      subcategory2Raw: clean(row.subcategory_2) || undefined,
      categoryPath: clean(row.category_path) || undefined,

      memoEligible: false,
      reservedForMemo: 0,
    };

    // Strip undefined keys so $set never overwrites an existing value with
    // undefined on repeat runs.
    Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);

    ops.push({
      updateOne: {
        filter: { legacyProductId },
        update: { $set: doc },
        upsert: true,
      },
    });

    if (ops.length >= BATCH) {
      if (!DRY_RUN) {
        const res = await Product.bulkWrite(ops, { ordered: false });
        written += (res.upsertedCount || 0) + (res.modifiedCount || 0);
      } else {
        written += ops.length;
      }
      process.stdout.write(`\r  upserted ${written}/${matched}`);
      ops = [];
    }
  }
  if (ops.length) {
    if (!DRY_RUN) {
      const res = await Product.bulkWrite(ops, { ordered: false });
      written += (res.upsertedCount || 0) + (res.modifiedCount || 0);
    } else {
      written += ops.length;
    }
  }
  console.log(`\n✅ Products: ${matched} lot rows matched, ${written} upserted into Wholesale Lots`);

  // ── 3. CategoryFilter dropdowns (NAME, SHAPE, CUT, COLOR, ORIGIN, SIZE,
  //      GRADE, WEIGHT, NUMBER OF STONES, + a few bonus ones) ────────────────
  console.log(`\nReading filters CSV: ${FILTERS_CSV_PATH}`);
  if (!fs.existsSync(FILTERS_CSV_PATH)) {
    console.warn(`⚠️  ${FILTERS_CSV_PATH} not found — skipping filter import. Filters will be empty until this file is available.`);
  } else {
    const filterRows = await readCsv(FILTERS_CSV_PATH);
    const legacyIdToSubName = Object.fromEntries(
      Object.entries(LOT_MAP).map(([legacyName, meta]) => [meta.legacyCategoryId, legacyName])
    );

    let fOps = [];
    let fMatched = 0;
    let fWritten = 0;
    const FBATCH = 500;

    for (const r of filterRows) {
      const legacyCategoryId = parseInt(r.category_id, 10);
      const subLegacyName = legacyIdToSubName[legacyCategoryId];
      if (!subLegacyName) continue; // not one of our 3 lot categories

      const attributeId = parseInt(r.attribute_id, 10);
      const filterValueId = parseInt(r.filter_value_id, 10);
      const filterName = String(r.filter_name ?? '').trim();
      const filterValue = String(r.filter_value ?? '').trim();
      if (!Number.isFinite(attributeId) || !Number.isFinite(filterValueId) || !filterName) continue;

      fMatched++;
      const sub = subcategoryDocs[subLegacyName];

      fOps.push({
        updateOne: {
          filter: { legacyCategoryId, attributeId, filterValueId },
          update: {
            $set: {
              legacyCategoryId,
              parentId: r.parent_id ? parseInt(r.parent_id, 10) : undefined,
              categoryName: String(r.category_name ?? '').trim(),
              attributeId,
              filterName,
              isSectionHeader: isSectionHeader(filterName),
              filterValueId,
              filterValue,
              filterValueNormalized: normalize(filterValue),
              category: category._id,
              subcategory: sub._id,
            },
          },
          upsert: true,
        },
      });

      if (fOps.length >= FBATCH) {
        if (!DRY_RUN) await CategoryFilter.bulkWrite(fOps, { ordered: false });
        fWritten += fOps.length;
        process.stdout.write(`\r  upserted ${fWritten}/${fMatched}`);
        fOps = [];
      }
    }
    if (fOps.length) {
      if (!DRY_RUN) await CategoryFilter.bulkWrite(fOps, { ordered: false });
      fWritten += fOps.length;
    }
    console.log(`\n✅ CategoryFilter: ${fMatched} rows matched, ${fWritten} upserted for Wholesale Lots`);
  }

  if (!DRY_RUN) await mongoose.disconnect();
  console.log('\n🎉 Done. Visit /products?category=wholesale-lots&subcategory=diamond-lots (and the other two subcategories) to verify.');
}

main().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
