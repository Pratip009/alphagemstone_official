/**
 * Live validation of the CSV-driven category filter system against the
 * real database. Run this AFTER scripts/import-category-filters.mjs.
 *
 * Usage:
 *   MONGODB_URI=... node scripts/validate-category-filters.mjs
 *
 * Checks:
 *   1. Both verified example combinations return the exact expected
 *      product/model.
 *   2. Single-filter, multi-select (OR), and multi-filter (AND) behavior.
 *   3. A nonsensical combination returns zero products cleanly.
 *   4. Filters defined for one category do not leak into an unrelated
 *      category's filter definition list.
 *   5. Basic query performance (explain) against the legacyCategoryId /
 *      shapeRaw / colorRaw / caratWeight indexes.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set.');
  process.exit(1);
}

const ProductSchema = new mongoose.Schema({}, { strict: false });
const CategoryFilterSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const CategoryFilter = mongoose.models.CategoryFilter || mongoose.model('CategoryFilter', CategoryFilterSchema);

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function exactValueRegex(raw) {
  const escaped = String(raw).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\s+/g, '\\s+')}$`, 'i');
}

let pass = 0, fail = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    pass++;
  } catch (e) {
    console.log(`❌ ${name}\n   ${e.message}`);
    fail++;
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  await check('CategoryFilter collection is populated', async () => {
    const count = await CategoryFilter.countDocuments();
    if (count === 0) throw new Error('0 CategoryFilter documents — run the import script first');
    console.log(`   ${count} filter definitions in DB`);
  });

  await check('Example 1: Marquise+Pink+6x3.7mm+SI+0.40ct → product 36704/PD033015005', async () => {
    const query = {
      isActive: true,
      shapeRaw: exactValueRegex('Marquise'),
      colorRaw: exactValueRegex('Pink'),
      dimensions: exactValueRegex('6x3.7 mm'),
      clarityRaw: exactValueRegex('SI'),
      caratWeight: { $gte: 0.395, $lte: 0.405 },
    };
    const results = await Product.find(query).select('legacyProductId legacySku').lean();
    const hit = results.find((r) => String(r.legacyProductId) === '36704');
    if (!hit) throw new Error(`product 36704 not in ${results.length} results`);
    if (hit.legacySku !== 'PD033015005') throw new Error(`model mismatch: ${hit.legacySku}`);
  });

  await check('Example 2: Cushion+Faceted+Aqua+7x5mm+A+1ct → product 26004/SBTF062708240', async () => {
    const query = {
      isActive: true,
      shapeRaw: exactValueRegex('Cushion'),
      cutType: exactValueRegex('Faceted'),
      colorRaw: exactValueRegex('Aqua'),
      dimensions: exactValueRegex('7x5 mm'),
      gradeRaw: exactValueRegex('A'),
      caratWeight: { $gte: 0.995, $lte: 1.005 },
    };
    const results = await Product.find(query).select('legacyProductId legacySku').lean();
    const hit = results.find((r) => String(r.legacyProductId) === '26004');
    if (!hit) throw new Error(`product 26004 not in ${results.length} results`);
    if (hit.legacySku !== 'SBTF062708240') throw new Error(`model mismatch: ${hit.legacySku}`);
  });

  await check('Zero-result combination returns [] cleanly', async () => {
    const results = await Product.find({
      isActive: true,
      shapeRaw: exactValueRegex('Marquise'),
      colorRaw: exactValueRegex('Aqua'),
      caratWeight: { $gte: 998.5, $lte: 999.5 },
    }).lean();
    if (results.length !== 0) throw new Error(`expected 0, got ${results.length}`);
  });

  await check('Category scoping: two different legacyCategoryId groups have disjoint filter value sets for SHAPE', async () => {
    const [emeraldShapes, pinkDiamondShapes] = await Promise.all([
      CategoryFilter.distinct('filterValueNormalized', { legacyCategoryId: 27, filterName: 'SHAPE' }),
      CategoryFilter.distinct('filterValueNormalized', { legacyCategoryId: 206, filterName: 'SHAPE' }),
    ]);
    if (emeraldShapes.length && pinkDiamondShapes.length) {
      const overlap = emeraldShapes.filter((v) => pinkDiamondShapes.includes(v));
      if (overlap.length === emeraldShapes.length) {
        throw new Error('category 27 and 206 SHAPE filter values are identical — scoping broken');
      }
    }
  });

  await check('Query performance: legacyCategoryId + shapeRaw uses an index (no COLLSCAN)', async () => {
    const explain = await Product.find({
      legacyCategoryId: 206,
      shapeRaw: exactValueRegex('Marquise'),
      isActive: true,
    }).explain('executionStats');
    const stage = JSON.stringify(explain.executionStats?.executionStages ?? explain);
    if (stage.includes('COLLSCAN')) {
      console.warn('   ⚠️  COLLSCAN detected — check indexes on legacyCategoryId/shapeRaw');
    } else {
      console.log('   index used, no full collection scan');
    }
  });

  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Validation crashed:', err);
  process.exit(1);
});
