/**
 * Audits the REAL resolution of every product image already on Cloudinary,
 * using the Cloudinary Admin API's `resources` endpoint — which returns
 * width/height as metadata. No images are downloaded, no re-uploads, no
 * database writes. Purely a read-only report.
 *
 * WHY THIS MATTERS
 * ─────────────────
 * The product-detail zoom feature requests images at up to 2200px wide.
 * Cloudinary's `c_limit` will never upscale — so if the *original* upload
 * is smaller than that, the zoom just stretches a small image via CSS,
 * which looks blurry. This script tells you exactly how many images (and
 * which subcategory folders) fall below useful zoom resolution, so you know
 * what actually needs re-sourcing vs. what's already fine.
 *
 * USAGE
 * ─────
 *   node scripts/audit-image-resolution.mjs
 *   node scripts/audit-image-resolution.mjs --folder products/black-diamonds
 *   node scripts/audit-image-resolution.mjs --csv report.csv
 *
 * Requires CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 * in .env.local or .env (same as scripts/replace-subcategory-images.mjs).
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';
import fs from 'fs';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const folderFilter = getArg('folder');
const csvPath = getArg('csv');

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌ CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not all set');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// Thresholds we care about
const LOW_THRESHOLD = 1200;   // below this: too small even for the 900px card display at retina
const ZOOM_THRESHOLD = 2200;  // below this: zoom will stretch, not truly magnify

async function fetchAllResources() {
  const resources = [];
  let nextCursor = undefined;

  do {
    const params = {
      type: 'upload',
      resource_type: 'image',
      max_results: 500,
      next_cursor: nextCursor,
    };
    if (folderFilter) params.prefix = folderFilter;

    const res = await cloudinary.api.resources(params);

    resources.push(...res.resources);
    nextCursor = res.next_cursor;
    process.stdout.write(`\rFetched ${resources.length} resource(s)...`);
  } while (nextCursor);

  console.log('');
  return resources;
}

async function main() {
  console.log(`Scanning Cloudinary${folderFilter ? ` folder "${folderFilter}"` : ' (entire account, all folders)'}...\n`);

  const resources = await fetchAllResources();

  if (resources.length === 0) {
    console.log('No resources found.');
    return;
  }

  const byFolder = new Map(); // folder -> { total, under1200, under2200, sizes: [] }
  const rows = [['public_id', 'folder', 'width', 'height', 'longest_edge', 'bucket']];

  for (const r of resources) {
    const folder = r.public_id.split('/').slice(0, -1).join('/') || '(root)';
    const longest = Math.max(r.width, r.height);
    let bucket;
    if (longest < LOW_THRESHOLD) bucket = 'LOW (<1200px)';
    else if (longest < ZOOM_THRESHOLD) bucket = 'MEDIUM (1200-2199px)';
    else bucket = 'GOOD (>=2200px)';

    if (!byFolder.has(folder)) {
      byFolder.set(folder, { total: 0, under1200: 0, under2200: 0, sizes: [] });
    }
    const entry = byFolder.get(folder);
    entry.total++;
    entry.sizes.push(longest);
    if (longest < LOW_THRESHOLD) entry.under1200++;
    if (longest < ZOOM_THRESHOLD) entry.under2200++;

    rows.push([r.public_id, folder, r.width, r.height, longest, bucket]);
  }

  // ── Print per-folder summary ──────────────────────────────────────────
  console.log('Per-subcategory-folder resolution summary:\n');
  console.log(
    'Folder'.padEnd(40),
    'Total'.padStart(7),
    'Low(<1200)'.padStart(12),
    'Zoom-ready(>=2200)'.padStart(20)
  );
  console.log('-'.repeat(85));

  const sortedFolders = [...byFolder.entries()].sort((a, b) => b[1].total - a[1].total);
  let grandTotal = 0, grandLow = 0, grandZoomReady = 0;

  for (const [folder, s] of sortedFolders) {
    const zoomReady = s.total - s.under2200;
    grandTotal += s.total;
    grandLow += s.under1200;
    grandZoomReady += zoomReady;
    console.log(
      folder.padEnd(40),
      String(s.total).padStart(7),
      String(s.under1200).padStart(12),
      String(zoomReady).padStart(20)
    );
  }

  console.log('-'.repeat(85));
  console.log(
    'TOTAL'.padEnd(40),
    String(grandTotal).padStart(7),
    String(grandLow).padStart(12),
    String(grandZoomReady).padStart(20)
  );

  console.log(`\n📊 ${grandTotal} image(s) scanned across ${byFolder.size} folder(s)`);
  console.log(`   Below 1200px (too small for sharp cards too): ${grandLow} (${((grandLow / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`   Below 2200px (zoom will stretch, not magnify): ${grandTotal - grandZoomReady} (${(((grandTotal - grandZoomReady) / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`   Zoom-ready (>=2200px):                         ${grandZoomReady} (${((grandZoomReady / grandTotal) * 100).toFixed(1)}%)`);

  if (csvPath) {
    const csv = rows.map((r) => r.join(',')).join('\n');
    fs.writeFileSync(csvPath, csv);
    console.log(`\n💾 Full per-image report written to ${csvPath}`);
  } else {
    console.log(`\nTip: pass --csv report.csv to get a full per-image breakdown.`);
  }
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
