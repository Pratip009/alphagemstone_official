/**
 * COPIES the multicolor sapphire lots from
 *   Precious Gems > Precious gems deals and steals
 * into
 *   Precious Gems > Sapphire > Multicolor Sapphire
 *
 * The originals are left exactly where they are (they keep showing in Deals
 * and Steals). Each copy is a new product document with:
 *   - a fresh _id
 *   - category / subcategory / subSubcategory set to Sapphire > Multicolor Sapphire
 *   - a new unique slug ("<original-slug>-multicolor-sapphire", with -2, -3 …
 *     if that is taken), because slug has a unique index
 *   - no legacyProductId (unique index — the original keeps it)
 *   - reservedForMemo reset to 0, cross-listing fields removed
 *   - copiedFromProductId = the original's _id, so re-runs skip products
 *     already copied and --undo can find the copies again
 *   - everything else (name, price, images, description, colour, stock, …)
 *     copied unchanged
 *
 * Selection ("according to the colours"): products in Deals and Steals whose
 * colour (colorRaw) is "Multi Color" AND gemstoneName is exactly "Sapphire".
 * 64 products in the repo's mongo-migration dump. "Rainbow"-coloured
 * sapphires and mixed precious-gem lots are not included.
 *
 * STOCK: a copy is a separate product with its own stock counter, but it is
 * the same physical lot as the original. By default the copy gets the same
 * stock as the original. Pass --halve-stock to give the copy half (min 1),
 * like scripts/fix-empty-subsubcategories-crosslist.mjs does.
 *
 * DRY-RUN by default. Nothing is written until you pass --commit.
 *
 * USAGE:
 *   node scripts/copy-deals-multicolor-sapphire.mjs                    # preview
 *   node scripts/copy-deals-multicolor-sapphire.mjs --commit           # create the copies
 *   node scripts/copy-deals-multicolor-sapphire.mjs --commit --halve-stock
 *   node scripts/copy-deals-multicolor-sapphire.mjs --undo --commit    # delete the copies again
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
const HALVE_STOCK = process.argv.includes('--halve-stock');
const EXPECTED_COUNT = 64;

const SOURCE_SUBCATEGORY_SLUG = 'precious-gems-deals-and-steals';
const TARGET_SUBCATEGORY_SLUG = 'sapphire';
const TARGET_SUBSUB_NAME_RE = /^multi[\s-]?colou?r sapphire$/i;
const SLUG_SUFFIX = 'multicolor-sapphire';

const SubSubcategory = mongoose.model('SubSubcategory', new mongoose.Schema({}, { strict: false }), 'subsubcategories');
const Subcategory = mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }), 'subcategories');
const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');

// Same slugify() as src/models/Product.ts.
function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isMulticolorSapphire(p) {
  const gem = String(p.gemstoneName ?? '').trim().toLowerCase();
  const color = String(p.colorRaw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '');
  return gem === 'sapphire' && color === 'multicolor';
}

// Builds the new document for one source product. `slug` is resolved
// separately (needs DB lookups).
function buildCopy(src, { target, targetSubSub, halveStock }) {
  const copy = { ...src };
  for (const k of [
    '_id', '__v', 'createdAt', 'updatedAt', 'slug', 'legacyProductId',
    'crossListedSubcategoryIds', 'crossListedSubSubcategoryIds',
  ]) delete copy[k];

  copy.category = target.category;
  copy.subcategory = target._id;
  copy.subSubcategory = targetSubSub._id;
  copy.reservedForMemo = 0;
  copy.copiedFromProductId = src._id;
  copy.stock = halveStock ? Math.max(1, Math.floor((src.stock ?? 0) / 2)) : (src.stock ?? 0);
  const now = new Date();
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}

async function uniqueSlug(base, taken) {
  let candidate = base;
  for (let n = 2; n <= 1000; n++) {
    if (!taken.has(candidate) && !(await Product.exists({ slug: candidate }))) {
      taken.add(candidate);
      return candidate;
    }
    candidate = `${base}-${n}`;
  }
  throw new Error(`Could not find a free slug for "${base}"`);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected${COMMIT ? '' : ' (DRY RUN — pass --commit to write)'}${UNDO ? ' [UNDO]' : ''}\n`);

  const source = await Subcategory.findOne({ slug: SOURCE_SUBCATEGORY_SLUG }).lean();
  const target = await Subcategory.findOne({ slug: TARGET_SUBCATEGORY_SLUG }).lean();
  if (!source) throw new Error(`Source subcategory "${SOURCE_SUBCATEGORY_SLUG}" not found`);
  if (!target) throw new Error(`Target subcategory "${TARGET_SUBCATEGORY_SLUG}" not found`);

  const subSubs = await SubSubcategory.find({ subcategory: target._id }).lean();
  const targetSubSub = subSubs.find((s) => TARGET_SUBSUB_NAME_RE.test(String(s.name).trim()));
  if (!targetSubSub) {
    throw new Error(
      `Multicolor Sapphire sub-subcategory not found under Sapphire (found: ${subSubs.map((s) => s.name).join(', ') || 'none'}). ` +
      'Run scripts/seed-subsubcategories.mjs --commit first.'
    );
  }

  console.log(`From: ${source.name}`);
  console.log(`To:   ${target.name} > ${targetSubSub.name} (${targetSubSub._id})\n`);

  // ── Undo ────────────────────────────────────────────────────────────────
  if (UNDO) {
    const copies = await Product.find(
      { copiedFromProductId: { $exists: true }, subSubcategory: targetSubSub._id },
      { name: 1 }
    ).lean();
    copies.forEach((c) => console.log(`  - delete ${c._id}  ${c.name}`));
    console.log(`\n${copies.length} copied product(s) found.`);
    if (COMMIT && copies.length) {
      const res = await Product.deleteMany({ _id: { $in: copies.map((c) => c._id) } });
      console.log(`✅ Deleted ${res.deletedCount}.`);
    } else if (!COMMIT) {
      console.log('Dry run — re-run with --undo --commit to delete them.');
    }
    return;
  }

  // ── Copy ────────────────────────────────────────────────────────────────
  const candidates = await Product.find({ subcategory: source._id }).lean();
  const picked = candidates.filter(isMulticolorSapphire);

  const alreadyCopied = new Set(
    (await Product.find(
      { copiedFromProductId: { $in: picked.map((p) => p._id) }, subSubcategory: targetSubSub._id },
      { copiedFromProductId: 1 }
    ).lean()).map((p) => String(p.copiedFromProductId))
  );

  const crossListed = picked.filter((p) =>
    (p.crossListedSubSubcategoryIds ?? []).some((id) => String(id) === String(targetSubSub._id))
  );
  if (crossListed.length) {
    console.warn(
      `⚠️  ${crossListed.length} of these are already cross-listed into ${targetSubSub.name} ` +
      '(crosslist-deals-multicolor-sapphire.mjs). Copying them too would show each one twice there. ' +
      'Run "node scripts/crosslist-deals-multicolor-sapphire.mjs --undo --commit" first if you want copies instead.\n'
    );
  }

  const takenSlugs = new Set();
  const toInsert = [];
  for (const src of picked) {
    if (alreadyCopied.has(String(src._id))) {
      console.log(`  skip  ${src._id}  ${src.name}  (already copied)`);
      continue;
    }
    const copy = buildCopy(src, { target, targetSubSub, halveStock: HALVE_STOCK });
    copy.slug = await uniqueSlug(`${src.slug || slugify(src.name) || 'product'}-${SLUG_SUFFIX}`, takenSlugs);
    toInsert.push(copy);
    console.log(`  copy  ${src._id}  ${src.name}  → /products/${copy.slug}  (stock ${src.stock ?? 0} → ${copy.stock})`);
  }

  console.log(`\nMatched ${picked.length} multicolor sapphire product(s) out of ${candidates.length} in ${source.name}.`);
  console.log(`${toInsert.length} new copy(ies) to create, ${alreadyCopied.size} already copied.`);
  if (picked.length !== EXPECTED_COUNT) {
    console.warn(`⚠️  Expected ${EXPECTED_COUNT}. Review the list above before committing.`);
  }

  if (!COMMIT) {
    console.log('\nDry run — nothing written. Re-run with --commit to create the copies.');
    return;
  }
  if (!toInsert.length) {
    console.log('\nNothing to insert.');
    return;
  }

  const res = await Product.insertMany(toInsert, { ordered: false });
  console.log(`\n✅ Created ${res.length} product(s) in ${target.name} > ${targetSubSub.name}.`);
  const total = await Product.countDocuments({ subSubcategory: targetSubSub._id, isActive: true });
  console.log(`   Active products now in ${targetSubSub.name}: ${total}`);
}

main()
  .catch((err) => { console.error('❌ Script failed:', err.message ?? err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
