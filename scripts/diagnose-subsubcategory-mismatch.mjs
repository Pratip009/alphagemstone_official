/**
 * Finds products whose stored categoryPath / subcategory2Raw string says
 * one subSubcategory, but whose actual `subSubcategory` ObjectId field
 * points to a DIFFERENT one — almost certainly because the original bulk
 * importer inferred subSubcategory from parsed shape/attribute fields
 * instead of the legacy category path.
 *
 * READ-ONLY. Prints a summary grouped by (wrong name -> correct name).
 *
 * USAGE:
 *   node scripts/diagnose-subsubcategory-mismatch.mjs
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

const SubSubcategorySchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });

const SubSubcategory = mongoose.model('SubSubcategory', SubSubcategorySchema, 'subsubcategories');
const Product = mongoose.model('Product', ProductSchema, 'products');

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const allSubSub = await SubSubcategory.find({}).lean();
  const subSubById = new Map(allSubSub.map((s) => [String(s._id), s]));
  // name -> _id, scoped loosely (name alone; good enough since names are
  // distinct across the taxonomy in this catalog)
  const subSubIdByName = new Map(allSubSub.map((s) => [s.name.trim().toLowerCase(), s]));

  const cursor = Product.find(
    { categoryPath: { $exists: true, $ne: '' } },
    { name: 1, categoryPath: 1, subcategory2Raw: 1, subSubcategory: 1, legacyProductId: 1 }
  ).cursor();

  let total = 0;
  let mismatched = 0;
  let noSubSubField = 0;
  let correctSubSubNotFound = 0;
  const mismatchGroups = new Map(); // "wrongName -> correctName" -> count
  const examples = new Map(); // group key -> first example

  for await (const doc of cursor) {
    total++;
    const pathParts = String(doc.categoryPath).split('>').map((s) => s.trim());
    const impliedName = pathParts[pathParts.length - 1];
    if (!impliedName) continue;

    const impliedSubSub = subSubIdByName.get(impliedName.toLowerCase());
    if (!impliedSubSub) {
      correctSubSubNotFound++;
      continue;
    }

    if (!doc.subSubcategory) {
      noSubSubField++;
      continue;
    }

    const actualSubSub = subSubById.get(String(doc.subSubcategory));
    const actualName = actualSubSub ? actualSubSub.name : '(unknown/deleted)';

    if (String(doc.subSubcategory) !== String(impliedSubSub._id)) {
      mismatched++;
      const key = `${actualName}  →  ${impliedName}`;
      mismatchGroups.set(key, (mismatchGroups.get(key) || 0) + 1);
      if (!examples.has(key)) {
        examples.set(key, { name: doc.name, legacyProductId: doc.legacyProductId });
      }
    }
  }

  console.log(`Scanned ${total} product(s) with a categoryPath.\n`);
  console.log(`Mismatched (linked to wrong subSubcategory): ${mismatched}`);
  console.log(`Missing subSubcategory field entirely: ${noSubSubField}`);
  console.log(`categoryPath's implied subSubcategory name not found in taxonomy: ${correctSubSubNotFound}`);

  if (mismatchGroups.size > 0) {
    console.log('\nMismatch groups (currently-linked → should-be-linked), sorted by size:');
    const sorted = [...mismatchGroups.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted) {
      const ex = examples.get(key);
      console.log(`   ${count.toString().padStart(4)}  ${key}   e.g. "${ex.name}" (legacyProductId ${ex.legacyProductId})`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
