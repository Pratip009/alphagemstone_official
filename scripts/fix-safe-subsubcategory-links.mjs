/**
 * Fixes subSubcategory linkage for products in the confirmed-safe groups
 * identified by diagnose-subsubcategory-mismatch.mjs and
 * diagnose-specific-categories.mjs:
 *
 *   - Diamond Earring Bargains, Diamond Fashion Pendants, Cocktail Rings:
 *     categoryPath/subcategory2Raw already correct, subSubcategory field
 *     just never got set.
 *   - Bridal Rings, Right Hand Rings, Tanzanite Earrings:
 *     categoryPath lost the third level entirely during the original
 *     import; corrected here using the exact legacyProductIds already
 *     scraped from the live legacy site.
 *
 * Deliberately EXCLUDES Bridal Diamond Rings (ambiguous cross-listing —
 * categoryPath says "Engagement Solitaire Rings") and all Tanzanite shape
 * categories (Calibrated Tanzanite vs. per-shape taxonomy — pending a
 * product decision). Do not add those here without instruction.
 *
 * DRY-RUN by default. Pass --commit to actually write.
 *
 * USAGE:
 *   node scripts/fix-safe-subsubcategory-links.mjs
 *   node scripts/fix-safe-subsubcategory-links.mjs --commit
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
const SAFE_TARGETS = new Set([
  'Bridal Rings',
  'Right Hand Rings',
  'Tanzanite Earrings',
  'Diamond Earring Bargains',
  'Diamond Fashion Pendants',
  'Cocktail Rings',
]);

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  const scraped = JSON.parse(fs.readFileSync(SCRAPED_FILE, 'utf-8'));
  const targets = scraped.filter((item) => SAFE_TARGETS.has(item.subSubcategory));
  console.log(`Loaded ${scraped.length} scraped item(s), ${targets.length} in the safe-fix scope.\n`);

  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}\n`);

  // Resolve each target subSubcategory name to its doc once.
  const subSubDocs = new Map();
  for (const name of SAFE_TARGETS) {
    const doc = await SubSubcategory.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
    if (!doc) {
      console.log(`⚠️  SubSubcategory "${name}" not found in DB — items for it will be skipped.`);
    }
    subSubDocs.set(name, doc || null);
  }

  let fixed = 0, alreadyCorrect = 0, notFoundInDb = 0, noTaxonomyDoc = 0;

  for (const item of targets) {
    const targetDoc = subSubDocs.get(item.subSubcategory);
    if (!targetDoc) {
      noTaxonomyDoc++;
      continue;
    }

    const product = await Product.findOne({ legacyProductId: item.legacyProductId }).lean();
    if (!product) {
      notFoundInDb++;
      console.log(`   [${item.legacyProductId}] not in DB at all — "${item.name}"`);
      continue;
    }

    if (String(product.subSubcategory) === String(targetDoc._id)) {
      alreadyCorrect++;
      continue;
    }

    console.log(
      `   [${item.legacyProductId}] "${product.name}"  —  ` +
      `subSubcategory ${product.subSubcategory ? '(wrong: ' + product.subSubcategory + ')' : '(missing)'} → ${targetDoc.name} (${targetDoc._id})`
    );

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
  console.log(`Not found in DB (would need scraping/creating): ${notFoundInDb}`);
  console.log(`Skipped (target subSubcategory missing from taxonomy): ${noTaxonomyDoc}`);
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
