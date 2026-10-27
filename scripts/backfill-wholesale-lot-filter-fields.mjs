/**
 * Fills in the product fields the category filter dropdowns read, for every
 * product in Wholesale Lots and in the three legacy "Deals and Steals"
 * categories they come from.
 *
 * Why: the filters (CUT, TREATMENT, ORIGIN, LUSTER, HARDNESS, GRADE, SIZE,
 * WEIGHT, NUMBER OF STONES, CARAT RANGE, SIZE RANGE — see
 * src/lib/categoryFilterAttributeMap.ts) read top-level fields such as
 * cutType / origin / caratWeight / dimensions. For these products the data
 * was imported only into legacyAttributes (cut, origin, approxWeight,
 * dimensions, …), so those filters had nothing to show. The copies under
 * Wholesale Lots made by populate-wholesale-lots.mjs have no
 * legacyAttributes at all; for those the data is taken from the original
 * product with the same name.
 *
 *   legacyAttributes.cut          → cutType           (CUT)
 *   legacyAttributes.treatment    → treatment         (TREATMENT)
 *   legacyAttributes.luster       → luster            (LUSTER)
 *   legacyAttributes.hardness     → hardness          (HARDNESS)
 *   legacyAttributes.origin       → origin            (ORIGIN)
 *   legacyAttributes.grade        → gradeRaw          (GRADE, CLARITY/GRADE)
 *   legacyAttributes.dimensions   → dimensions        (SIZE)
 *   legacyAttributes.approxWeight → caratWeight       (WEIGHT)  "10 ct." → 10
 *       (falls back to the numeric `size` field, which holds carat weight)
 *   "10 piece" / "5 pcs" in name  → numberOfStones    (NUMBER OF STONES)
 *   legacyAttributes.caratRange   → legacyAttributes["CARAT RANGE"]
 *   legacyAttributes.sizeRange    → legacyAttributes["SIZE RANGE"]
 *
 * Non-destructive: only fills a field that is currently empty. Nothing is
 * overwritten or deleted. Safe to run repeatedly.
 *
 * DRY-RUN by default; pass --commit to write.
 *
 * USAGE (from the project root):
 *   node scripts/backfill-wholesale-lot-filter-fields.mjs
 *   node scripts/backfill-wholesale-lot-filter-fields.mjs --commit
 *
 * Requires MONGODB_URI in environment or .env / .env.local file.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');
const BATCH = 500;

const LEGACY_SOURCE_NAMES = [
  'Diamond Deals and Steals',
  'Precious gems deals and steals',
  'Semi Precious Deals And Steals',
];
const WHOLESALE_CATEGORY_SLUG = 'wholesale-lots';
const SUBCATEGORY_SLUGS = [
  'diamond-lots', 'precious-gems-lots', 'semi-precious-gems-lots',
  'precious-gems-deals-and-steals', 'semi-precious-deals-and-steals',
];

const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
const Subcategory = mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }), 'subcategories');
const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');

const STRING_FIELDS = [
  // [product field, legacyAttributes key]
  ['cutType', 'cut'],
  ['treatment', 'treatment'],
  ['luster', 'luster'],
  ['hardness', 'hardness'],
  ['origin', 'origin'],
  ['gradeRaw', 'grade'],
  ['dimensions', 'dimensions'],
];
const LEGACY_RANGE_FIELDS = [
  // [legacyAttributes key the filter reads, legacyAttributes key with the data]
  ['CARAT RANGE', 'caratRange'],
  ['SIZE RANGE', 'sizeRange'],
];

function isEmpty(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}
function clean(v) {
  if (isEmpty(v)) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.toLowerCase() === 'none' || s.toLowerCase() === 'n/a' ? null : s;
}
function leadingNumber(v) {
  const m = String(v ?? '').match(/\d+(\.\d+)?/);
  const n = m ? parseFloat(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
function stonesFromName(name) {
  const m = String(name ?? '').match(/\b(\d+)\s*(?:pieces?|pcs?\.?)(?=\s|$|\))/i);
  return m ? parseInt(m[1], 10) : null;
}

// Returns the $set object for one product (empty object = nothing to fill).
function buildSet(product, attrs) {
  const set = {};
  if (attrs) {
    for (const [field, key] of STRING_FIELDS) {
      const value = clean(attrs[key]);
      if (value && isEmpty(product[field])) set[field] = value;
    }
    const own = product.legacyAttributes ?? {};
    for (const [target, key] of LEGACY_RANGE_FIELDS) {
      const value = clean(attrs[key]);
      if (value && isEmpty(own[target])) set[`legacyAttributes.${target}`] = value;
    }
  }
  if (isEmpty(product.caratWeight)) {
    const w = leadingNumber(attrs?.approxWeight) ?? (typeof product.size === 'number' && product.size > 0 ? product.size : null);
    if (w) set.caratWeight = w;
  }
  if (isEmpty(product.numberOfStones)) {
    const n = stonesFromName(product.name);
    if (n) set.numberOfStones = n;
  }
  return set;
}

const nameKey = (n) => String(n ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : ' (DRY RUN — pass --commit to write)'}\n`);

  const wholesale = await Category.findOne({ slug: WHOLESALE_CATEGORY_SLUG }).lean();
  const subs = await Subcategory.find({ slug: { $in: SUBCATEGORY_SLUGS } }).lean();
  const subIds = subs.map((s) => s._id);
  console.log(`Wholesale Lots category: ${wholesale ? 'found' : 'NOT FOUND'}`);
  console.log(`Subcategories in scope: ${subs.map((s) => s.name).join(', ') || 'none'}\n`);

  // Donors: original Deals and Steals products, which still carry the
  // legacy attribute data. Keyed by name for products that lack it.
  const donors = await Product.find(
    { 'legacyAttributes.legacyCategoryRaw': { $in: LEGACY_SOURCE_NAMES } },
    { name: 1, legacyAttributes: 1 }
  ).lean();
  const donorByName = new Map();
  for (const d of donors) if (!donorByName.has(nameKey(d.name))) donorByName.set(nameKey(d.name), d.legacyAttributes);
  console.log(`Original Deals and Steals products with attribute data: ${donors.length}`);

  const scope = {
    $or: [
      { 'legacyAttributes.legacyCategoryRaw': { $in: LEGACY_SOURCE_NAMES } },
      ...(wholesale ? [{ category: wholesale._id }] : []),
      ...(subIds.length ? [{ subcategory: { $in: subIds } }, { crossListedSubcategoryIds: { $in: subIds } }] : []),
    ],
  };

  const cursor = Product.find(scope, {
    name: 1, size: 1, legacyAttributes: 1, caratWeight: 1, numberOfStones: 1,
    ...Object.fromEntries(STRING_FIELDS.map(([f]) => [f, 1])),
  }).lean().cursor();

  let scanned = 0, toUpdate = 0, noSource = 0, written = 0;
  const fieldCounts = {};
  let ops = [];
  const flush = async () => {
    if (COMMIT && ops.length) {
      const res = await Product.bulkWrite(ops, { ordered: false });
      written += res.modifiedCount;
    }
    ops = [];
  };

  for await (const p of cursor) {
    scanned++;
    const hasOwn = p.legacyAttributes && Object.keys(p.legacyAttributes).some((k) => !['shippingWeight', 'legacyCategoryRaw', 'CARAT RANGE', 'SIZE RANGE'].includes(k));
    const attrs = hasOwn ? p.legacyAttributes : donorByName.get(nameKey(p.name)) ?? null;
    if (!attrs) noSource++;
    const set = buildSet(p, attrs);
    const keys = Object.keys(set);
    if (!keys.length) continue;
    toUpdate++;
    for (const k of keys) fieldCounts[k] = (fieldCounts[k] ?? 0) + 1;
    ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: set } } });
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  console.log(`\nProducts scanned: ${scanned}`);
  console.log(`Products with fields to fill: ${toUpdate}`);
  if (noSource) console.log(`Products with no attribute data found (only weight/stones can be filled): ${noSource}`);
  console.log('\nFields that will be filled (number of products):');
  for (const [k, n] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${n}`);
  }

  if (COMMIT) console.log(`\n✅ Updated ${written} product(s).`);
  else console.log('\nDry run — nothing written. Re-run with --commit to apply.');
}

main()
  .catch((err) => { console.error('❌ Script failed:', err.message ?? err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
