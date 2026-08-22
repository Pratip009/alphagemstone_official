/**
 * Backfill script — run with: node scripts/backfill-simple-filter-fields.mjs
 * Requires MONGODB_URI in environment or .env / .env.local file.
 *
 * Why this exists
 * ----------------
 * The /products "Simple Filter" bar (Shape / Size / Color / Clarity /
 * Approx Weight / Number Of Stones) reads its dropdown options straight off
 * product.shape / .size / .color / .clarity / .approxWeight / .numberOfStones.
 * Verified against the live `gemstone-shop` DB (18,514 active products) and
 * the source CSV (`products_with_matched_categories_cleaned.csv`):
 *
 *   - shape / size / color / clarity : already populated and working for
 *     the bulk of the catalogue. Not the reason those dropdowns were empty.
 *   - clarity coverage can still roughly DOUBLE though (~4k -> ~9.4k rows).
 *     `attributes.clarity` in the CSV only covers diamonds. Gemstone
 *     clarity/quality-grade text ("VS1/SI1", "Opaque", "Eye Clean", "AAA",
 *     "Commercial"...) ships in the same export under an unlabeled column,
 *     `additional_attributes.extra_field_6` — it landed in
 *     legacyAttributes.extra_field_6 on import and was never read as
 *     clarity. Now mapped for future imports (fileParser.service.ts) and
 *     backfilled here for existing docs.
 *   - numberOfStones: 0% populated. No column in the CSV is labeled "number
 *     of stones", but additional_attributes.extra_field_15 holds exactly
 *     that ("10 piece", "5 piece", "1", "2"...) for ~3.6k rows — same
 *     unlabeled-column situation as clarity above. Backfilled from
 *     legacyAttributes.extra_field_15 (leading integer extracted).
 *   - approxWeight: 0% populated, and legacyAttributes.approxWeight is ALSO
 *     0% on this DB (that source existed in an older backup file, not this
 *     one — false lead, ignore). The real, already-populated source is the
 *     numeric `size` field itself (77% filled from attributes.caratWeight
 *     on import) — approxWeight is backfilled as `"<size> ct"` text so the
 *     dropdown has real values without needing a CSV re-import.
 *
 * This script is idempotent and non-destructive: it only ever fills in a
 * field that is currently empty/missing, using data already on the
 * document. Nothing existing is overwritten or deleted.
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
  console.error('MONGODB_URI is not set (env, .env, or .env.local). Aborting.');
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
// the field is stored as a bare value or an array.
function isEmpty(val) {
  if (val === undefined || val === null || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to db:', mongoose.connection.name);

  const totalProducts = await Product.countDocuments({});
  console.log('Total products:', totalProducts);
  if (totalProducts === 0) {
    console.error('0 documents found — check MONGODB_URI db name / collection name.');
    await mongoose.disconnect();
    return;
  }

  const stats = {
    scanned: 0,
    updated: 0,
    colorSet: 0,
    claritySet: 0,
    clarityFromExtraField6: 0,
    approxWeightSet: 0,
    numberOfStonesSet: 0,
  };

  const cursor = Product.find({}).cursor();
  let bulkOps = [];
  const BATCH_SIZE = 500;

  async function flush() {
    if (bulkOps.length === 0) return;
    await Product.bulkWrite(bulkOps, { ordered: false });
    bulkOps = [];
  }

  for await (const doc of cursor) {
    stats.scanned++;
    const update = {};
    const legacy = doc.legacyAttributes || {};

    // color: from colorRaw, if missing
    if (isEmpty(doc.color) && !isEmpty(doc.colorRaw)) {
      const c = normalizeColor(doc.colorRaw);
      if (c) { update.color = [c]; stats.colorSet++; }
    }

    // clarity: prefer colorRaw's sibling clarityRaw; fall back to the
    // unlabeled extra_field_6 column that also carries clarity/grade text
    // for gemstones (see header comment).
    if (isEmpty(doc.clarity)) {
      let clarityRaw = doc.clarityRaw;
      let fromExtra = false;
      if (isEmpty(clarityRaw) && !isEmpty(legacy.extra_field_6)) {
        clarityRaw = legacy.extra_field_6;
        fromExtra = true;
      }
      if (!isEmpty(clarityRaw)) {
        const c = normalizeClarity(clarityRaw);
        if (c) {
          update.clarity = [c];
          stats.claritySet++;
          if (fromExtra) {
            stats.clarityFromExtraField6++;
            if (isEmpty(doc.clarityRaw)) update.clarityRaw = clarityRaw;
          }
        }
      }
    }

    // approxWeight: derive display text from the already-populated numeric
    // `size` field (legacyAttributes.approxWeight is empty on this DB).
    if (isEmpty(doc.approxWeight) && !isEmpty(doc.size)) {
      update.approxWeight = `${doc.size} ct`;
      stats.approxWeightSet++;
    }

    // numberOfStones: from the unlabeled extra_field_15 column
    // ("10 piece", "5 piece", "1", "2"...).
    if (isEmpty(doc.numberOfStones) && !isEmpty(legacy.extra_field_15)) {
      const match = String(legacy.extra_field_15).match(/\d+/);
      if (match) {
        update.numberOfStones = Number(match[0]);
        stats.numberOfStonesSet++;
      }
    }

    if (Object.keys(update).length > 0) {
      bulkOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: update } } });
      stats.updated++;
    }

    if (bulkOps.length >= BATCH_SIZE) await flush();

    if (stats.scanned % 2000 === 0) {
      console.log(`...scanned ${stats.scanned}, updated ${stats.updated} so far`);
    }
  }

  await flush();

  console.log('\n--- Results ---');
  console.log('Scanned:', stats.scanned);
  console.log('Documents updated:', stats.updated);
  console.log('color backfilled:', stats.colorSet);
  console.log('clarity backfilled:', stats.claritySet, `(of which ${stats.clarityFromExtraField6} came from extra_field_6)`);
  console.log('approxWeight backfilled:', stats.approxWeightSet);
  console.log('numberOfStones backfilled:', stats.numberOfStonesSet);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
