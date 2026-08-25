/**
 * Import all "Bead Necklaces" products into the live catalog and wire up
 * their filters.
 *
 * Run with:   node scripts/import-bead-necklaces.mjs
 * Requires:   MONGODB_URI in your environment or a .env / .env.local file
 *             (same variable src/lib/db.ts reads).
 *
 * Background
 * ----------
 * src/lib/products.csv already has 348 rows correctly matched to:
 *   category = "Jewelry", subcategory = "Bead Necklaces"
 * split across three legacy sub-groupings (subcategory_2 / legacy
 * category_id):
 *   - "Gemstone Bead Necklace"   (category_id 243, 239 products)
 *   - "Ruby Bead Necklaces"      (category_id 156, 105 products)
 *   - "Sapphire Bead Necklaces"  (category_id 155,   4 products)
 *
 * The Product/Category/Subcategory schema only supports two real taxonomy
 * levels (Category -> Subcategory), same situation as Cocktail Rings
 * earlier — so, same fix: one real "Bead Necklaces" Subcategory under
 * Jewelry, with the three-way split re-surfaced as a filter instead of a
 * third nav level.
 *
 * What this script does
 * ----------------------
 * 1. Finds/creates Category "Jewelry" and Subcategory "Bead Necklaces".
 * 2. Parses src/lib/products.csv (full RFC4180 parser — several columns,
 *    like description/seo.keywords, contain embedded commas) and upserts
 *    all 348 matching rows as products, `subcategory` set to the real
 *    Bead Necklaces id (this is what listProducts()/buildProductFilterQuery
 *    actually filter on) and `subcategory2Raw` set to the specific legacy
 *    grouping name.
 * 3. Adds a **TYPE** filter (new — see the matching edit in
 *    src/lib/categoryFilterAttributeMap.ts, `TYPE -> subcategory2Raw`) with
 *    the three grouping names as selectable values, so a customer can
 *    narrow Bead Necklaces down to just Ruby / Sapphire / Gemstone from a
 *    single listing page — this is the "add proper filter" part of the
 *    request.
 * 4. Copies the real filter definitions that already exist in
 *    final_category_filters.csv for legacy category_id 155 (Sapphire) and
 *    156 (Ruby) — TREATMENT, ORIGIN, WEIGHT, GRADE, ITEM — into
 *    CategoryFilter, scoped to the real Bead Necklaces subcategory (the
 *    stock import-category-filters.mjs script resolves `subcategory` by
 *    matching categoryName text against real Subcategory names, which
 *    fails here since "Sapphire Bead Necklaces" isn't a real Subcategory —
 *    so those rows would otherwise sit with `subcategory: null` and never
 *    surface on this page).
 * 5. category_id 243 (Gemstone Bead Necklace) has NO filter rows in
 *    final_category_filters.csv at all, so a **LENGTH** filter (matching
 *    the legacy site's own filter sidebar) is synthesized from the actual
 *    imported product data — `additional_attributes.extra_field_60` is the
 *    column holding the necklace length ("16 Inch", "20 Inch", …) for
 *    every one of these 239 rows; it's copied into
 *    `product.legacyAttributes.LENGTH` (the key name the LENGTH filter
 *    fallback already expects — see LEGACY_ATTRIBUTE_FALLBACK_FIELDS in
 *    categoryFilterAttributeMap.ts) during import, and the distinct values
 *    become the LENGTH filter's options. SHAPE/COLOR/GRADE/NAME already
 *    have real schema fields (shapeRaw/colorRaw/gradeRaw/gemstoneName) and
 *    are populated the same way; their filter option lists are likewise
 *    synthesized from the distinct values actually present.
 *
 * Idempotent: products upsert on `legacySku`, CategoryFilter rows upsert
 * on their natural key (legacyCategoryId + attributeId + filterValueId) —
 * safe to re-run.
 */

import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from 'dotenv';
config();
config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Set it in your environment, .env, or .env.local file.');
  process.exit(1);
}

