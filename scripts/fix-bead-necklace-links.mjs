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

const BEAD_NECKLACES = TAXONOMY.find((e) => e.subcategory === 'Bead Necklaces');
if (!BEAD_NECKLACES) {
  console.error('❌ "Bead Necklaces" subcategory entry not found in TAXONOMY — did the taxonomy file change shape?');
  process.exit(1);
}
const ORDERED_CHILDREN = ['Sapphire Bead Necklaces', 'Ruby Bead Necklaces', 'Gemstone Bead Necklace']
  .map((name) => BEAD_NECKLACES.children.find((c) => c.name === name));
if (ORDERED_CHILDREN.some((c) => !c)) {
  console.error('❌ Could not find all three Bead Necklaces children in the taxonomy.');
  process.exit(1);
}

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ Connected to MongoDB${COMMIT ? '' : ' (DRY RUN — pass --commit to apply)'}\n`);

  const docs = new Map();
  for (const child of ORDERED_CHILDREN) {
    const doc = await SubSubcategory.findOne({ name: new RegExp(`^${child.name}$`, 'i') }).lean();
    if (!doc) {
      console.error(`❌ SubSubcategory "${child.name}" not found in DB.`);
      process.exit(1);
    }
    docs.set(child.name, doc);
  }

  const candidates = await Product.find({
    subSubcategory: { $in: [...docs.values()].map((d) => d._id) },
  }).lean();
  console.log(`Loaded ${candidates.length} product(s) currently across the three Bead Necklaces types.\n`);

  let moved = 0, alreadyCorrect = 0, unmatched = 0;
  const movedTo = new Map();
  const unmatchedList = [];

  for (const product of candidates) {
    const targetChild = ORDERED_CHILDREN.find((c) => matches(product, c.match));

    if (!targetChild) {
      unmatched++;
      unmatchedList.push({ id: product._id, name: product.name });
      continue;
    }

    const targetDoc = docs.get(targetChild.name);
    if (String(product.subSubcategory) === String(targetDoc._id)) {
      alreadyCorrect++;
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
    moved++;
    movedTo.set(targetChild.name, (movedTo.get(targetChild.name) || 0) + 1);
  }

  console.log('─'.repeat(60));
  console.log(`Products ${COMMIT ? 'moved' : 'that would be moved'}: ${moved}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Unmatched (skipped — matched none of the three patterns): ${unmatched}`);

  if (movedTo.size > 0) {
    console.log('\nMoved to:');
    for (const [name, count] of movedTo.entries()) console.log(`   ${count} — ${name}`);
  }

  if (unmatchedList.length > 0) {
    console.log('\nUnmatched products (check by hand):');
    for (const p of unmatchedList.slice(0, 25)) console.log(`   [${p.id}] ${p.name}`);
    if (unmatchedList.length > 25) console.log(`   … and ${unmatchedList.length - 25} more`);
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