/**
 * Seeds the third-level "type" taxonomy (SubSubcategory) under existing
 * Subcategories — e.g. Tanzanite → Oval Tanzanite / Trillion Tanzanite /
 * Calibrated Tanzanite / …, or Silver Jewelry → Silver Rings / Silver
 * Earrings / … — and (optionally) best-effort links existing products to
 * the right one by matching keywords against each product's
 * name/shapeRaw/cutType/treatment/gemstoneName/colorRaw/description.
 *
 * The taxonomy + matching logic lives in ./lib/subsubcategory-taxonomy.mjs
 * so it can be validated against real product data independently of Mongo
 * (see scripts/report-subsubcategory-counts.mjs for a read-only DB report,
 * or run the taxonomy module against an exported CSV for offline checks).
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
 * per subcategory in the admin UI, or run
 * scripts/report-subsubcategory-counts.mjs to see linked-product counts per
 * type and catch anything that's still empty.
 *
 * Requires MONGODB_URI in environment or .env / .env.local file.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { TAXONOMY, matches, slugify } from './lib/subsubcategory-taxonomy.mjs';

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
    description: String,
    isActive: Boolean,
  },
  { strict: false }
);

const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const SubSubcategory = mongoose.models.SubSubcategory || mongoose.model('SubSubcategory', SubSubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

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
