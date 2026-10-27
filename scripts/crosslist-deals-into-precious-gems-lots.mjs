/**
 * Shows EVERY product from
 *   Precious Gems > Precious gems deals and steals
 * ALSO under
 *   Wholesale Lots > Precious Gems Lots
 *
 * Products are NOT moved or copied. Each one keeps its real category /
 * subcategory (so it stays in Deals and Steals) and gets the Precious Gems
 * Lots subcategory added to crossListedSubcategoryIds. The storefront
 * already supports this field (buildProductFilterQuery() in
 * src/services/productFilter.service.ts matches a subcategory page on
 * "real subcategory OR crossListedSubcategoryIds"), so no code change or
 * deploy is needed — the products appear as soon as this runs.
 *
 * Same document, same stock, same URL in both places.
 *
 * NOTE: do not use scripts/populate-wholesale-lots.mjs for this — it MOVES
 * products into Wholesale Lots, which would empty Deals and Steals.
 *
 * Idempotent ($addToSet). DRY-RUN by default; pass --commit to write.
 *
 * USAGE (from the project root):
 *   node scripts/crosslist-deals-into-precious-gems-lots.mjs                  # preview
 *   node scripts/crosslist-deals-into-precious-gems-lots.mjs --commit         # apply
 *   node scripts/crosslist-deals-into-precious-gems-lots.mjs --undo --commit  # remove again
 *
 * Requires MONGODB_URI in environment or .env / .env.local file.
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
const UNDO = process.argv.includes('--undo');
const FORCE = process.argv.includes('--force');
const EXPECTED_COUNT = 1293;

const SOURCE_SUBCATEGORY_SLUG = 'precious-gems-deals-and-steals';
const TARGET_SUBCATEGORY_SLUG = 'precious-gems-lots';

const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
const Subcategory = mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }), 'subcategories');
const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : ' (DRY RUN — pass --commit to write)'}${UNDO ? ' [UNDO]' : ''}\n`);

  const source = await Subcategory.findOne({ slug: SOURCE_SUBCATEGORY_SLUG }).lean();
  const target = await Subcategory.findOne({ slug: TARGET_SUBCATEGORY_SLUG }).lean();
  if (!source) throw new Error(`Source subcategory "${SOURCE_SUBCATEGORY_SLUG}" not found`);
  if (!target) throw new Error(`Target subcategory "${TARGET_SUBCATEGORY_SLUG}" not found`);
  const targetCat = await Category.findById(target.category).lean();

  console.log(`From: ${source.name} (${source._id})`);
  console.log(`To:   ${targetCat?.name ?? '?'} > ${target.name} (${target._id})`);
  if (target.isActive === false) console.warn(`⚠️  "${target.name}" is marked inactive — its page won't show until it is activated.`);
  if (targetCat?.isActive === false) console.warn(`⚠️  "${targetCat.name}" is marked inactive.`);
  console.log('');

  const sourceFilter = { subcategory: source._id };
  const total = await Product.countDocuments(sourceFilter);
  const active = await Product.countDocuments({ ...sourceFilter, isActive: true });
  const already = await Product.countDocuments({ ...sourceFilter, crossListedSubcategoryIds: target._id });

  console.log(`Products in ${source.name}: ${total} (${active} active)`);
  console.log(`Already shown in ${target.name}: ${already}`);
  console.log(UNDO
    ? `Would remove ${already} from ${target.name}.`
    : `Would add ${total - already} to ${target.name}.`);
  if (!UNDO && total !== EXPECTED_COUNT) {
    console.warn(`⚠️  Expected ${EXPECTED_COUNT} products — your database has ${total}. All of them will be included.`);
  }

  // Guard: an older run of populate-wholesale-lots.mjs (or a manual import)
  // may have left separate COPIES of these products filed directly under
  // Precious Gems Lots. Cross-listing on top of those would show every
  // product twice, so refuse to commit unless --force is passed.
  const ownInTarget = await Product.find(
    { subcategory: target._id },
    { name: 1, isActive: 1 }
  ).lean();
  let blocked = false;
  if (!UNDO && ownInTarget.length) {
    const sourceNames = new Set(
      (await Product.find(sourceFilter, { name: 1 }).lean()).map((p) => String(p.name).trim().toLowerCase())
    );
    const dupes = ownInTarget.filter((p) => sourceNames.has(String(p.name).trim().toLowerCase()));
    const activeOwn = ownInTarget.filter((p) => p.isActive !== false).length;
    console.warn(
      `\n⚠️  ${target.name} already has ${ownInTarget.length} product(s) of its own ` +
      `(${activeOwn} active), and ${dupes.length} of them have the same name as a ${source.name} product.`
    );
    if (dupes.length && !FORCE) {
      blocked = true;
      console.warn(
        '   These look like earlier copies. Cross-listing as well would show those products twice.\n' +
        '   Either delete the copies first, or re-run with --force if you really want both.'
      );
    }
  }

  const sample = await Product.find(sourceFilter, { name: 1 }).limit(10).lean();
  console.log('\nFirst few:');
  sample.forEach((p) => console.log(`  ${p._id}  ${p.name}`));

  if (!COMMIT) {
    console.log('\nDry run — nothing written. Re-run with --commit to apply.');
    return;
  }
  if (blocked) {
    console.log('\nNothing written (see warning above).');
    return;
  }

  const update = UNDO
    ? { $pull: { crossListedSubcategoryIds: target._id } }
    : { $addToSet: { crossListedSubcategoryIds: target._id } };
  const res = await Product.updateMany(sourceFilter, update);
  console.log(`\n✅ Matched ${res.matchedCount}, modified ${res.modifiedCount}.`);

  // Same scope the storefront uses for the Precious Gems Lots page.
  const visible = await Product.countDocuments({
    isActive: true,
    $or: [
      { category: target.category, subcategory: target._id },
      { crossListedSubcategoryIds: target._id },
    ],
  });
  console.log(`   Active products now on ${target.name}: ${visible}`);
}

main()
  .catch((err) => { console.error('❌ Script failed:', err.message ?? err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
