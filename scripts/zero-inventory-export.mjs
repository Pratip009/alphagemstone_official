#!/usr/bin/env node
/**
 * scripts/zero-inventory-export.mjs
 *
 * READ-ONLY. Never writes to the database.
 *
 * Exports: SKU, Product Name, Current URL, Current Inventory Quantity
 * for every product that is out of stock, INCLUDING products that were
 * bulk-reset from 0 -> 10 earlier.
 *
 * How the "0 -> 10" products are recovered (in priority order):
 *   1. --original-csv <file>   Compare against the original import CSV / old export.
 *                              Any product now = 10 whose original qty was <= 0 is flagged.
 *   2. --bulk-from / --bulk-to Date range of the bulk update (ISO). Every product with
 *                              stock = 10 and updatedAt inside the range is flagged.
 *   3. (default) auto-detect   A Mongo updateMany stamps ONE identical updatedAt on every
 *                              doc it touches. We group stock=10 products by exact
 *                              updatedAt and flag the big clusters.
 *
 * Usage (from repo root):
 *   node scripts/zero-inventory-export.mjs
 *   node scripts/zero-inventory-export.mjs --url-base https://www.alphagemimports.com
 *   node scripts/zero-inventory-export.mjs --bulk-from 2026-09-28T00:00:00Z --bulk-to 2026-09-28T23:59:59Z
 *   node scripts/zero-inventory-export.mjs --original-csv ./legacy.csv --csv-sku-col SKU --csv-stock-col Stock
 *   node scripts/zero-inventory-export.mjs --uri "<restored-snapshot-uri>" --no-bulk   # run on an Atlas backup
 *
 * Flags:
 *   --uri            Mongo URI (default: MONGODB_URI from .env.local / .env)
 *   --collection     default "products"
 *   --stock-field    default "stock"
 *   --reset-value    the value zeros were set to, default 10
 *   --min-cluster    min docs sharing one updatedAt to count as a bulk update, default 25
 *   --url-base       site origin, default NEXT_PUBLIC_APP_URL
 *   --out            output file, default zero-inventory-export.csv
 *   --no-bulk        skip reset detection (only current zeros)
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import csvParser from 'csv-parser';

// Where to look for the SKU on a product document (first non-empty wins).
const SKU_PATHS = [
  'sku', 'SKU', 'itemNumber', 'item_number', 'productCode', 'legacySku',
  'legacyAttributes.sku', 'legacyAttributes.SKU', 'legacyAttributes.Item Number',
];

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[k] = true;
    else { o[k] = n; i++; }
  }
  return o;
}

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}

const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const pick = (obj, paths) => {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};
const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const iso = (d) => (d instanceof Date ? d.toISOString() : '');

function loadOriginalCsv(file, skuCol, stockCol) {
  return new Promise((resolve, reject) => {
    const map = new Map();
    let checked = false;
    fs.createReadStream(file)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (r) => {
        if (!checked) {
          checked = true;
          if (!(skuCol in r) || !(stockCol in r)) {
            return reject(new Error(`CSV columns not found. Have: ${Object.keys(r).join(', ')}. Use --csv-sku-col / --csv-stock-col.`));
          }
        }
        const sku = String(r[skuCol] ?? '').trim().toLowerCase();
        if (!sku) return;
        const q = Number(String(r[stockCol] ?? '').replace(/[^\d.-]/g, ''));
        map.set(sku, Number.isFinite(q) ? q : 0);
      })
      .on('end', () => resolve(map))
      .on('error', reject);
  });
}

async function main() {
  loadEnv();
  const uri = args.uri || process.env.MONGODB_URI;
  if (!uri) throw new Error('No Mongo URI. Set MONGODB_URI in .env.local or pass --uri.');

  const sf = args['stock-field'] || 'stock';
  const reset = Number(args['reset-value'] ?? 10);
  const minCluster = Number(args['min-cluster'] ?? 25);
  const base = String(args['url-base'] || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const outFile = args.out || 'zero-inventory-export.csv';

  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection(args.collection || 'products');
  const total = await col.countDocuments();
  console.log(`Connected. ${total} products in "${col.collectionName}".`);

  /** @type {Map<string,{d:any,detection:string}>} */
  const found = new Map();

  // 1) Currently zero / negative / missing stock
  const zeroQ = { $or: [{ [sf]: { $lte: 0 } }, { [sf]: null }] };
  for await (const d of col.find(zeroQ)) found.set(String(d._id), { d, detection: 'ZERO (current DB value)' });
  console.log(`Currently zero/empty: ${found.size}`);

  // 2) Products that were reset 0 -> reset value
  if (!args['no-bulk']) {
    let resetDocs = [];
    let label = '';

    if (args['original-csv']) {
      const orig = await loadOriginalCsv(
        args['original-csv'],
        args['csv-sku-col'] || 'SKU',
        args['csv-stock-col'] || 'Stock'
      );
      console.log(`Original CSV loaded: ${orig.size} SKUs.`);
      for await (const d of col.find({ [sf]: reset })) {
        const sku = pick(d, SKU_PATHS).toLowerCase();
        if (sku && orig.has(sku) && orig.get(sku) <= 0) resetDocs.push(d);
      }
      label = 'RESET 0->%R% (confirmed by original CSV)';
    } else if (args['bulk-from'] || args['bulk-to']) {
      const from = args['bulk-from'] ? new Date(args['bulk-from']) : new Date(0);
      const to = args['bulk-to'] ? new Date(args['bulk-to']) : new Date();
      resetDocs = await col.find({ [sf]: reset, updatedAt: { $gte: from, $lte: to } }).toArray();
      label = 'RESET 0->%R% (bulk update window)';
    } else {
      const groups = await col.aggregate([
        { $match: { [sf]: reset, updatedAt: { $type: 'date' } } },
        { $group: { _id: '$updatedAt', count: { $sum: 1 }, firstCreated: { $min: '$createdAt' } } },
        { $match: { count: { $gte: minCluster } } },
        { $sort: { count: -1 } },
      ]).toArray();
      // Real bulk updates touch old docs: updatedAt is well after createdAt.
      const real = groups.filter((g) => !g.firstCreated || g._id.getTime() - new Date(g.firstCreated).getTime() > 60_000);

      if (!real.length) {
        console.warn(`\nNo bulk-update cluster found (stock=${reset}, >= ${minCluster} docs sharing one updatedAt).`);
        console.warn('The update probably did not bump updatedAt. Use --original-csv, --bulk-from/--bulk-to, or run on an Atlas backup (--uri <snapshot> --no-bulk).\n');
      } else {
        console.log('\nDetected bulk-update clusters (stock = %d):', reset);
        for (const g of real) console.log(`  ${g._id.toISOString()}  ->  ${g.count} products`);
        resetDocs = await col.find({ [sf]: reset, updatedAt: { $in: real.map((g) => g._id) } }).toArray();
      }
      label = 'RESET 0->%R% (bulk update cluster)';
    }

    let added = 0;
    for (const d of resetDocs) {
      const id = String(d._id);
      if (found.has(id)) continue;
      found.set(id, { d, detection: label.replace('%R%', String(reset)) });
      added++;
    }
    console.log(`Recovered from bulk reset: ${added}`);
  }

  // Build CSV
  const header = [
    'SKU', 'Product Name', 'Current URL', 'Current Inventory Quantity',
    'DB Stock Value', 'Detection', 'Active', 'Last Updated',
  ];
  const rows = [...found.values()].map(({ d, detection }) => {
    const isReset = detection.startsWith('RESET');
    const dbVal = d[sf] ?? '';
    const slugOrId = d.slug || String(d._id);
    return [
      pick(d, SKU_PATHS),
      d.name || d.title || '',
      `${base}/products/${slugOrId}`,
      isReset ? 0 : (Number(dbVal) > 0 ? dbVal : 0),
      dbVal,
      detection,
      d.isActive === undefined ? '' : d.isActive,
      iso(d.updatedAt),
    ];
  });
  rows.sort((a, b) => String(a[5]).localeCompare(String(b[5])) || String(a[1]).localeCompare(String(b[1])));

  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  fs.writeFileSync(outFile, csv, 'utf8');

  const byType = rows.reduce((m, r) => ((m[r[5]] = (m[r[5]] || 0) + 1), m), {});
  console.log(`\nWrote ${rows.length} rows -> ${path.resolve(outFile)}`);
  console.table(byType);
  if (!base) console.warn('Note: no --url-base / NEXT_PUBLIC_APP_URL set, URLs are relative paths.');

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