const PRODUCTS_CSV_PATH = process.env.PRODUCTS_CSV_PATH || path.join(REPO_ROOT, 'src/lib/products.csv');
const FILTERS_CSV_PATH = process.env.FILTERS_CSV_PATH || path.join(REPO_ROOT, 'final_category_filters.csv');

// ── Target legacy groupings ──────────────────────────────────────────────
const TARGET_TYPES = {
  'Gemstone Bead Necklace': { legacyCategoryId: 243 },
  'Ruby Bead Necklaces': { legacyCategoryId: 156 },
  'Sapphire Bead Necklaces': { legacyCategoryId: 155 },
};

// ── Minimal RFC4180 CSV parser (handles quoted fields, embedded commas,
//    embedded newlines, and "" escaped quotes) — no external dependency. ──
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++; continue;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
    return obj;
  });
}

function clean(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s || s.toUpperCase() === 'NULL' || s.toLowerCase() === 'nan') return '';
  return s;
}
function num(v) {
  const s = clean(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function bool(v) {
  return clean(v).toLowerCase() === 'true';
}
function extractLeadingNumber(raw) {
  const m = String(raw).trim().match(/-?\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : undefined;
}
function deriveSlug(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function normalizeValue(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}
function isSectionHeaderFilterName(raw) {
  return /^<b>.*<\/b>$/i.test(raw.trim());
}

// ── Schemas (mirror the real models closely enough for this import) ─────
const CategorySchema = new mongoose.Schema(
  { name: String, slug: String, isActive: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 } },
  { timestamps: true }
);
const SubcategorySchema = new mongoose.Schema(
  { name: String, slug: String, category: mongoose.Schema.Types.ObjectId, isActive: { type: Boolean, default: true } },
  { timestamps: true }
);
const ProductSchema = new mongoose.Schema(
  {
    name: String, category: mongoose.Schema.Types.ObjectId, subcategory: mongoose.Schema.Types.ObjectId,
    price: Number, productKind: String,
    gemstoneName: String, shapeRaw: String, colorRaw: String, clarityRaw: String, gradeRaw: String,
    cutType: String, luster: String, hardness: String, treatment: String, origin: String,
    caratWeight: Number, dimensions: String,
    images: { type: [String], default: [] }, stock: { type: Number, default: 0 }, isActive: { type: Boolean, default: true },
    description: String,
    weight: Number, msrp: Number, manufacturerId: String, minOrder: Number, maxOrder: Number, qtyBlocks: Number,
    makeAnOffer: { type: Boolean, default: false }, parentProductId: Number,
    subcategory2Raw: String, categoryPath: String,
    metaTitle: String, metaDescription: String, metaKeywords: [String],
    legacyAttributes: mongoose.Schema.Types.Mixed,
    legacyProductId: { type: Number, index: true, sparse: true, unique: true },
    legacySku: String, legacyCategoryId: [Number],
  },
  { timestamps: true }
);
const CategoryFilterSchema = new mongoose.Schema(
  {
    legacyCategoryId: Number, parentId: Number, categoryName: String,
    attributeId: Number, filterName: String, isSectionHeader: { type: Boolean, default: false },
    filterValueId: Number, filterValue: String, filterValueNormalized: String,
    category: mongoose.Schema.Types.ObjectId, subcategory: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);
CategoryFilterSchema.index({ legacyCategoryId: 1, attributeId: 1, filterValueId: 1 }, { unique: true });

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const CategoryFilter = mongoose.models.CategoryFilter || mongoose.model('CategoryFilter', CategoryFilterSchema);

// Synthetic attribute/value ids — real ones from final_category_filters.csv
// top out at attribute_id ~37 and filter_value_id ~10299, so 9000+ /
// 900000+ can never collide.
const TYPE_ATTRIBUTE_ID = 9001;
const LENGTH_ATTRIBUTE_ID = 9002;
const SHAPE_ATTRIBUTE_ID = 9003;
const COLOR_ATTRIBUTE_ID = 9004;
const GRADE_ATTRIBUTE_ID = 9005;
const NAME_ATTRIBUTE_ID = 9006;
let syntheticValueId = 900000;
const nextValueId = () => ++syntheticValueId;

function buildProductDoc(row, categoryId, subcategoryId) {
  const typeName = clean(row.subcategory_2);
  const legacyCategoryIdNum = num(row.category_id);

  const matchedPath = clean(row.matched_image_path);
  const images = bool(row.image_matched) && matchedPath ? [`/${matchedPath.replace(/^\/+/, '')}`] : [];

  const gemstoneNameRaw = clean(row['attributes.gemstoneName']) ||
    // Ruby/Sapphire rows rarely carry their own gemstoneName — the type
    // itself tells us the gem, so fall back to it (strip " Bead Necklace(s)").
    typeName.replace(/\s*Bead Necklaces?$/i, '');

  const caratWeightRaw = clean(row['attributes.caratWeight']);
  const caratWeight = caratWeightRaw ? extractLeadingNumber(caratWeightRaw) : undefined;

  const legacyAttributes = {};
  for (const [key, val] of Object.entries(row)) {
    if (!key.startsWith('additional_attributes.')) continue;
    const v = clean(val);
    if (!v) continue;
    legacyAttributes[key.replace('additional_attributes.', '')] = v;
  }
  // extra_field_60 is confirmed (100% of the 239 Gemstone Bead Necklace
  // rows) to hold the necklace length ("16 Inch", "20 Inch", …). Copy it
  // to the key name the LENGTH filter fallback looks up.
  const lengthRaw = clean(row['additional_attributes.extra_field_60']);
  if (lengthRaw) legacyAttributes.LENGTH = lengthRaw;

  return {
    legacyProductId: num(row.product_id),
    legacySku: clean(row.model),
    name: clean(row.name).replace(/&#39;?s/g, "'s"),
    category: categoryId,
    subcategory: subcategoryId,
    subcategory2Raw: typeName,
    categoryPath: clean(row.category_path) || undefined,
    price: num(row.price) ?? 0,
    msrp: num(row.msrp),
    stock: Math.max(0, Math.round(num(row.quantity) ?? 0)),
    weight: num(row.weight),
    isActive: clean(row.status).toLowerCase() !== 'false',
    manufacturerId: clean(row.manufacturer_id) || undefined,
    minOrder: num(row.min_order),
    maxOrder: num(row.max_order),
    qtyBlocks: num(row.qty_blocks),
    makeAnOffer: bool(row.make_an_offer),
    parentProductId: num(row.parent_product_id) || undefined,
    images,
    description: clean(row.description).replace(/&#39;?s/g, "'s") || undefined,
    metaTitle: clean(row['seo.title']) || undefined,
    metaDescription: clean(row['seo.description']) || undefined,
    metaKeywords: clean(row['seo.keywords']) ? clean(row['seo.keywords']).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    gemstoneName: gemstoneNameRaw || undefined,
    shapeRaw: clean(row['attributes.shape']) || undefined,
    colorRaw: clean(row['attributes.color']) || undefined,
    clarityRaw: clean(row['attributes.clarity']) || undefined,
    gradeRaw: clean(row['attributes.grade']) || undefined,
    cutType: clean(row['attributes.cutType']) || undefined,
    treatment: clean(row['attributes.treatment']) || undefined,
    origin: clean(row['attributes.origin']) || undefined,
    caratWeight,
    dimensions: clean(row['attributes.size']) || undefined,
    productKind: 'gemstone',
    legacyCategoryId: legacyCategoryIdNum ? [legacyCategoryIdNum] : undefined,
    legacyAttributes: Object.keys(legacyAttributes).length ? legacyAttributes : undefined,
  };
}

async function upsertFilterValue({ legacyCategoryId, parentId, categoryName, attributeId, filterName, filterValue, category, subcategory, isSectionHeader = false }) {
  const filterValueId = nextValueId();
  await CategoryFilter.findOneAndUpdate(
    { legacyCategoryId, attributeId, filterValueId },
    {
      $set: {
        legacyCategoryId, parentId, categoryName, attributeId, filterName,
        isSectionHeader, filterValueId, filterValue,
        filterValueNormalized: normalizeValue(filterValue),
        category, subcategory,
      },
    },
    { upsert: true }
  );
}

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  // ── 1. Resolve/create Category: Jewelry ──────────────────────────────
  const categoryName = 'Jewelry';
  const categorySlug = deriveSlug(categoryName);
  let category = await Category.findOne({ $or: [{ name: new RegExp(`^${categoryName}$`, 'i') }, { slug: categorySlug }] });
  if (!category) {
    category = await Category.create({ name: categoryName, slug: categorySlug, isActive: true });
    console.log(`Created Category "${categoryName}"`);
  } else {
    console.log(`Found Category "${category.name}" (${category._id})`);
  }

  // ── 2. Resolve/create Subcategory: Bead Necklaces ────────────────────
  const subcategoryName = 'Bead Necklaces';
  const subcategorySlug = deriveSlug(subcategoryName);
  let subcategory = await Subcategory.findOne({
    category: category._id,
    $or: [{ name: new RegExp(`^${subcategoryName}$`, 'i') }, { slug: subcategorySlug }],
  });
  if (!subcategory) {
    subcategory = await Subcategory.create({ name: subcategoryName, slug: subcategorySlug, category: category._id, isActive: true });
    console.log(`Created Subcategory "${subcategoryName}" (slug: ${subcategorySlug})`);
  } else {
    console.log(`Found Subcategory "${subcategory.name}" (${subcategory._id}, slug: ${subcategory.slug})`);
  }

  // ── 3. Parse products.csv and upsert matching rows ───────────────────
  console.log(`\nReading ${PRODUCTS_CSV_PATH} …`);
  const productRows = csvToObjects(readFileSync(PRODUCTS_CSV_PATH, 'utf-8'));
  const beadRows = productRows.filter((r) => TARGET_TYPES[clean(r.subcategory_2)]);
  console.log(`Found ${beadRows.length} bead necklace rows in CSV.`);

  let created = 0, updated = 0, skipped = 0;
  const distinctByType = {
    'Gemstone Bead Necklace': { shape: new Set(), color: new Set(), grade: new Set(), name: new Set(), length: new Set() },
  };

  for (const row of beadRows) {
    const sku = clean(row.model);
    if (!sku) { skipped++; continue; }
    const doc = buildProductDoc(row, category._id, subcategory._id);

    const result = await Product.findOneAndUpdate(
      { legacySku: sku },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    );
    if (result.lastErrorObject?.updatedExisting) updated++; else created++;

    // Collect distinct filter option values for the Gemstone group (no
    // pre-existing filter definitions for legacyCategoryId 243).
    const typeName = clean(row.subcategory_2);
    if (typeName === 'Gemstone Bead Necklace') {
      const d = distinctByType['Gemstone Bead Necklace'];
      if (doc.shapeRaw) d.shape.add(doc.shapeRaw);
      if (doc.colorRaw) d.color.add(doc.colorRaw);
      if (doc.gradeRaw) d.grade.add(doc.gradeRaw);
      if (doc.gemstoneName) d.name.add(doc.gemstoneName);
      if (doc.legacyAttributes?.LENGTH) d.length.add(doc.legacyAttributes.LENGTH);
    }
  }
  console.log(`Products: ${created} created, ${updated} updated, ${skipped} skipped (no SKU).`);

  // ── 4. TYPE filter — lets the customer pick between the 3 groupings ──
  console.log('\nWriting TYPE filter (Gemstone / Ruby / Sapphire)…');
  for (const [typeName, { legacyCategoryId }] of Object.entries(TARGET_TYPES)) {
    await upsertFilterValue({
      legacyCategoryId: 154, // parent "Bead Necklaces" legacy id, shared by all three
      parentId: undefined,
      categoryName: 'Bead Necklaces',
      attributeId: TYPE_ATTRIBUTE_ID,
      filterName: 'TYPE',
      filterValue: typeName,
      category: category._id,
      subcategory: subcategory._id,
    });
  }

  // ── 5. Copy real filter defs for Sapphire (155) / Ruby (156) from
  //      final_category_filters.csv, scoped to the real subcategory ────
  console.log(`Reading ${FILTERS_CSV_PATH} …`);
  const filterRows = csvToObjects(readFileSync(FILTERS_CSV_PATH, 'utf-8'));
  let filterRowsCopied = 0;
  for (const fr of filterRows) {
    const legacyCategoryId = num(fr.category_id);
    if (legacyCategoryId !== 155 && legacyCategoryId !== 156) continue;
    const filterName = clean(fr.filter_name);
    if (isSectionHeaderFilterName(filterName)) continue;
    const filterValue = clean(fr.filter_value);
    if (!filterValue) continue;

    const filterValueId = num(fr.filter_value_id);
    await CategoryFilter.findOneAndUpdate(
      { legacyCategoryId, attributeId: num(fr.attribute_id), filterValueId },
      {
        $set: {
          legacyCategoryId,
          parentId: num(fr.parent_id),
          categoryName: clean(fr.category_name),
          attributeId: num(fr.attribute_id),
          filterName,
          isSectionHeader: false,
          filterValueId,
          filterValue,
          filterValueNormalized: normalizeValue(filterValue),
          category: category._id,
          subcategory: subcategory._id, // ← the fix: point at the real Bead Necklaces doc
        },
      },
      { upsert: true }
    );
    filterRowsCopied++;
  }
  console.log(`Copied ${filterRowsCopied} existing Sapphire/Ruby filter rows (TREATMENT/ORIGIN/WEIGHT/GRADE/ITEM), rescoped to Bead Necklaces.`);

  // ── 6. Synthesize LENGTH/SHAPE/COLOR/GRADE/NAME filters for Gemstone
  //      Bead Necklace (243) — no rows for it in final_category_filters.csv
  console.log('Writing synthesized filters for Gemstone Bead Necklace (LENGTH/SHAPE/COLOR/GRADE/NAME)…');
  const d = distinctByType['Gemstone Bead Necklace'];
  const synthGroups = [
    { attributeId: LENGTH_ATTRIBUTE_ID, filterName: 'LENGTH', values: d.length },
    { attributeId: SHAPE_ATTRIBUTE_ID, filterName: 'SHAPE', values: d.shape },
    { attributeId: COLOR_ATTRIBUTE_ID, filterName: 'COLOR', values: d.color },
    { attributeId: GRADE_ATTRIBUTE_ID, filterName: 'GRADE', values: d.grade },
    { attributeId: NAME_ATTRIBUTE_ID, filterName: 'NAME', values: d.name },
  ];
  let synthesized = 0;
  for (const g of synthGroups) {
    for (const value of g.values) {
      await upsertFilterValue({
        legacyCategoryId: 243,
        parentId: 154,
        categoryName: 'Gemstone Bead Necklace',
        attributeId: g.attributeId,
        filterName: g.filterName,
        filterValue: value,
        category: category._id,
        subcategory: subcategory._id,
      });
      synthesized++;
    }
  }
  console.log(`Wrote ${synthesized} synthesized filter values.`);

  console.log('\n✅ Done.');
  console.log(`   Bead Necklaces subcategory: ${subcategory._id}`);
  console.log('   Check: /products?category=jewelry&subcategory=bead-necklace');
  console.log('   Filters available: TYPE (all), TREATMENT/ORIGIN/WEIGHT/GRADE/ITEM (Ruby+Sapphire), LENGTH/SHAPE/COLOR/GRADE/NAME (Gemstone).');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Import failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
