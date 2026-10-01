/**
 * READ-ONLY export for the AlphaImports -> AlphaGemstone 301 redirect mapping.
 *
 * Run from the repo root:   node scripts/export-products-for-redirects.mjs
 * Requires MONGODB_URI in .env / .env.local (same as the other scripts).
 *
 * Writes: scripts/output/alphagemstone_product_redirect_export.csv
 * Columns: SKU, Product ID, Product Name, Current AlphaGemstone Product URL
 *
 * - Includes EVERY product (active, inactive, out of stock). No filters.
 * - SKU is written exactly as stored in `legacySku`. No trim, no case change.
 * - Product ID is the AlphaGemstone MongoDB _id.
 * - URL is the canonical /products/{slug}. If a product has no slug yet, the
 *   URL falls back to /products/{_id}, which the site resolves and redirects
 *   to the correct product page.
 * - This script never writes to the database.
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set (env, .env, or .env.local). Aborting.');
  process.exit(1);
}

// Hardcoded on purpose so a localhost NEXT_PUBLIC_SITE_URL can't leak in.
const BASE_URL = 'https://www.alphagemstone.com';
const OUT_DIR = path.join('scripts', 'output');
const OUT_FILE = path.join(OUT_DIR, 'alphagemstone_product_redirect_export.csv');

const Product =
  mongoose.models.Product ||
  mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));

function csvField(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to db:', mongoose.connection.name);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = fs.createWriteStream(OUT_FILE, { encoding: 'utf8' });
  out.write('SKU,Product ID,Product Name,Current AlphaGemstone Product URL\n');

  const stats = { total: 0, active: 0, inactive: 0, outOfStock: 0, noSku: 0, noSlug: 0 };
  const skuCounts = new Map();

  const cursor = Product.find({})
    .select('legacySku name slug isActive stock reservedForMemo')
    .sort({ _id: 1 })
    .lean()
    .cursor();

  for await (const p of cursor) {
    stats.total++;
    p.isActive ? stats.active++ : stats.inactive++;
    if (Math.max(0, (p.stock || 0) - (p.reservedForMemo || 0)) <= 0) stats.outOfStock++;

    const sku = p.legacySku === undefined || p.legacySku === null ? '' : String(p.legacySku);
    if (sku === '') stats.noSku++;
    else skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);

    const id = String(p._id);
    let url;
    if (p.slug) {
      url = `${BASE_URL}/products/${p.slug}`;
    } else {
      url = `${BASE_URL}/products/${id}`;
      stats.noSlug++;
    }

    out.write([sku, id, p.name ?? '', url].map(csvField).join(',') + '\n');
  }

  await new Promise((resolve) => out.end(resolve));

  const dupSkus = [...skuCounts].filter(([, n]) => n > 1);
  console.log('\n--- Export complete ---');
  console.log('File:', OUT_FILE);
  console.log('Total products:', stats.total);
  console.log('Active / inactive:', stats.active, '/', stats.inactive);
  console.log('Out of stock:', stats.outOfStock);
  console.log('Products with no SKU:', stats.noSku);
  console.log('Products with no slug (used /products/{id} URL):', stats.noSlug);
  console.log('SKUs appearing on more than one product:', dupSkus.length);
  for (const [sku, n] of dupSkus.slice(0, 20)) console.log(`   ${sku}  x${n}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
