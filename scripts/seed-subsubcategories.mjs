/**
 * Seeds the third-level "type" taxonomy (SubSubcategory) under existing
 * gemstone Subcategories — e.g. Tanzanite → Oval Tanzanite / Trillion
 * Tanzanite / Calibrated Tanzanite / … — and (optionally) best-effort links
 * existing products to the right one by matching keywords against each
 * product's name/shapeRaw/cutType/treatment/gemstoneName.
 *
 * This is DRY-RUN by default — it only prints what it *would* do. Nothing
 * is written to the DB until you pass --commit.
 *
 * USAGE:
 *   node scripts/seed-subsubcategories.mjs                 # dry run, taxonomy only
 *   node scripts/seed-subsubcategories.mjs --commit         # actually create the SubSubcategory docs
 *   node scripts/seed-subsubcategories.mjs --commit --link-products
 *                                                            # also tag matching products
 *
 * IMPORTANT: the product auto-linking is a best-effort keyword match, not a
 * guarantee. After running with --link-products, spot-check a few products
 * per subcategory in the admin UI (or scripts/list-subcategories.mjs-style
 * report) before relying on it in production. Products that don't match any
 * keyword are left alone — they simply keep showing up under the parent
 * Subcategory's plain listing instead of a specific Type.
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
const LINK_PRODUCTS = process.argv.includes('--link-products');

// ── Minimal inline schemas ───────────────────────────────────────────────────
const CategorySchema = new mongoose.Schema({ name: String, slug: String });
const SubcategorySchema = new mongoose.Schema({
  name: String, slug: String, category: mongoose.Schema.Types.ObjectId, isActive: Boolean,
});
const SubSubcategorySchema = new mongoose.Schema(
  {
    name: String, slug: String,
    subcategory: mongoose.Schema.Types.ObjectId,
    category: mongoose.Schema.Types.ObjectId,
    sortOrder: Number, isActive: Boolean,
  },
  { timestamps: true }
);
const ProductSchema = new mongoose.Schema(
  {
    name: String, category: mongoose.Schema.Types.ObjectId, subcategory: mongoose.Schema.Types.ObjectId,
    subSubcategory: mongoose.Schema.Types.ObjectId,
    gemstoneName: String, shapeRaw: String, cutType: String, treatment: String, colorRaw: String,
    isActive: Boolean,
  },
  { strict: false }
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const SubSubcategory = mongoose.models.SubSubcategory || mongoose.model('SubSubcategory', SubSubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Taxonomy definition, transcribed from semisubcategories.txt ─────────────
// `match` is an array of keyword groups; a product matches a child if ANY
// group matches, and a group matches if ALL its keywords are found
// (case-insensitive substring) somewhere across name/shapeRaw/cutType/
// treatment/gemstoneName/colorRaw.
const SHAPE_CHILDREN = (suffix) => [
  { name: `Calibrated ${suffix}`,   match: [['calibrated']] },
  { name: `Oval ${suffix}`,         match: [['oval']] },
  { name: `Trillion ${suffix}`,     match: [['trillion']] },
  { name: `Cushion ${suffix}`,      match: [['cushion']] },
  { name: `Pear ${suffix}`,         match: [['pear']] },
  { name: `Round ${suffix}`,        match: [['round']] },
  { name: `Emerald Cut ${suffix}`,  match: [['emerald', 'cut'], ['emerald-cut']] },
  { name: `Marquise ${suffix}`,     match: [['marquise']] },
  { name: `Heart Shape ${suffix}`,  match: [['heart']] },
];

const CUT_CHILDREN = (suffix) => [
  { name: `Faceted ${suffix}`,  match: [['faceted']] },
  { name: `Cabochon ${suffix}`, match: [['cabochon']] },
];

const TAXONOMY = [
  // ── Precious Gems ──────────────────────────────────────────────────────
  { subcategory: 'Tanzanite', children: SHAPE_CHILDREN('Tanzanite') },
  { subcategory: 'Emerald',   children: CUT_CHILDREN('Emeralds') },
  { subcategory: 'Ruby',      children: CUT_CHILDREN('Ruby') },
  {
    subcategory: 'Sapphire',
    children: [
      { name: 'Blue Sapphire',       match: [['blue']] },
      { name: 'Pink Sapphire',       match: [['pink']] },
      { name: 'Orange Sapphire',     match: [['orange']] },
      { name: 'Yellow Sapphire',     match: [['yellow']] },
      { name: 'White Sapphire',      match: [['white']] },
      { name: 'Green Sapphire',      match: [['green']] },
      { name: 'Multicolor Sapphire', match: [['multicolor'], ['multi-color'], ['multi', 'color'], ['parti']] },
    ],
  },

  // ── Semi Precious ──────────────────────────────────────────────────────
  { subcategory: 'Amethyst',        children: CUT_CHILDREN('Amethyst') },
  { subcategory: 'Chrome Diopside', children: CUT_CHILDREN('Chrome Diopside') },
  { subcategory: 'Citrine',         children: CUT_CHILDREN('Citrine') },
  { subcategory: 'Garnet',          children: CUT_CHILDREN('Garnet') },
  { subcategory: 'Iolite',          children: CUT_CHILDREN('Iolite') },
  { subcategory: 'Onyx',            children: CUT_CHILDREN('Onyx') },
  { subcategory: 'Peridot',         children: CUT_CHILDREN('Peridot') },
  {
    subcategory: 'Quartz',
    children: [
      { name: 'Canary Green Gold Quartz', match: [['canary', 'green', 'gold']] },
      { name: 'Cinnamon Citrine Quartz',  match: [['cinnamon', 'citrine']] },
      { name: 'Crystal Quartz',           match: [['crystal', 'quartz']] },
      { name: 'Madeira Citrine',          match: [['madeira']] },
      { name: 'Olive Quartz',             match: [['olive']] },
      { name: 'Green Golden Quartz',      match: [['green', 'gold']] },
      { name: 'Rose Quartz',              match: [['rose']] },
      { name: 'Rutilated Quartz',         match: [['rutilated'], ['rutile']] },
      { name: 'Smoky Quartz',             match: [['smoky'], ['smokey']] },
      { name: 'White Quartz',             match: [['white']] },
    ],
  },
  { subcategory: 'Rhodolite Garnet', children: CUT_CHILDREN('Rhodolite Garnet') },
  { subcategory: 'Sky Blue Topaz',   children: CUT_CHILDREN('Sky Blue Topaz') },
  { subcategory: 'Swiss Blue Topaz', children: CUT_CHILDREN('Swiss Blue Topaz') },
  { subcategory: 'Tourmaline',       children: CUT_CHILDREN('Tourmaline') },
];

function haystack(product) {
  return [
    product.name, product.shapeRaw, product.cutType,
    product.treatment, product.gemstoneName, product.colorRaw,
  ].filter(Boolean).join(' ').toLowerCase();
}

function matches(product, matchGroups) {
  const hay = haystack(product);
  return matchGroups.some((group) => group.every((kw) => hay.includes(kw)));
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — nothing will be written; pass --commit to apply)'}\n`);

  let createdCount = 0;
  let skippedCount = 0;
  let productLinkTotal = 0;
  const notFoundSubcategories = [];

  for (const entry of TAXONOMY) {
    const sub = await Subcategory.findOne({
      name: new RegExp(`^${entry.subcategory}$`, 'i'),
      isActive: { $ne: false },
    }).lean();

    if (!sub) {
      notFoundSubcategories.push(entry.subcategory);
      console.log(`⚠️  Subcategory "${entry.subcategory}" not found in DB — skipping its ${entry.children.length} types`);
      continue;
    }

    console.log(`\n📁 ${entry.subcategory} (${sub._id})`);

    for (const [i, child] of entry.children.entries()) {
      const slug = slugify(child.name);
      const existing = await SubSubcategory.findOne({ slug, subcategory: sub._id }).lean();

      if (existing) {
        console.log(`   • ${child.name} — already exists, skipping create`);
        skippedCount++;
      } else if (COMMIT) {
        await SubSubcategory.create({
          name: child.name,
          slug,
          subcategory: sub._id,
          category: sub.category,
          sortOrder: i,
          isActive: true,
        });
        console.log(`   ✓ ${child.name} — created`);
        createdCount++;
      } else {
        console.log(`   + ${child.name} — would create`);
        createdCount++;
      }

      if (LINK_PRODUCTS) {
        const candidates = await Product.find({ subcategory: sub._id }).lean();
        const matchedIds = candidates
          .filter((p) => !p.subSubcategory) // never overwrite an existing assignment
          .filter((p) => matches(p, child.match))
          .map((p) => p._id);

        if (matchedIds.length > 0) {
          console.log(`     ↳ ${matchedIds.length} product(s) match "${child.name}"`);
          productLinkTotal += matchedIds.length;

          if (COMMIT) {
            const doc = existing ?? await SubSubcategory.findOne({ slug, subcategory: sub._id }).lean();
            if (doc) {
              await Product.updateMany(
                { _id: { $in: matchedIds } },
                { $set: { subSubcategory: doc._id } }
              );
            }
          }
        }
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Types ${COMMIT ? 'created' : 'that would be created'}: ${createdCount}`);
  console.log(`Types already present (skipped): ${skippedCount}`);
  if (LINK_PRODUCTS) {
    console.log(`Products ${COMMIT ? 'linked' : 'that would be linked'}: ${productLinkTotal}`);
  }
  if (notFoundSubcategories.length > 0) {
    console.log(`\n⚠️  These subcategory names weren't found in your DB (check spelling/casing against your real Subcategory collection):`);
    notFoundSubcategories.forEach((n) => console.log(`   - ${n}`));
  }
  if (!COMMIT) {
    console.log('\nThis was a dry run. Re-run with --commit to actually write the taxonomy.');
  }
  if (COMMIT && !LINK_PRODUCTS) {
    console.log('\nTaxonomy created. Re-run with --commit --link-products to also best-effort tag existing products.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
