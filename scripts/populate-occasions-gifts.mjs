/**
 * Populates the (currently empty) Occasions & Gifts subcategories with 50
 * random, thematically-related products each — WITHOUT moving those
 * products out of their real category. A product picked for
 * "Valentine Jewelry" e.g. stays filed under Jewelry > Gemstone Rings; it's
 * just additionally cross-listed via Product.crossListedSubcategoryIds
 * (see src/models/Product.ts + buildProductFilterQuery() in
 * src/services/productFilter.service.ts for how that field is matched).
 *
 * Target subcategories (must already exist under the "Occasions and gifts"
 * category — this script does NOT create categories/subcategories, only
 * cross-lists existing products onto existing ones):
 *   anniversary, birthday-birthstone, christmas-jewelry,
 *   mother-s-day-jewelry, thanksgiving-jewelry, valentine-jewelry,
 *   wedding-jewelry
 *
 * Usage:
 *   MONGODB_URI="your-connection-string" node scripts/populate-occasions-gifts.mjs
 *
 * Optional flags:
 *   --count=50     how many products to cross-list per subcategory (default 50)
 *   --dry-run      show what would be picked/counted without writing anything
 *   --reset        clear crossListedSubcategoryIds for these 7 subcategories
 *                  first, so re-running gives a fresh random sample instead
 *                  of only topping up
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
config();
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Set it in your environment or .env(.local) file.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reset = args.includes('--reset');
const countArg = args.find((a) => a.startsWith('--count='));
const COUNT_PER_SUBCATEGORY = countArg ? parseInt(countArg.split('=')[1], 10) : 50;

// ─── Minimal schemas (strict:false — we only need the fields we touch) ──────
const Category = mongoose.models.Category || mongoose.model(
  'Category',
  new mongoose.Schema({}, { strict: false, collection: 'categories' })
);
const Subcategory = mongoose.models.Subcategory || mongoose.model(
  'Subcategory',
  new mongoose.Schema({}, { strict: false, collection: 'subcategories' })
);
const Product = mongoose.models.Product || mongoose.model(
  'Product',
  new mongoose.Schema({}, { strict: false, collection: 'products' })
);

// ─── Occasion → "what counts as related" ────────────────────────────────────
// Each rule is a list of Mongo match clauses; a product qualifies if it
// matches ANY clause (OR'd together) — matching is done against real
// product fields (category/subcategory NAME via a resolved id list, color,
// gemstoneName, shape, productKind), not against the target occasion
// subcategory itself.
const OCCASION_RULES = {
  'anniversary': {
    subcategoryNamePattern: /ring|band|eternity|necklace|pendant/i,
    categoryNames: ['Diamonds'],
  },
  'birthday-birthstone': {
    // Broad: any loose/set colored gemstone — a "pick your birthstone" gift category.
    categoryNames: ['Precious Gems', 'Semi Precious'],
    gemstoneNamePattern: /garnet|amethyst|aquamarine|emerald|pearl|alexandrite|ruby|peridot|sapphire|opal|tourmaline|topaz|citrine|turquoise|zircon|tanzanite|diamond/i,
  },
  'christmas-jewelry': {
    colors: ['Red', 'Green'],
    gemstoneNamePattern: /ruby|emerald|garnet|tsavorite/i,
    subcategoryNamePattern: /ring|necklace|pendant|earring|bracelet/i,
    categoryNames: ['Jewelry'],
  },
  'mother-s-day-jewelry': {
    gemstoneNamePattern: /pearl/i,
    subcategoryNamePattern: /necklace|pendant|earring|bracelet|silver/i,
    categoryNames: ['Jewelry'],
  },
  'thanksgiving-jewelry': {
    colors: ['Orange', 'Brown', 'Champagne', 'Cognac', 'Yellow'],
    gemstoneNamePattern: /citrine|topaz|garnet|tourmaline|amber|quartz/i,
    categoryNames: ['Semi Precious'],
  },
  'valentine-jewelry': {
    colors: ['Red', 'Pink'],
    gemstoneNamePattern: /ruby|pink sapphire|pink tourmaline|rhodolite|garnet/i,
    shapes: ['heart'],
    subcategoryNamePattern: /ring|pink diamond|red diamond/i,
  },
  'wedding-jewelry': {
    categoryNames: ['Diamonds'],
    subcategoryNamePattern: /ring|band|solitaire|certified|white diamond/i,
    categoryNamesSecondary: ['Jewelry'],
  },
};

const TARGET_SLUGS = Object.keys(OCCASION_RULES);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const occasionsCategory = await Category.findOne({ slug: 'occasions-and-gifts' }).lean();
  if (!occasionsCategory) {
    console.error('❌ No Category with slug "occasions-and-gifts" found. Create it first.');
    process.exit(1);
  }

  const targetSubs = await Subcategory.find({ slug: { $in: TARGET_SLUGS } }).lean();
  const foundSlugs = new Set(targetSubs.map((s) => s.slug));
  const missing = TARGET_SLUGS.filter((s) => !foundSlugs.has(s));
  if (missing.length) {
    console.warn(`⚠️  These subcategory slugs were not found and will be skipped: ${missing.join(', ')}`);
  }

  // Real category name → id, real subcategory (id + name) list, for building
  // relevance queries against the ACTUAL product taxonomy.
  const allCategories = await Category.find({}).select('_id name').lean();
  const catNameToId = new Map(allCategories.map((c) => [c.name, c._id]));

  const allSubcats = await Subcategory.find({}).select('_id name').lean();

  if (reset && !dryRun) {
    const ids = targetSubs.map((s) => s._id);
    const r = await Product.updateMany(
      { crossListedSubcategoryIds: { $in: ids } },
      { $pull: { crossListedSubcategoryIds: { $in: ids } } }
    );
    console.log(`🔄 --reset: cleared cross-listing on ${r.modifiedCount} product(s) for these subcategories\n`);
  }

  for (const sub of targetSubs) {
    const rule = OCCASION_RULES[sub.slug];
    console.log(`\n── ${sub.name} (${sub.slug}) ──`);

    const orClauses = [];

    if (rule.categoryNames) {
      const ids = rule.categoryNames.map((n) => catNameToId.get(n)).filter(Boolean);
      if (ids.length) orClauses.push({ category: { $in: ids } });
    }
    if (rule.categoryNamesSecondary) {
      const ids = rule.categoryNamesSecondary.map((n) => catNameToId.get(n)).filter(Boolean);
      if (ids.length) orClauses.push({ category: { $in: ids } });
    }
    if (rule.subcategoryNamePattern) {
      const ids = allSubcats
        .filter((s) => rule.subcategoryNamePattern.test(s.name))
        .map((s) => s._id);
      if (ids.length) orClauses.push({ subcategory: { $in: ids } });
    }
    if (rule.colors) {
      orClauses.push({ color: { $in: rule.colors } });
    }
    if (rule.shapes) {
      orClauses.push({ shape: { $in: rule.shapes } });
    }
    if (rule.gemstoneNamePattern) {
      orClauses.push({ gemstoneName: { $regex: rule.gemstoneNamePattern } });
    }

    if (orClauses.length === 0) {
      console.log('   (no rule clauses resolved — skipping)');
      continue;
    }

    const baseMatch = {
      isActive: true,
      $or: orClauses,
      // Don't cross-list something that's already cross-listed here.
      crossListedSubcategoryIds: { $ne: sub._id },
    };

    const poolSize = await Product.countDocuments(baseMatch);
    console.log(`   Candidate pool: ${poolSize} related product(s)`);

    if (poolSize === 0) {
      console.log('   Nothing matched this rule — widen OCCASION_RULES for this slug.');
      continue;
    }

    const sample = await Product.aggregate([
      { $match: baseMatch },
      { $sample: { size: Math.min(COUNT_PER_SUBCATEGORY, poolSize) } },
      { $project: { _id: 1, name: 1 } },
    ]);

    console.log(`   Selected ${sample.length} product(s) for cross-listing`);
    if (dryRun) {
      sample.slice(0, 5).forEach((p) => console.log(`     e.g. ${p.name}`));
      if (sample.length > 5) console.log(`     ...and ${sample.length - 5} more`);
      continue;
    }

    const ids = sample.map((p) => p._id);
    const result = await Product.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { crossListedSubcategoryIds: sub._id } }
    );
    console.log(`   ✅ Cross-listed ${result.modifiedCount} product(s) under "${sub.name}"`);
  }

  await mongoose.disconnect();
  console.log(dryRun ? '\n--dry-run set, no changes written.' : '\nDone.');
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});