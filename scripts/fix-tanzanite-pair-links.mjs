/**
 * Relinks the Tanzanite "pair" products (matched mm-sized pairs, e.g.
 * "11x9 mm Oval Pair Tanzanite in AAA Grade") to their correct
 * subSubcategory: Calibrated Tanzanite or Emerald Cut Tanzanite.
 *
 * Root cause: the taxonomy keyword-matcher's `Calibrated ${suffix}` child
 * only matches products whose name literally contains the word
 * "calibrated" — which these pair products never do. Because children are
 * matched top-to-bottom and claimed exclusively, every one of these fell
 * through to whichever shape word (Oval, Trillion, etc.) appeared in its
 * name and got claimed by that shape bucket instead, even though it's a
 * structurally distinct product line (matched pairs, sized in mm) from the
 * single carat-weight stones that actually belong in the shape categories.
 *
 * import-scraped-products.mjs confirmed all 424 Calibrated Tanzanite + 1
 * Emerald Cut Tanzanite scraped items already exist in the DB by
 * legacyProductId (0 created, 581/581 already existing) — so this is a
 * pure relink, not an import. Unlike fix-safe-subsubcategory-links.mjs,
 * this script WILL move products out of whatever subSubcategory they're
 * currently (wrongly) sitting in, since that's the whole point here.
 *
 * DRY-RUN by default. Pass --commit to actually write.
 *
 * USAGE:
 *   node scripts/fix-tanzanite-pair-links.mjs
 *   node scripts/fix-tanzanite-pair-links.mjs --commit
 */

import fs from 'node:fs';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');
const SCRAPED_FILE = 'scripts/output/scraped-products.json';

if (!fs.existsSync(SCRAPED_FILE)) {
  console.error(`❌ ${SCRAPED_FILE} not found — run scrape-missing-products.mjs first.`);
  process.exit(1);
}

// Only these subSubcategory names are touched by this script.
const TARGETS = new Set(['Calibrated Tanzanite', 'Emerald Cut Tanzanite']);

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  const scraped = JSON.parse(fs.readFileSync(SCRAPED_FILE, 'utf-8'));
  const targets = scraped.filter((item) => TARGETS.has(item.subSubcategory));
  console.log(`Loaded ${scraped.length} scraped item(s), ${targets.length} in the Tanzanite-pair fix scope.\n`);

  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}\n`);

  const subSubDocs = new Map();
  for (const name of TARGETS) {
    const doc = await SubSubcategory.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (!doc) {
      console.log(`⚠️  SubSubcategory "${name}" not found in DB — items for it will be skipped.`);
    }
    subSubDocs.set(name, doc || null);
  }

  let fixed = 0, alreadyCorrect = 0, notFoundInDb = 0, noTaxonomyDoc = 0;
  const movedFrom = new Map(); // old subSubcategory id -> count, for a summary of where these were hiding

  for (const item of targets) {
    const targetDoc = subSubDocs.get(item.subSubcategory);
    if (!targetDoc) {
      noTaxonomyDoc++;
      continue;
    }

    const legacyId = Number(item.legacyProductId);
    if (!Number.isFinite(legacyId)) {
      console.log(`   [${item.legacyProductId}] unparseable legacyProductId — skipping "${item.name}"`);
      notFoundInDb++;
      continue;
    }

    const product = await Product.findOne({ legacyProductId: legacyId }).lean();
    if (!product) {
      notFoundInDb++;
      console.log(`   [${legacyId}] not in DB at all — "${item.name}"`);
      continue;
    }

    if (String(product.subSubcategory) === String(targetDoc._id)) {
      alreadyCorrect++;
      continue;
    }

    const fromKey = product.subSubcategory ? String(product.subSubcategory) : '(none)';
    movedFrom.set(fromKey, (movedFrom.get(fromKey) || 0) + 1);

    if (COMMIT) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            subSubcategory: targetDoc._id,
            subcategory2Raw: targetDoc.name,
            category: targetDoc.category,
            subcategory: targetDoc.subcategory,
          },
        }
      );
    }
    fixed++;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Products ${COMMIT ? 'fixed' : 'that would be fixed'}: ${fixed}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Not found in DB: ${notFoundInDb}`);
  console.log(`Skipped (target subSubcategory missing from taxonomy): ${noTaxonomyDoc}`);

  if (movedFrom.size > 0) {
    console.log('\nMoved FROM (previous subSubcategory ObjectId → count):');
    for (const [from, count] of movedFrom.entries()) {
      console.log(`   ${from}: ${count}`);
    }
    console.log('(Cross-check these ids against your shape subSubcategory docs to confirm');
    console.log(' they match Oval/Trillion/etc. — that\'s the expected source of the mix-up.)');
  }

  if (!COMMIT) {
    console.log('\nThis was a dry run. Re-run with --commit to actually write.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});