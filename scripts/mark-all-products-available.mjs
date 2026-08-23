/**
 * Marks every product as available:
 *  - stock set to a healthy positive number (default 25, only if currently <= 0)
 *  - reservedForMemo reset to 0 (so availableStock == stock)
 *  - isActive set to true (so nothing is hidden from listings)
 *
 * Usage:
 *   MONGODB_URI="your-connection-string" node scripts/mark-all-products-available.mjs
 *
 * Optional flags:
 *   --stock=50        set restocked items to 50 units instead of the default 25
 *   --force           overwrite stock for ALL products, not just out-of-stock ones
 *   --dry-run         show what would change without writing anything
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Set it in your environment or .env file.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const stockArg = args.find((a) => a.startsWith('--stock='));
const RESTOCK_QTY = stockArg ? parseInt(stockArg.split('=')[1], 10) : 25;

const ProductSchema = new mongoose.Schema(
  {
    stock: Number,
    reservedForMemo: Number,
    isActive: Boolean,
  },
  { strict: false, timestamps: true }
);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const total = await Product.countDocuments();
  const outOfStockFilter = force ? {} : { $or: [{ stock: { $lte: 0 } }, { stock: null }] };
  const affected = await Product.countDocuments(outOfStockFilter);
  const inactive = await Product.countDocuments({ isActive: { $ne: true } });

  console.log(`Total products: ${total}`);
  console.log(`Products that will be restocked to ${RESTOCK_QTY}: ${affected}${force ? ' (--force: ALL products)' : ' (out-of-stock only)'}`);
  console.log(`Products that will be reactivated (isActive: true): ${inactive}`);

  if (dryRun) {
    console.log('\n--dry-run set, no changes written.');
    await mongoose.disconnect();
    return;
  }

  const restockResult = await Product.updateMany(outOfStockFilter, {
    $set: { stock: RESTOCK_QTY },
  });

  const memoResult = await Product.updateMany(
    { reservedForMemo: { $gt: 0 } },
    { $set: { reservedForMemo: 0 } }
  );

  const activeResult = await Product.updateMany(
    { isActive: { $ne: true } },
    { $set: { isActive: true } }
  );

  console.log(`\n✅ Restocked ${restockResult.modifiedCount} product(s) to ${RESTOCK_QTY} units`);
  console.log(`✅ Cleared reservedForMemo on ${memoResult.modifiedCount} product(s)`);
  console.log(`✅ Reactivated ${activeResult.modifiedCount} product(s)`);

  await mongoose.disconnect();
  console.log('\nDone. All products should now show as available.');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
