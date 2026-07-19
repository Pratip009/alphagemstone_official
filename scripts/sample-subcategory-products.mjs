/**
 * Prints a sample of product names (+ a few key attributes) from one or
 * more subcategories, so you can eyeball whether the subcategory is
 * genuinely uniform (safe for shared images) or a mixed grab-bag (NOT safe
 * for shared images — e.g. a "Deals and Steals" clearance bin mixing many
 * gemstone types).
 *
 * USAGE:
 *   node scripts/sample-subcategory-products.mjs --subcategory "Semi Precious Deals And Steals"
 *   node scripts/sample-subcategory-products.mjs --slug semi-precious-deals-and-steals --limit 30
 *   node scripts/sample-subcategory-products.mjs --slug silver-jewelry,semi-precious-deals-and-steals,precious-gems-deals-and-steals
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const subcategoryArg = getArg('subcategory');
const slugArg = getArg('slug');
const limit = parseInt(getArg('limit') ?? '25', 10);

if (!subcategoryArg && !slugArg) {
  console.error(
    'Usage: node scripts/sample-subcategory-products.mjs --slug semi-precious-deals-and-steals[,other-slug,...] [--limit 25]\n' +
      '   or: node scripts/sample-subcategory-products.mjs --subcategory "Exact Name"'
  );
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const SubcategorySchema = new mongoose.Schema({ name: String, slug: String });
const ProductSchema = new mongoose.Schema(
  {
    name: String,
    subcategory: mongoose.Schema.Types.ObjectId,
    gemstoneName: String,
    shapeRaw: String,
    legacyAttributes: mongoose.Schema.Types.Mixed,
  },
  { strict: false }
);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function sampleOne(subcategory, limit) {
  const total = await Product.countDocuments({ subcategory: subcategory._id });

  // Take an evenly-spread sample across the collection (not just the first
  // N, which could all be one legacy import batch) using $sample.
  const sample = await Product.aggregate([
    { $match: { subcategory: subcategory._id } },
    { $sample: { size: Math.min(limit, total) } },
    { $project: { name: 1, gemstoneName: 1, shapeRaw: 1, 'legacyAttributes.legacyCategoryRaw': 1 } },
  ]);

  console.log(`\n=== "${subcategory.name}" (slug: ${subcategory.slug}) — ${total} total product(s) ===`);
  console.log(`Random sample of ${sample.length}:\n`);
  for (const p of sample) {
    const gem = p.gemstoneName ? ` | gemstoneName: ${p.gemstoneName}` : '';
    const legacyCat = p.legacyAttributes?.legacyCategoryRaw ? ` | legacyCategory: ${p.legacyAttributes.legacyCategoryRaw}` : '';
    console.log(`  - ${p.name}${gem}${legacyCat}`);
  }

  // Quick heuristic: distinct first-words / gemstoneName values, as a rough
  // "how mixed is this really" signal.
  const distinctGemstoneNames = new Set(sample.map((p) => p.gemstoneName).filter(Boolean));
  if (distinctGemstoneNames.size > 1) {
    console.log(`\n  ⚠️  ${distinctGemstoneNames.size} distinct gemstoneName values in this sample: ${[...distinctGemstoneNames].join(', ')}`);
    console.log('     This subcategory looks MIXED — a single shared image set would misrepresent most products.');
  } else if (distinctGemstoneNames.size === 1) {
    console.log(`\n  ✅ Sample all shares gemstoneName: "${[...distinctGemstoneNames][0]}" — looks uniform.`);
  } else {
    console.log(`\n  ℹ️  No gemstoneName field populated on these — judge by the product names above instead.`);
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const subcategories = [];

  if (slugArg) {
    for (const slug of slugArg.split(',').map((s) => s.trim().toLowerCase())) {
      const sub = await Subcategory.findOne({ slug }).lean();
      if (!sub) {
        console.error(`❌ No subcategory found for slug "${slug}"`);
        continue;
      }
      subcategories.push(sub);
    }
  }

  if (subcategoryArg) {
    const sub = await Subcategory.findOne({ name: new RegExp(`^${subcategoryArg.trim()}$`, 'i') }).lean();
    if (!sub) {
      console.error(`❌ No subcategory found matching "${subcategoryArg}"`);
    } else {
      subcategories.push(sub);
    }
  }

  for (const sub of subcategories) {
    await sampleOne(sub, limit);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
