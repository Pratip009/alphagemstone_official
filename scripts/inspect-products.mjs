/**
 * Read-only inspector — run with: node scripts/inspect-products.mjs
 * Makes NO writes. Just prints real sample documents so we can see the
 * actual shape of shape/size/color/clarity/approxWeight/isActive/productKind
 * on your live data.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Aborting.');
  process.exit(1);
}

const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to db:', mongoose.connection.name);

  const FIELDS = 'name productKind isActive shape size color colorRaw clarity clarityRaw approxWeight numberOfStones legacyAttributes category subcategory';

  console.log('\n=== 5 sample products with colorRaw set ===');
  const withColor = await Product.find({ colorRaw: { $exists: true, $nin: [null, ''] } }).select(FIELDS).limit(5).lean();
  withColor.forEach((d) => console.log(JSON.stringify(d, null, 2)));

  console.log('\n=== 5 sample products with clarityRaw set ===');
  const withClarity = await Product.find({ clarityRaw: { $exists: true, $nin: [null, ''] } }).select(FIELDS).limit(5).lean();
  withClarity.forEach((d) => console.log(JSON.stringify(d, null, 2)));

  console.log('\n=== productKind breakdown ===');
  const kinds = await Product.aggregate([{ $group: { _id: '$productKind', count: { $sum: 1 } } }]);
  console.log(kinds);

  console.log('\n=== isActive breakdown ===');
  const active = await Product.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]);
  console.log(active);

  console.log('\n=== color field type breakdown (typeof / isArray) ===');
  const sample = await Product.find({ color: { $exists: true } }).select('color').limit(2000).lean();
  let arrCount = 0, otherCount = 0, emptyArrCount = 0;
  sample.forEach((d) => {
    if (Array.isArray(d.color)) {
      if (d.color.length === 0) emptyArrCount++; else arrCount++;
    } else {
      otherCount++;
    }
  });
  console.log({ nonEmptyArray: arrCount, emptyArray: emptyArrCount, nonArrayValue: otherCount, sampledOf: sample.length });

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
