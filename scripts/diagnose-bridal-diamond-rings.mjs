/**
 * Settles the "Bridal Diamond Rings" empty-category question precisely,
 * by legacyProductId rather than breadcrumb-text search.
 *
 * diagnose-remaining-empty-subsubcategories.mjs searched product breadcrumb
 * text (categoryPath / subcategory2Raw) for "Bridal Diamond Rings" and
 * found zero hits — but that field gets overwritten to whatever the
 * product's CURRENT subSubcategory is when a product is (re)linked, so a
 * product legacy filed under "Bridal Diamond Rings" that was imported
 * under a different (cross-listed) category would show zero here even
 * though it's sitting right there in the DB. Checking the exact legacy
 * IDs sidesteps that.
 *
 * The 8 IDs below are every legacyProductId scripts/output/scraped-
 * products.json records under subSubcategory "Bridal Diamond Rings" (see
 * fix-round2-subsubcategory-links.mjs header — this category was
 * deliberately excluded from that batch pending the cross-listing
 * decision, since legacy cross-lists it under both "Bridal Diamond Rings"
 * and "Engagement Solitaire Rings").
 *
 * Read-only. Writes nothing.
 *
 * USAGE:
 *   node scripts/diagnose-bridal-diamond-rings.mjs
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

const LEGACY_IDS = ['34681', '26242', '6275', '6299', '6324', '5051', '5054', '4343'];

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const subSubById = new Map(
    (await SubSubcategory.find({}).select({ name: 1 }).lean()).map((s) => [String(s._id), s.name])
  );

  const found = await Product.find({ legacyProductId: { $in: LEGACY_IDS } })
    .select({ name: 1, legacyProductId: 1, subSubcategory: 1 })
    .lean();

  const foundIds = new Set(found.map((p) => String(p.legacyProductId)));
  const missing = LEGACY_IDS.filter((id) => !foundIds.has(id));

  console.log(`${found.length} of ${LEGACY_IDS.length} known legacy IDs found in DB:\n`);
  for (const p of found) {
    const currentName = p.subSubcategory ? (subSubById.get(String(p.subSubcategory)) ?? '(unknown)') : '(never linked)';
    console.log(`   [${p.legacyProductId}] ${p.name}`);
    console.log(`        currently: ${currentName}`);
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} legacy ID(s) NOT found in DB at all — genuine gap, would need scraping:`);
    for (const id of missing) console.log(`   ${id}`);
  } else {
    console.log('\n✅ All 8 already exist in the DB. Nothing to scrape — this is a cross-listing decision, not a gap.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
