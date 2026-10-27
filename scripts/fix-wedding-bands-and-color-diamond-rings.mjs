/**
 * Restores two Jewelry → Diamond Rings sub-subcategories that show only
 * 1 product each on AlphaGemstone:
 *
 *   - Wedding Diamond Bands  (legacy category 245) — 12 products on alphaimports.com
 *   - Color Diamond Rings    (legacy category 128) — 10 products on alphaimports.com
 *
 * WHY THEY WERE EMPTY:
 *   1. The taxonomy seeder (scripts/lib/subsubcategory-taxonomy.mjs) links a
 *      product only when its NAME contains certain keywords:
 *        Wedding Diamond Bands → "wedding" + "band"
 *        Color Diamond Rings   → "color" + "diamond"  or  "fancy" + "color"
 *      Real legacy names are "0.68 ct twt VS Diamond Band in 18k Gold" and
 *      "1.38 Ct Twt Red Cognac VS Diamond Ring in 18k Gold" — no "wedding",
 *      no "color" — so almost none matched.
 *   2. RS013, RS01192006313 and RS01202006101 are in BOTH Bridal Diamond Rings
 *      (202) and Wedding Diamond Bands (245) in the legacy catalogue, but a
 *      product could only hold one subSubcategory. This script uses the new
 *      Product.crossListedSubSubcategoryIds field for that case instead of
 *      moving or cloning the product.
 *
 * WHAT IT DOES (per target):
 *   - Finds Jewelry → Diamond Rings, and finds (or creates) the target
 *     sub-subcategory (matched by any known name/slug variant).
 *   - Looks up the products by legacyProductId (exact legacy membership from
 *     src/lib/products.csv `category_ids`, not name guessing).
 *   - No sub-subcategory yet        → sets subSubcategory to the target.
 *   - In another sub-subcategory    → keeps it, and adds the target to
 *                                     crossListedSubSubcategoryIds.
 *   - Not under Jewelry → Diamond Rings → moved there.
 *   - Inactive products are only reported (not re-activated).
 *
 * DRY-RUN by default — prints the plan and writes nothing.
 *
 * USAGE:
 *   node scripts/fix-wedding-bands-and-color-diamond-rings.mjs
 *   node scripts/fix-wedding-bands-and-color-diamond-rings.mjs --commit
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

const PARENT_CATEGORY = 'Jewelry';
const PARENT_SUBCATEGORY = 'Diamond Rings';

const TARGETS = [
  {
    name: 'Wedding Diamond Bands',
    slug: 'wedding-diamond-bands',
    // Storefront label has also been "Diamond Wedding Bands" — accept either.
    aliases: ['Wedding Diamond Bands', 'Diamond Wedding Bands', 'Wedding Bands'],
    aliasSlugs: ['wedding-diamond-bands', 'diamond-wedding-bands', 'wedding-bands'],
    // Every product in legacy category 245 (src/lib/products.csv).
    legacyIds: [4343, 5051, 5054, 20732, 20733, 20735, 20736, 20739, 20742, 35654, 36729, 37820],
  },
  {
    name: 'Color Diamond Rings',
    slug: 'color-diamond-rings',
    aliases: ['Color Diamond Rings', 'Colour Diamond Rings', 'Colored Diamond Rings'],
    aliasSlugs: ['color-diamond-rings', 'colour-diamond-rings', 'colored-diamond-rings'],
    // Every product in legacy category 128 (src/lib/products.csv).
    legacyIds: [18560, 18561, 19283, 24167, 24196, 36350, 36351, 36803, 37602, 37783],
  },
];

const loose = (name) => new mongoose.Schema({}, { strict: false, collection: name });
const Category = mongoose.model('Category', loose('categories'));
const Subcategory = mongoose.model('Subcategory', loose('subcategories'));
const SubSubcategory = mongoose.model('SubSubcategory', loose('subsubcategories'));
const Product = mongoose.model('Product', loose('products'));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ci = (s) => new RegExp(`^${esc(s)}$`, 'i');

async function fixTarget(t, jewelry, rings) {
  console.log(`\n━━━ ${t.name} ━━━`);
  console.log(`Legacy products to place: ${t.legacyIds.length}`);

  let target = await SubSubcategory.findOne({
    subcategory: rings._id,
    $or: [{ slug: { $in: t.aliasSlugs } }, { name: { $in: t.aliases.map(ci) } }],
  }).lean();
  if (target) {
    console.log(`Sub-subcategory exists: "${target.name}" (${target._id})${target.isActive === false ? '  ⚠️ INACTIVE — will be re-activated' : ''}`);
  } else {
    console.log(`Sub-subcategory "${t.name}" is MISSING — will be created`);
  }

  const products = await Product.find({ legacyProductId: { $in: t.legacyIds } })
    .select({ name: 1, legacyProductId: 1, legacySku: 1, isActive: 1, subcategory: 1, subSubcategory: 1, crossListedSubSubcategoryIds: 1 })
    .lean();
  const found = new Set(products.map((p) => p.legacyProductId));
  const notInDb = t.legacyIds.filter((id) => !found.has(id));

  const otherNames = new Map(
    (await SubSubcategory.find({ _id: { $in: products.map((p) => p.subSubcategory).filter(Boolean) } }).select({ name: 1 }).lean())
      .map((s) => [String(s._id), s.name]),
  );

  const tid = target ? String(target._id) : null;
  const isIn = (p) => tid && (String(p.subSubcategory) === tid || (p.crossListedSubSubcategoryIds ?? []).some((x) => String(x) === tid));

  const already = [], toLink = [], toCrossList = [], inactive = [], wrongParent = [];
  for (const p of products) {
    if (p.isActive === false) inactive.push(p);
    if (String(p.subcategory) !== String(rings._id)) wrongParent.push(p);
    if (isIn(p)) already.push(p);
    else if (!p.subSubcategory) toLink.push(p);
    else toCrossList.push(p);
  }

  console.log(`Found in DB:              ${products.length} / ${t.legacyIds.length}`);
  console.log(`Already showing there:    ${already.length}`);
  console.log(`Will be linked:           ${toLink.length}`);
  for (const p of toLink) console.log(`   • ${p.legacyProductId} ${p.legacySku ?? ''} "${p.name}"`);
  console.log(`Will be cross-listed:     ${toCrossList.length}  (stay in their current sub-subcategory too)`);
  for (const p of toCrossList) console.log(`   • ${p.legacyProductId} ${p.legacySku ?? ''} "${p.name}" — primary: "${otherNames.get(String(p.subSubcategory)) ?? p.subSubcategory}"`);
  if (wrongParent.length) {
    console.log(`Not under ${PARENT_CATEGORY} → ${PARENT_SUBCATEGORY}: ${wrongParent.length} (will be moved there)`);
    for (const p of wrongParent) console.log(`   • ${p.legacyProductId} "${p.name}"`);
  }
  if (inactive.length) {
    console.log(`⚠️  Inactive (hidden from customers): ${inactive.length} — NOT changed, review in admin:`);
    for (const p of inactive) console.log(`   • ${p.legacyProductId} "${p.name}"`);
  }
  if (notInDb.length) console.log(`❌ Not in the database at all: ${notInDb.length} — ${notInDb.join(', ')}`);

  if (!COMMIT) return;

  if (!target) {
    const [created] = await SubSubcategory.create([{
      name: t.name, slug: t.slug, subcategory: rings._id, category: jewelry._id, sortOrder: 0, isActive: true,
    }]);
    target = created.toObject();
    console.log(`➕ Created sub-subcategory ${target._id}`);
  } else if (target.isActive === false) {
    await SubSubcategory.updateOne({ _id: target._id }, { $set: { isActive: true } });
    console.log('✔ Re-activated sub-subcategory');
  }

  const parentSet = { category: jewelry._id, subcategory: rings._id };
  const ops = [
    ...toLink.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { ...parentSet, subSubcategory: target._id } } },
    })),
    ...toCrossList.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: parentSet, $addToSet: { crossListedSubSubcategoryIds: target._id } },
      },
    })),
    ...wrongParent
      .filter((p) => !toLink.includes(p) && !toCrossList.includes(p))
      .map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: parentSet } } })),
  ];
  if (ops.length) {
    const res = await Product.bulkWrite(ops);
    console.log(`✔ Updated ${res.modifiedCount} product(s).`);
  }

  const total = await Product.countDocuments({
    isActive: { $ne: false },
    $or: [{ subSubcategory: target._id }, { crossListedSubSubcategoryIds: target._id }],
  });
  console.log(`${target.name} now shows ${total} active product(s).`);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : '  (DRY RUN — pass --commit to write)'}`);

  const jewelry = await Category.findOne({ name: ci(PARENT_CATEGORY) }).lean();
  if (!jewelry) throw new Error(`Category "${PARENT_CATEGORY}" not found`);
  const rings = await Subcategory.findOne({ name: ci(PARENT_SUBCATEGORY), category: jewelry._id }).lean();
  if (!rings) throw new Error(`Subcategory "${PARENT_SUBCATEGORY}" not found under ${PARENT_CATEGORY}`);

  for (const t of TARGETS) await fixTarget(t, jewelry, rings);

  console.log(COMMIT
    ? '\nDone. Pages refresh within ~5 minutes (site cache), or redeploy to see it immediately.'
    : '\nDry run only. Re-run with --commit to apply.');
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
