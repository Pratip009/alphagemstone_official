/**
 * Backfill script — run with: node scripts/backfill-simple-filter-fields.mjs
 * Requires MONGODB_URI in environment or .env file.
 *
 * Why this exists
 * ----------------
 * The /products "Simple Filter" bar (Shape / Size / Color / Clarity /
 * Approx Weight / Number Of Stones) reads its dropdown options from the
 * product.color / product.clarity / product.approxWeight / product.numberOfStones
 * fields. Auditing the current catalogue shows:
 *
 *   - shape / size  : populated on ~85% of diamonds & gemstones (fine)
 *   - color         : 0% populated, even though colorRaw has data on ~66%
 *                     of diamonds — the normalization step that turns
 *                     colorRaw -> color was never run against this data
 *   - clarity       : same story, ~75% of diamonds have clarityRaw but 0%
 *                     have clarity
 *   - approxWeight  : 0% populated on the `approxWeight` field itself, but
 *                     ~50% of diamonds DO have the raw text sitting in
 *                     legacyAttributes.approxWeight (a parser bug shoved it
 *                     into the generic legacy bag instead of the real field
 *                     — now fixed in fileParser.service.ts for future
 *                     imports; this script backfills existing rows)
 *   - numberOfStones: 0% populated and there is no raw source column for it
 *                     anywhere in the CSV imports — this field has only ever
 *                     been set by hand via the admin product editor, so it
 *                     is NOT backfilled here. Either enter it per-product in
 *                     admin, or drop that dropdown from the filter bar until
 *                     real data exists for it.
 *
 * This script is idempotent and non-destructive: it only ever fills in a
 * field that is currently empty/missing, using data that is already on the
 * document (colorRaw, clarityRaw, legacyAttributes.approxWeight). Nothing
 * is overwritten or deleted.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
// dotenv's default config() only reads a file literally named `.env` — it
// will NOT pick up `.env.local`. Load both, `.env.local` second so it can
// override `.env` if both happen to exist (mirrors Next.js's own precedence).
config({ path: '.env' });
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set (env or .env file). Aborting.');
  process.exit(1);
}

// ── Same keyword buckets as src/lib/productAttributes.ts / fileParser.service.ts ──
// Duplicated here (rather than imported) because this is a plain .mjs script
// run outside the Next/TS build. Keep these two lists in sync if the buckets
// in src/lib/productAttributes.ts ever change.
const COLOR_KEYWORDS = [
  ['Padparadscha', ['padparadscha']],
  ['Canary', ['canary']],
  ['Champagne', ['champagne']],
  ['Cognac', ['cognac']],
  ['Paraiba', ['paraiba']],
  ['Mystic', ['mystic']],
  ['Rainbow', ['rainbow']],
  ['Multicolor', ['multi', 'fancy color']],
  ['Smoky', ['smoky', 'smokey']],
  ['Teal', ['teal']],
  ['Aqua', ['aqua']],
  ['Peach', ['peach']],
  ['Grey', ['grey', 'gray']],
  ['Silver', ['silver']],
  ['Clear', ['clear', 'milky']],
  ['Violet', ['violet']],
  ['Purple', ['purple']],
  ['Pink', ['pink', 'rose', 'strawberry']],
  ['Red', ['red', 'ruby', 'cinnamon']],
  ['Orange', ['orange']],
  ['Yellow', ['yellow', 'golden']],
  ['Green', ['green', 'olive', 'evergreen']],
  ['Blue', ['blue']],
  ['Brown', ['brown']],
  ['Black', ['black']],
  ['White', ['white']],
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

// Minimal schema — strict:false so we can read/write legacyAttributes and
// any other field without redeclaring the full Product model here.
const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// Treats missing, null, '', and [] all as "empty" — regardless of whether
// the field is stored as a bare value or an array (schema says array, but
// we don't trust that every doc in the wild actually matches the schema).
function isEmpty(val) {
  if (val === undefined || val === null || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to db:', mongoose.connection.name);

  const totalProducts = await Product.countDocuments({});
  const withColorRaw = await Product.countDocuments({ colorRaw: { $exists: true, $nin: [null, ''] } });
  const withClarityRaw = await Product.countDocuments({ clarityRaw: { $exists: true, $nin: [null, ''] } });
  const withLegacyApproxWeight = await Product.countDocuments({ 'legacyAttributes.approxWeight': { $exists: true, $nin: [null, ''] } });
  console.log('--- Diagnostics ---');
  console.log('Total products in collection:', totalProducts);
  console.log('Products with colorRaw set:', withColorRaw);
  console.log('Products with clarityRaw set:', withClarityRaw);
  console.log('Products with legacyAttributes.approxWeight set:', withLegacyApproxWeight);
  console.log('-------------------');

  if (totalProducts === 0) {
    console.error(
      'This connection sees 0 documents in the "products" collection. ' +
      'Check the db name in MONGODB_URI (currently: ' + mongoose.connection.name + ') ' +
      'and confirm the collection is actually called "products".'
    );
    await mongoose.disconnect();
    return;
  }

  const stats = { colorSet: 0, claritySet: 0, approxWeightSet: 0, scanned: 0, updated: 0 };

  // Deliberately scans every product rather than pre-filtering server-side
  // (a previous version's $in-based filter query matched 0 docs — array
  // fields + null/[]/undefined in $in don't combine reliably across driver
  // versions). Scanning ~30k docs and deciding in JS is slower but correct.
  const cursor = Product.find({}).cursor();

  for await (const doc of cursor) {
    stats.scanned++;
    const update = {};

    if (isEmpty(doc.color) && !isEmpty(doc.colorRaw)) {
      const c = normalizeColor(doc.colorRaw);
      if (c) { update.color = [c]; stats.colorSet++; }
    }

    if (isEmpty(doc.clarity) && !isEmpty(doc.clarityRaw)) {
      const c = normalizeClarity(doc.clarityRaw);
      if (c) { update.clarity = [c]; stats.claritySet++; }
    }

    const legacyApproxWeight = doc.legacyAttributes?.approxWeight ?? doc.legacyAttributes?.get?.('approxWeight');
    if (isEmpty(doc.approxWeight) && !isEmpty(legacyApproxWeight)) {
      update.approxWeight = legacyApproxWeight;
      stats.approxWeightSet++;
    }

    if (Object.keys(update).length > 0) {
      await Product.updateOne({ _id: doc._id }, { $set: update });
      stats.updated++;
    }
  }

  console.log('Scanned:', stats.scanned);
  console.log('Documents updated:', stats.updated);
  console.log('color backfilled:', stats.colorSet);
  console.log('clarity backfilled:', stats.claritySet);
  console.log('approxWeight backfilled:', stats.approxWeightSet);
  console.log('\nNote: numberOfStones was NOT touched — there is no raw source data for it in the current catalogue.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
