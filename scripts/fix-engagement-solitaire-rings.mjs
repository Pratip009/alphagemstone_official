/**
 * Restores "Jewelry → Diamond Rings → Engagement Solitaire Rings".
 *
 * WHY: alphaimports.com had 107 products in this category (legacy category
 * id 125, URL ...-c-24_126_125.html). All 107 were imported into
 * AlphaGemstone under Jewelry → Diamond Rings, but almost none were put in
 * the "Engagement Solitaire Rings" sub-subcategory: the taxonomy seeder
 * (scripts/lib/subsubcategory-taxonomy.mjs) only links a product when its
 * NAME contains both "engagement" and "solitaire". Old product names are
 * like "1 Carat Blue Diamond Ring in 14k Gold", so 106 of 107 never matched.
 *
 * WHAT IT DOES:
 *   1. Finds Jewelry → Diamond Rings, and finds (or creates) the
 *      "Engagement Solitaire Rings" sub-subcategory under it.
 *   2. Looks up the 107 products by legacyProductId (the exact legacy
 *      membership from src/lib/products.csv, not name guessing).
 *   3. Links every one that has NO sub-subcategory yet.
 *   4. Products already in a DIFFERENT sub-subcategory are only reported
 *      (pass --move-others to move them too).
 *
 * DRY-RUN by default — prints the plan and writes nothing.
 *
 * USAGE:
 *   node scripts/fix-engagement-solitaire-rings.mjs
 *   node scripts/fix-engagement-solitaire-rings.mjs --commit
 *   node scripts/fix-engagement-solitaire-rings.mjs --commit --move-others
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
const MOVE_OTHERS = process.argv.includes('--move-others');

const TARGET_NAME = 'Engagement Solitaire Rings';
const TARGET_SLUG = 'engagement-solitaire-rings';
const PARENT_SUBCATEGORY = 'Diamond Rings';
const PARENT_CATEGORY = 'Jewelry';

// Every product in legacy category 125 (src/lib/products.csv, category_ids contains "125").
const LEGACY_IDS = [
  6274, 6275, 6277, 6278, 6281, 6283, 6284, 6297, 6298, 6299, 6301, 6302, 6304, 6305, 6308, 6310,
  6313, 6314, 6316, 6317, 6319, 6320, 6321, 6324, 6327, 6335, 6336, 6340, 6343, 6344, 6346, 6347,
  6349, 6350, 6351, 6353, 6355, 6356, 6358, 6359, 6360, 6362, 6364, 6365, 6367, 6374, 6375, 6376,
  6377, 6378, 6379, 7817, 7819, 12474, 15077, 20454, 20494, 20510, 20523, 20967, 21837, 21846,
  21867, 21869, 22587, 26242, 27945, 30902, 32122, 34681, 34738, 34739, 35248, 36349, 36586,
  36671, 36758, 36759, 36760, 36897, 36898, 36899, 37062, 37063, 37201, 37239, 37240, 37241,
  37242, 37243, 37244, 37245, 37246, 37249, 37250, 37251, 37252, 37253, 37254, 37255, 37256,
  37257, 37258, 37259, 37260, 37628, 37819
];

const loose = (name) => new mongoose.Schema({}, { strict: false, collection: name });
const Category = mongoose.model('Category', loose('categories'));
const Subcategory = mongoose.model('Subcategory', loose('subcategories'));
const SubSubcategory = mongoose.model('SubSubcategory', loose('subsubcategories'));
const Product = mongoose.model('Product', loose('products'));

const ci = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : '  (DRY RUN — pass --commit to write)'}\n`);
  console.log(`Legacy products to place: ${LEGACY_IDS.length}`);

  const jewelry = await Category.findOne({ name: ci(PARENT_CATEGORY) }).lean();
  if (!jewelry) throw new Error(`Category "${PARENT_CATEGORY}" not found`);
  const rings = await Subcategory.findOne({ name: ci(PARENT_SUBCATEGORY), category: jewelry._id }).lean();
  if (!rings) throw new Error(`Subcategory "${PARENT_SUBCATEGORY}" not found under ${PARENT_CATEGORY}`);

  // 1. Target sub-subcategory
  let target = await SubSubcategory.findOne({
    subcategory: rings._id,
    $or: [{ slug: TARGET_SLUG }, { name: ci(TARGET_NAME) }],
  }).lean();
  if (target) {
    console.log(`Sub-subcategory exists: ${target.name} (${target._id})${target.isActive === false ? '  ⚠️ INACTIVE — will be re-activated' : ''}`);
  } else {
    console.log(`Sub-subcategory "${TARGET_NAME}" is MISSING — will be created under ${PARENT_CATEGORY} → ${PARENT_SUBCATEGORY}`);
  }

  // 2. Products
  const products = await Product.find({ legacyProductId: { $in: LEGACY_IDS } })
    .select({ name: 1, legacyProductId: 1, legacySku: 1, isActive: 1, category: 1, subcategory: 1, subSubcategory: 1 })
    .lean();
  const found = new Set(products.map((p) => p.legacyProductId));
  const notInDb = LEGACY_IDS.filter((id) => !found.has(id));

  const subSubNames = new Map(
    (await SubSubcategory.find({ _id: { $in: products.map((p) => p.subSubcategory).filter(Boolean) } }).select({ name: 1 }).lean())
      .map((s) => [String(s._id), s.name]),
  );

  const already = [], toLink = [], elsewhere = [], inactive = [], wrongParent = [];
  for (const p of products) {
    if (p.isActive === false) inactive.push(p);
    if (String(p.subcategory) !== String(rings._id)) wrongParent.push(p);
    if (target && String(p.subSubcategory) === String(target._id)) already.push(p);
    else if (!p.subSubcategory) toLink.push(p);
    else elsewhere.push(p);
  }

  console.log(`\nFound in DB:                 ${products.length} / ${LEGACY_IDS.length}`);
  console.log(`Already in ${TARGET_NAME}: ${already.length}`);
  console.log(`Will be linked:              ${toLink.length}`);
  console.log(`In another sub-subcategory:  ${elsewhere.length}${MOVE_OTHERS ? '  (will be MOVED)' : '  (left as is; use --move-others to move)'}`);
  for (const p of elsewhere) console.log(`   • ${p.legacyProductId} ${p.legacySku ?? ''} "${p.name}" → currently in "${subSubNames.get(String(p.subSubcategory)) ?? p.subSubcategory}"`);
  if (wrongParent.length) {
    console.log(`Not under Jewelry → Diamond Rings: ${wrongParent.length} (will be moved there)`);
    for (const p of wrongParent) console.log(`   • ${p.legacyProductId} "${p.name}"`);
  }
  if (inactive.length) {
    console.log(`⚠️  Inactive (hidden from customers): ${inactive.length} — NOT changed, review in admin:`);
    for (const p of inactive) console.log(`   • ${p.legacyProductId} "${p.name}"`);
  }
  if (notInDb.length) console.log(`❌ Not in the database at all: ${notInDb.length} — ${notInDb.join(', ')}`);

  if (!COMMIT) {
    console.log('\nDry run only. Re-run with --commit to apply.');
    return;
  }

  // 3. Write
  if (!target) {
    const [created] = await SubSubcategory.create([{
      name: TARGET_NAME, slug: TARGET_SLUG, subcategory: rings._id, category: jewelry._id, sortOrder: 0, isActive: true,
    }]);
    target = created.toObject();
    console.log(`\n➕ Created sub-subcategory ${target._id}`);
  } else if (target.isActive === false) {
    await SubSubcategory.updateOne({ _id: target._id }, { $set: { isActive: true } });
    console.log('\n✔ Re-activated sub-subcategory');
  }

  const ids = [...toLink, ...(MOVE_OTHERS ? elsewhere : []), ...wrongParent.filter((p) => !already.includes(p))].map((p) => p._id);
  const res = await Product.updateMany(
    { _id: { $in: ids } },
    { $set: { category: jewelry._id, subcategory: rings._id, subSubcategory: target._id } },
  );
  console.log(`✔ Linked ${res.modifiedCount} product(s).`);

  const total = await Product.countDocuments({ subSubcategory: target._id, isActive: { $ne: false } });
  console.log(`\n${TARGET_NAME} now shows ${total} active product(s).`);
  console.log('Pages refresh within ~5 minutes (site cache), or redeploy to see it immediately.');
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
