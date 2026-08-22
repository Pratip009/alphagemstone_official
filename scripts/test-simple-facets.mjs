import mongoose from 'mongoose';
import { config } from 'dotenv';

console.log('1. Script started');

config({ path: '.env' });
config({ path: '.env.local', override: true });

console.log('2. Env loaded');
console.log('   MONGODB_URI exists?', !!process.env.MONGODB_URI);
console.log('   MONGODB_URI starts with:', process.env.MONGODB_URI?.slice(0, 20) || 'UNDEFINED');

const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));

try {
  console.log('3. Connecting...');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // fail fast instead of hanging
  });
  console.log('4. Connected successfully');
} catch (err) {
  console.error('CONNECTION FAILED:', err.message);
  process.exit(1);
}

const isActiveCount = await Product.countDocuments({ isActive: true });
const shapePopulated = await Product.countDocuments({
  isActive: true,
  shape: { $exists: true, $not: { $size: 0 } },
});
const colorPopulated = await Product.countDocuments({
  isActive: true,
  color: { $exists: true, $not: { $size: 0 } },
});
const sizePopulated = await Product.countDocuments({
  isActive: true,
  size: { $exists: true, $nin: [null, ''] },
});

console.log({ isActiveCount, shapePopulated, colorPopulated, sizePopulated });

// ... rest of your facet pipeline stays the same ...

const pipeline = [
  {
    $facet: {
      shape: [
        { $match: { isActive: true, shape: { $exists: true, $not: { $size: 0 } } } },
        { $unwind: '$shape' },
        { $group: { _id: '$shape', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      size: [
        { $match: { isActive: true, size: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$size', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      color: [
        { $match: { isActive: true, color: { $exists: true, $not: { $size: 0 } } } },
        { $unwind: '$color' },
        { $group: { _id: '$color', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      clarity: [
        { $match: { isActive: true, clarity: { $exists: true, $not: { $size: 0 } } } },
        { $unwind: '$clarity' },
        { $group: { _id: '$clarity', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      approxWeight: [
        { $match: { isActive: true, approxWeight: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$approxWeight', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      numberOfStones: [
        { $match: { isActive: true, numberOfStones: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$numberOfStones', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
    },
  },
];

const [result] = await Product.aggregate(pipeline);
console.log('\nFacet result keys:', Object.keys(result || {}));
console.log('shape options:', result?.shape?.length ?? 0, result?.shape?.slice(0, 5));
console.log('size options:', result?.size?.length ?? 0, result?.size?.slice(0, 5));
console.log('color options:', result?.color?.length ?? 0, result?.color?.slice(0, 5));
console.log('clarity options:', result?.clarity?.length ?? 0, result?.clarity?.slice(0, 5));
console.log('approxWeight options:', result?.approxWeight?.length ?? 0);
console.log('numberOfStones options:', result?.numberOfStones?.length ?? 0);

await mongoose.disconnect();
console.log('5. Done');