// quick-diagnose.mjs
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));

await mongoose.connect(process.env.MONGODB_URI);

const total = await Product.countDocuments({});
const colorEmpty = await Product.countDocuments({
  $or: [
    { color: { $exists: false } },
    { color: null },
    { color: '' },
    { color: { $size: 0 } },
  ],
});
const colorHasValue = await Product.countDocuments({
  color: { $exists: true, $not: { $size: 0 }, $nin: [null, ''] },
});
const colorRawButColorEmpty = await Product.countDocuments({
  colorRaw: { $exists: true, $nin: [null, ''] },
  $or: [
    { color: { $exists: false } },
    { color: null },
    { color: '' },
    { color: { $size: 0 } },
  ],
});

// sample a few docs that have colorRaw
const samples = await Product.find({ colorRaw: { $exists: true, $nin: [null, ''] } })
  .select({ color: 1, colorRaw: 1, clarity: 1, clarityRaw: 1, approxWeight: 1, shape: 1, size: 1 })
  .limit(5)
  .lean();

console.log({ total, colorEmpty, colorHasValue, colorRawButColorEmpty });
console.log('Samples:', JSON.stringify(samples, null, 2));

await mongoose.disconnect();