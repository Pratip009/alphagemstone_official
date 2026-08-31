/**
 * Targeted follow-up to diagnose-subsubcategory-mismatch.mjs.
 *
 * Takes the known legacyProductIds for the 7 originally-"empty" categories
 * that did NOT show up in the general mismatch scan (Bridal Rings, Right
 * Hand Rings, Tanzanite Earrings, Bridal Diamond Rings, Diamond Earring
 * Bargains, Diamond Fashion Pendants, Cocktail Rings) and reports exactly
 * where each product currently lives: its stored categoryPath string, its
 * actual linked subSubcategory name, and whether those two agree.
 *
 * READ-ONLY.
 *
 * USAGE:
 *   node scripts/diagnose-specific-categories.mjs
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

// A representative sample of legacyProductIds per target subSubcategory,
// pulled from the earlier scrape output.
const TARGET_IDS = {
  'Bridal Rings': [3261, 5134],
  'Right Hand Rings': [3174, 3201, 3214, 4328, 5098],
  'Tanzanite Earrings': [26384, 26383, 26382, 26381],
  'Bridal Diamond Rings': [34681, 26242, 6275, 6299, 6324],
  'Diamond Earring Bargains': [32403, 4377],
  'Diamond Fashion Pendants': [35880, 35879, 25371, 25372],
  'Cocktail Rings': [36587, 36585, 36584, 36583, 36582],
};

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const allSubSub = await SubSubcategory.find({}).lean();
  const subSubById = new Map(allSubSub.map((s) => [String(s._id), s.name]));

  for (const [targetName, ids] of Object.entries(TARGET_IDS)) {
    console.log(`\n── ${targetName} ──`);
    for (const legacyProductId of ids) {
      const doc = await Product.findOne(
        { legacyProductId },
        { name: 1, categoryPath: 1, subcategory2Raw: 1, subSubcategory: 1 }
      ).lean();
      if (!doc) {
        console.log(`   [${legacyProductId}] NOT FOUND in DB`);
        continue;
      }
      const actualName = doc.subSubcategory ? (subSubById.get(String(doc.subSubcategory)) || '(id not in taxonomy)') : '(no subSubcategory field)';
      console.log(`   [${legacyProductId}] "${doc.name}"`);
      console.log(`        categoryPath:      ${doc.categoryPath || '(none)'}`);
      console.log(`        subcategory2Raw:   ${doc.subcategory2Raw || '(none)'}`);
      console.log(`        actual subSubcat:  ${actualName}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
