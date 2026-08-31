import mongoose from 'mongoose';
import { config } from 'dotenv';
import { TAXONOMY, matches } from './lib/subsubcategory-taxonomy.mjs';

config({ path: '.env.local' });
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set (checked .env.local and .env)');
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');

const SILVER_JEWELRY = TAXONOMY.find((e) => e.subcategory === 'Silver Jewelry');
if (!SILVER_JEWELRY) {
  console.error('❌ "Silver Jewelry" subcategory entry not found in TAXONOMY — did the taxonomy file change shape?');
  process.exit(1);
}
const GEMSTONE_CHILD = SILVER_JEWELRY.children.find((c) => c.name === 'Gemstone Silver Earrings');
const PLAIN_CHILD = SILVER_JEWELRY.children.find((c) => c.name === 'Silver Earrings');
if (!GEMSTONE_CHILD || !PLAIN_CHILD) {
  console.error('❌ Could not find both "Gemstone Silver Earrings" and "Silver Earrings" children in the taxonomy.');
  process.exit(1);
}

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}\n`);

  const gemDoc = await SubSubcategory.findOne({ name: /^Gemstone Silver Earrings$/i }).lean();
  const plainDoc = await SubSubcategory.findOne({ name: /^Silver Earrings$/i }).lean();
  if (!gemDoc || !plainDoc) {
    console.error('❌ One or both SubSubcategory docs not found in DB:',
      { gemDoc: !!gemDoc, plainDoc: !!plainDoc });
    process.exit(1);
  }

  const candidates = await Product.find({
    subSubcategory: { $in: [gemDoc._id, plainDoc._id] },
  }).lean();
  console.log(`Loaded ${candidates.length} product(s) currently in Silver Earrings / Gemstone Silver Earrings.\n`);

  let movedToPlain = 0, movedToGem = 0, alreadyCorrect = 0, ambiguous = 0;
  const ambiguousList = [];

  for (const product of candidates) {
    const isGemMatch = matches(product, GEMSTONE_CHILD.match);
    const isPlainMatch = matches(product, PLAIN_CHILD.match);

    const targetDoc = isGemMatch ? gemDoc : plainDoc;
    const currentId = String(product.subSubcategory);

    if (currentId === String(targetDoc._id)) {
      alreadyCorrect++;
      continue;
    }

    if (!isGemMatch && !isPlainMatch) {
      ambiguous++;
      ambiguousList.push({ id: product._id, name: product.name });
      continue;
    }

    if (COMMIT) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            subSubcategory: targetDoc._id,
            subcategory2Raw: targetDoc.name,
            category: targetDoc.category,
            subcategory: targetDoc.subcategory,
          },
        }
      );
    }
    if (isGemMatch) movedToGem++; else movedToPlain++;
  }

  console.log('─'.repeat(60));
  console.log(`Moved to "Silver Earrings":            ${movedToPlain}`);
  console.log(`Moved to "Gemstone Silver Earrings":    ${movedToGem}`);
  console.log(`Already correct:                        ${alreadyCorrect}`);
  console.log(`Ambiguous (matched neither — skipped):  ${ambiguous}`);

  if (ambiguousList.length > 0) {
    console.log('\nAmbiguous products (matched neither pattern — check by hand):');
    for (const p of ambiguousList.slice(0, 25)) console.log(`   [${p.id}] ${p.name}`);
    if (ambiguousList.length > 25) console.log(`   … and ${ambiguousList.length - 25} more`);
  }

  if (!COMMIT) {
    console.log('\nThis was a dry run. Re-run with --commit to actually write.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});