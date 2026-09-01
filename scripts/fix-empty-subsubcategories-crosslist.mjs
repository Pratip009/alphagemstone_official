/**
 * Fills the 3 real (non-Brooch) empty subSubcategories flagged by
 * report-subsubcategory-counts.mjs:
 *
 *   - Diamond Rings   > Bridal Diamond Rings   (8 products)
 *   - Bargains        > Diamond Earrings       (2 products)
 *   - Bargains        > Silk Cord Necklace     (1 product)
 *
 * All 3 were already root-caused by diagnose-bridal-diamond-rings.mjs /
 * diagnose-remaining-empty-subsubcategories.mjs / fix-round2-subsubcategory-
 * links.mjs: every one of them is a genuine legacy cross-listing (confirmed
 * again here directly against src/lib/products.csv's category_paths_all /
 * category_ids_resolved columns), not a catalog gap:
 *
 *   - Bridal Diamond Rings' 8 products (34681, 26242, 6275, 6299, 6324 —
 *     also filed under Engagement Solitaire Rings; 5051, 5054, 4343 — also
 *     filed under Wedding Diamond Bands) are real, already-imported
 *     products currently living only under their OTHER category.
 *   - Bargains > Diamond Earrings' 2 products (4377, 32403) are the same
 *     two real products already sitting under Diamond Earrings >
 *     Diamond Earring Bargains (legacy category_ids "131;148").
 *   - Bargains > Silk Cord Necklace's 1 product (6719) is the same real
 *     product already sitting under Bargains > Silk Cords (legacy lost the
 *     6719 tie-break to Silk Cords in fix-round2-subsubcategory-links.mjs).
 *
 * The schema has no subSubcategory-level cross-listing field (see the
 * crossListedSubcategoryIds comment in src/models/Product.ts — that field
 * only works one level up, at Subcategory), so a single product document
 * cannot point at two subSubcategories at once. This script resolves that
 * the same way a merchandiser would on a platform without that feature:
 * it CLONES each source product into a new document pointed at the empty
 * target subSubcategory, and leaves the original document exactly where it
 * is. Nothing is moved or deleted — every category keeps its product.
 *
 * Clones:
 *   - get a fresh _id and no legacyProductId (that field is unique+sparse;
 *     omitting it avoids a collision with the original and is exactly what
 *     the sparse index is for).
 *   - carry over name/price/images/description/gemstone or diamond
 *     attributes/etc. unchanged — these are real products, not placeholders.
 *   - get subcategory/category corrected to the TARGET's parent, in case
 *     that ever differs from the source (it doesn't for these 3, but this
 *     keeps the script correct if it's ever reused).
 *   - stock is halved (min 1) from the source so the clone doesn't silently
 *     double the real sellable count of the same physical/lot inventory.
 *
 * Silver Brooch is intentionally NOT included — no legacy category, no
 * scraped products, no products.csv rows reference it under any name.
 * That one category never had inventory, so it should stay empty rather
 * than be seeded with something unrelated.
 *
 * DRY-RUN by default. Pass --commit to actually write.
 *
 * USAGE:
 *   node scripts/fix-empty-subsubcategories-crosslist.mjs
 *   node scripts/fix-empty-subsubcategories-crosslist.mjs --commit
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

const COMMIT = process.argv.includes('--commit');

const TARGETS = [
  {
    subSubName: 'Bridal Diamond Rings',
    parentSubcategory: 'Diamond Rings',
    legacyProductIds: [34681, 26242, 6275, 6299, 6324, 5051, 5054, 4343],
  },
  {
    subSubName: 'Diamond Earrings',
    parentSubcategory: 'Bargains',
    legacyProductIds: [4377, 32403],
  },
  {
    subSubName: 'Silk Cord Necklace',
    parentSubcategory: 'Bargains',
    legacyProductIds: [6719],
  },
];

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const SubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });

const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Subcategory = mongoose.model('Subcategory', SubcategorySchema, 'subcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : '  (DRY RUN — pass --commit to write)'}\n`);

  const allSub = await Subcategory.find({}).select({ name: 1, category: 1 }).lean();
  const subByName = new Map(allSub.map((s) => [s.name.trim().toLowerCase(), s]));

  const toInsert = [];
  let totalMissing = 0;

  for (const target of TARGETS) {
    console.log('─'.repeat(70));
    const label = `${target.parentSubcategory} → ${target.subSubName}`;
    console.log(`Target: ${label}`);

    const parentSub = subByName.get(target.parentSubcategory.trim().toLowerCase());
    if (!parentSub) {
      console.log(`   ❌ Parent subcategory "${target.parentSubcategory}" not found. Skipping.`);
      continue;
    }

    const targetSubSub = await SubSubcategory.findOne({
      name: target.subSubName,
      subcategory: parentSub._id,
    }).lean();
    if (!targetSubSub) {
      console.log(`   ❌ SubSubcategory "${target.subSubName}" under "${target.parentSubcategory}" not found. Skipping.`);
      continue;
    }

    const sources = await Product.find({
      legacyProductId: { $in: target.legacyProductIds },
    }).lean();

    const foundIds = new Set(sources.map((p) => p.legacyProductId));
    const missing = target.legacyProductIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      console.log(`   ⚠️  ${missing.length} legacy ID(s) not found in DB, skipping those: ${missing.join(', ')}`);
      totalMissing += missing.length;
    }

    for (const src of sources) {
      const clone = { ...src };
      delete clone._id;
      delete clone.__v;
      delete clone.legacyProductId;
      delete clone.createdAt;
      delete clone.updatedAt;

      clone.subSubcategory = targetSubSub._id;
      clone.subcategory = parentSub._id;
      clone.category = parentSub.category;
      clone.stock = Math.max(1, Math.floor((src.stock ?? 0) / 2));

      toInsert.push({ label, name: src.name, legacySourceId: src.legacyProductId, doc: clone });
      console.log(`   + clone "${src.name}" (from legacy #${src.legacyProductId}), stock ${src.stock ?? 0} → ${clone.stock}`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`${toInsert.length} product(s) staged for insertion across ${TARGETS.length} target(s).`);
  if (totalMissing) console.log(`${totalMissing} legacy ID(s) were not found in the DB at all.`);

  if (!COMMIT) {
    console.log('\nDry run — nothing written. Re-run with --commit to insert these.');
  } else if (toInsert.length) {
    const res = await Product.insertMany(toInsert.map((t) => t.doc));
    console.log(`\n✅ Inserted ${res.length} new product document(s).`);
  } else {
    console.log('\nNothing to insert.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
