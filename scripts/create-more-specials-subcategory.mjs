/**
 * Recreate the "More Specials" subcategory under "Specials" and move the
 * 40 products that belonged there on the legacy site (alphaimports.com/specials.php)
 * into it.
 *
 * The legacy site's nav has 5 entries under Specials: Alpha Specials,
 * Diamond Specials, Gemstone Specials, Jewelry Specials, and "More Specials"
 * (a distinct nav link → specials.php, "Displaying 1 to 40 of 40 products").
 * Only the first four were migrated into this app's Subcategory collection —
 * "More Specials" was missed. This script fixes that.
 *
 * The 40 products are identified by their legacyProductId (scraped directly
 * from alphaimports.com/specials.php, pages 1-4). They currently sit under
 * other categories (mostly Precious Gems > Precious gems deals and steals,
 * plus a handful of single-stone Diamond color subcategories) — this script
 * moves them (updates their category + subcategory fields), it does not
 * duplicate them.
 *
 * Safe to run repeatedly: the subcategory is upserted on (slug, category),
 * and each product update is a targeted $set by _id.
 *
 * Usage:
 *   MONGODB_URI=... node scripts/create-more-specials-subcategory.mjs
 *   MONGODB_URI=... node scripts/create-more-specials-subcategory.mjs --dry-run
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Aborting — refusing to run against no database.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Minimal inline schemas (mirrors src/models/*.ts, kept dependency-free
// so this script runs under plain node — same pattern as scripts/seed.mjs
// and scripts/import-category-filters.mjs) ─────────────────────────────────
const CategorySchema = new mongoose.Schema({ name: String, slug: String });
const SubcategorySchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    category: mongoose.Schema.Types.ObjectId,
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const ProductSchema = new mongoose.Schema(
  {
    legacyProductId: Number,
    category: mongoose.Schema.Types.ObjectId,
    subcategory: mongoose.Schema.Types.ObjectId,
  },
  { strict: false } // don't clobber the real schema's other fields
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

// The 40 legacy product IDs from alphaimports.com/specials.php (pages 1-4,
// "Displaying 1 to 40 of 40 products"), scraped 2026-08-25.
const LEGACY_PRODUCT_IDS = [
  21553, 21551, 21550, 21549, 21554, 21555, 21559, 21466, 21464, 21460, 21458, 21455,
  21452, 21451, 21450, 21186, 21183, 21182, 21180, 21179, 21465, 21543, 21471, 21181,
  21454, 21188, 21545, 21462, 21457, 21456, 21185, 33980, 21435, 32267, 35000, 26326,
  20157, 36700, 34993, 35128,
];

async function main() {
  console.log(`🔌 Connecting to MongoDB${DRY_RUN ? ' (dry run — no writes)' : ''}...`);
  await mongoose.connect(MONGODB_URI);

  const specialsCategory = await Category.findOne({ slug: 'specials' }).lean();
  if (!specialsCategory) {
    console.error('❌ Could not find the "Specials" category (slug: specials). Aborting.');
    process.exit(1);
  }
  console.log(`✅ Found Specials category: ${specialsCategory._id}`);

  // 1. Upsert the "More Specials" subcategory
  let moreSpecials = await Subcategory.findOne({
    slug: 'more-specials',
    category: specialsCategory._id,
  });

  if (moreSpecials) {
    console.log(`ℹ️  "More Specials" subcategory already exists: ${moreSpecials._id}`);
  } else {
    console.log('➕ Creating "More Specials" subcategory...');
    if (!DRY_RUN) {
      moreSpecials = await Subcategory.create({
        name: 'More Specials',
        slug: 'more-specials',
        category: specialsCategory._id,
        description: 'Extra special deals and wholesale lots.',
        isActive: true,
      });
    }
    console.log(`✅ Created${DRY_RUN ? ' (simulated)' : ''}: ${moreSpecials?._id ?? '(dry run, no id yet)'}`);
  }

  // 2. Find the 40 products and report where they currently live
  const products = await Product.find({ legacyProductId: { $in: LEGACY_PRODUCT_IDS } }).lean();
  console.log(`\n🔎 Found ${products.length} / ${LEGACY_PRODUCT_IDS.length} products by legacyProductId.`);

  const foundIds = new Set(products.map((p) => p.legacyProductId));
  const missing = LEGACY_PRODUCT_IDS.filter((id) => !foundIds.has(id));
  if (missing.length) {
    console.warn(`⚠️  Missing from DB (not found by legacyProductId): ${missing.join(', ')}`);
  }

  // 3. Move each product into Specials > More Specials
  let moved = 0;
  let alreadyThere = 0;
  for (const p of products) {
    const alreadyCorrect =
      String(p.category) === String(specialsCategory._id) &&
      moreSpecials &&
      String(p.subcategory) === String(moreSpecials._id);

    if (alreadyCorrect) {
      alreadyThere++;
      continue;
    }

    console.log(
      `  → [${p.legacyProductId}] "${p.name}" moving into Specials / More Specials`
    );
    if (!DRY_RUN && moreSpecials) {
      await Product.updateOne(
        { _id: p._id },
        { $set: { category: specialsCategory._id, subcategory: moreSpecials._id } }
      );
    }
    moved++;
  }

  console.log(
    `\n${DRY_RUN ? '🧪 Dry run complete.' : '✅ Done.'} ${moved} product(s) ${DRY_RUN ? 'would be' : 'were'} moved, ${alreadyThere} already in place.`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
