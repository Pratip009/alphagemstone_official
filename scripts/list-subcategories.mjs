/**
 * Lists every subcategory in the DB with its product count and the expected
 * local-folder-name (slug) to use for the batch image replacement script.
 * Writes a CSV to scripts/subcategory-report.csv so you can plan which
 * subcategories to tackle first (e.g. sort by product count).
 *
 * USAGE:
 *   node scripts/list-subcategories.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const CategorySchema = new mongoose.Schema({ name: String, slug: String });
const SubcategorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  category: mongoose.Schema.Types.ObjectId,
});
const ProductSchema = new mongoose.Schema(
  { subcategory: mongoose.Schema.Types.ObjectId, category: mongoose.Schema.Types.ObjectId },
  { strict: false }
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const categories = await Category.find().lean();
  const categoryMap = new Map(categories.map((c) => [String(c._id), c.name]));

  const subcategories = await Subcategory.find().lean();

  const counts = await Product.aggregate([
    { $match: { subcategory: { $ne: null } } },
    { $group: { _id: '$subcategory', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  // Also count products with NO subcategory, grouped by category
  const noSubcatCounts = await Product.aggregate([
    { $match: { subcategory: null } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const rows = subcategories
    .map((s) => ({
      category: categoryMap.get(String(s.category)) ?? 'Unknown',
      subcategory: s.name,
      slug: s.slug,
      productCount: countMap.get(String(s._id)) ?? 0,
    }))
    .sort((a, b) => b.productCount - a.productCount);

  console.log(`Found ${rows.length} subcategories:\n`);
  console.log('Product Count | Category            | Subcategory                  | Folder name to use (slug)');
  console.log('-'.repeat(110));
  for (const r of rows) {
    console.log(
      `${String(r.productCount).padStart(13)} | ${r.category.padEnd(20)} | ${r.subcategory.padEnd(29)} | ${r.slug}`
    );
  }

  if (noSubcatCounts.length > 0) {
    console.log(`\n⚠️  Products with NO subcategory assigned (not covered by this workflow):`);
    for (const nc of noSubcatCounts) {
      console.log(`   ${categoryMap.get(String(nc._id)) ?? nc._id}: ${nc.count} product(s)`);
    }
  }

  const totalWithSubcat = rows.reduce((sum, r) => sum + r.productCount, 0);
  console.log(`\nTotal products in a subcategory: ${totalWithSubcat}`);

  // Write CSV
  const csvPath = path.resolve(process.cwd(), 'scripts', 'subcategory-report.csv');
  const csvLines = ['category,subcategory,slug,productCount'];
  for (const r of rows) {
    csvLines.push(
      [r.category, r.subcategory, r.slug, r.productCount]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`\n📄 Full report written to ${csvPath}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
