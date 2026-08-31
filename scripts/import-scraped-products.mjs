/**
 * Imports the JSON produced by scrape-missing-products.mjs into MongoDB as
 * real Product documents, linked to the correct category / subcategory /
 * subSubcategory ObjectIds.
 *
 * DRY-RUN by default. Pass --commit to actually write.
 *
 * USAGE:
 *   node scripts/import-scraped-products.mjs --file scripts/output/scraped-products.json
 *   node scripts/import-scraped-products.mjs --file scripts/output/scraped-products.json --commit
 *
 * Requires MONGODB_URI in environment or .env / .env.local file.
 */

import fs from 'node:fs';
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
const FILE_ARG_IDX = process.argv.indexOf('--file');
const FILE_PATH = FILE_ARG_IDX !== -1 ? process.argv[FILE_ARG_IDX + 1] : 'scripts/output/scraped-products.json';

if (!fs.existsSync(FILE_PATH)) {
  console.error(`❌ File not found: ${FILE_PATH}`);
  console.error('   Run scrape-missing-products.mjs first, or pass --file <path>.');
  process.exit(1);
}

const CategorySchema = new mongoose.Schema({ name: String, slug: String });
const SubcategorySchema = new mongoose.Schema({
  name: String, slug: String, category: mongoose.Schema.Types.ObjectId, isActive: Boolean,
});
const SubSubcategorySchema = new mongoose.Schema({
  name: String, slug: String,
  subcategory: mongoose.Schema.Types.ObjectId,
  category: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
});
const ProductSchema = new mongoose.Schema(
  {
    name: String, category: mongoose.Schema.Types.ObjectId, subcategory: mongoose.Schema.Types.ObjectId,
    subSubcategory: mongoose.Schema.Types.ObjectId,
    price: Number, images: [String], stock: Number, isActive: Boolean,
    legacyProductId: Number,
  },
  { strict: false }
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const SubSubcategory = mongoose.models.SubSubcategory || mongoose.model('SubSubcategory', SubSubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const PROGRESS_EVERY = 25;

async function main() {
  const items = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  console.log(`Loaded ${items.length} scraped product(s) from ${FILE_PATH}`);

  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — nothing will be written; pass --commit to apply)'}\n`);

  // Cache resolved category/subcategory/subSubcategory docs by name-path so
  // we only look each one up once.
  const cache = new Map();
  async function resolveTaxonomy(categoryName, subcategoryName, subSubcategoryName) {
    const key = `${categoryName}>${subcategoryName}>${subSubcategoryName}`;
    if (cache.has(key)) return cache.get(key);

    const category = await Category.findOne({ name: new RegExp(`^${categoryName}$`, 'i') }).lean();
    if (!category) {
      cache.set(key, null);
      return null;
    }
    const subcategory = await Subcategory.findOne({
      name: new RegExp(`^${subcategoryName}$`, 'i'),
      category: category._id,
    }).lean();
    if (!subcategory) {
      cache.set(key, null);
      return null;
    }
    const subSubcategory = await SubSubcategory.findOne({
      name: new RegExp(`^${subSubcategoryName}$`, 'i'),
      subcategory: subcategory._id,
    }).lean();
    if (!subSubcategory) {
      cache.set(key, null);
      return null;
    }
    const resolved = { category, subcategory, subSubcategory };
    cache.set(key, resolved);
    return resolved;
  }

  let created = 0, skippedExisting = 0, skippedNoTaxonomy = 0, skippedNoPrice = 0, processed = 0;
  const missingTaxonomy = new Set();
  const startedAt = Date.now();

  for (const item of items) {
    processed++;

    if (!item.price || item.price <= 0) {
      skippedNoPrice++;
    } else {
      const resolved = await resolveTaxonomy(item.category, item.subcategory, item.subSubcategory);
      if (!resolved) {
        missingTaxonomy.add(`${item.category} > ${item.subcategory} > ${item.subSubcategory}`);
        skippedNoTaxonomy++;
      } else {
        const legacyProductId = item.legacyProductId ? parseInt(item.legacyProductId, 10) : undefined;
        let existing = null;
        if (legacyProductId) {
          existing = await Product.findOne({ legacyProductId }).lean();
        }
        if (existing) {
          skippedExisting++;
        } else {
          if (COMMIT) {
            await Product.create({
              name: item.name,
              price: item.price,
              category: resolved.category._id,
              subcategory: resolved.subcategory._id,
              subSubcategory: resolved.subSubcategory._id,
              legacyProductId,
              images: [],
              stock: 1,
              isActive: true,
            });
          }
          created++;
        }
      }
    }

    if (processed % PROGRESS_EVERY === 0 || processed === items.length) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `   ${processed}/${items.length} processed — created ${created}, skipped (existing) ${skippedExisting}, ` +
        `skipped (no taxonomy) ${skippedNoTaxonomy}, skipped (no price) ${skippedNoPrice}  [${elapsedSec}s elapsed]`
      );
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Products ${COMMIT ? 'created' : 'that would be created'}: ${created}`);
  console.log(`Skipped (already imported, matched by legacyProductId): ${skippedExisting}`);
  console.log(`Skipped (missing/zero price): ${skippedNoPrice}`);
  console.log(`Skipped (taxonomy not found in DB): ${skippedNoTaxonomy}`);
  if (missingTaxonomy.size > 0) {
    console.log('\n⚠️  These category > subcategory > subSubcategory paths were not found in your DB:');
    missingTaxonomy.forEach((p) => console.log(`   - ${p}`));
  }
  if (!COMMIT) {
    console.log('\nThis was a dry run. Re-run with --commit to actually write the products.');
  }
  console.log('\nNote: images were not scraped (out of scope for this script) — products are');
  console.log('created with an empty images array. Add images separately, e.g. via the admin UI');
  console.log('or a follow-up image-scraping pass against each product\'s legacyProductId URL.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
