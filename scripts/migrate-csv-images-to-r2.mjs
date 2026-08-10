/**
 * Migrates the Cloudinary image URLs referenced inside one or more legacy
 * product CSVs (e.g. blue_diamonds.csv, black_diamonds.csv) to Cloudflare
 * R2, and writes out a NEW copy of each CSV with those URLs replaced by
 * their R2 equivalents. Every other column/value is passed through byte-
 * for-byte unchanged.
 *
 * This script does NOT touch MongoDB or any other part of the running
 * application. It only reads the input CSV(s) and writes new CSV file(s)
 * next to them. That's intentional — you asked to get clean, verified CSVs
 * with R2 URLs first, and apply them to the database yourself afterward
 * (e.g. via your own import step, or a follow-up script once you've
 * reviewed these files).
 *
 * WHY THIS EXISTS / HOW IT FITS WITH scripts/migrate-cloudinary-to-r2.mjs
 * ─────────────────────────────────────────────────────────────────────
 * That script migrates whatever Cloudinary URLs are *currently sitting in
 * MongoDB* to R2. It has nothing to do with these CSVs and is left
 * completely untouched by this one.
 *
 * This script instead treats the CSVs as the source of truth for what the
 * CORRECT images are (per your Cloudinary export), independent of whatever
 * is currently saved on each product in Mongo. It uses the exact same R2
 * upload behavior/key scheme as lib/r2.ts's uploadBuffer() and the other
 * migration script, so objects this script creates in R2 are
 * indistinguishable from ones created by the rest of the app.
 *
 * IMAGE COLUMNS PROCESSED (from the CSV export format)
 * ──────────────────────────────────────────────────────
 *   products_image, products_image_sm_1 .. products_image_sm_6
 *
 * Only cells that are actual res.cloudinary.com URLs are migrated. Empty
 * cells are left empty. Cells pointing at the shared Cloudinary "demo"
 * placeholder (res.cloudinary.com/demo/.../no-image-available.png) are
 * recognized as "no real image" and left BLANK in the output rather than
 * migrated as if they were a real product photo — that placeholder is
 * counted and logged separately so you can see how many rows have no
 * actual image on file.
 *
 * DEDUPLICATION
 * ─────────────
 * The exact same Cloudinary URL, wherever it appears — same row, a
 * different column in that row, or a different row entirely, even across
 * separate input files in the same run — is only ever downloaded and
 * uploaded to R2 ONCE. Every other occurrence reuses that same R2 URL.
 * This mirrors products_image == products_image_sm_1 in almost every row
 * of your CSVs already.
 *
 * RESUMABILITY / CHECKPOINTING
 * ──────────────────────────────
 * Same approach as scripts/migrate-cloudinary-to-r2.mjs: every URL that's
 * successfully migrated is written to a checkpoint file as it happens. If
 * the process is interrupted, re-running the exact same command picks up
 * where it left off — already-migrated URLs are reused from the
 * checkpoint instead of being re-downloaded / re-uploaded (no duplicate R2
 * objects). Pass --checkpoint <path> to change the file, --reset-checkpoint
 * to discard it and start fresh.
 *
 * SAFETY
 * ──────
 *   - Dry run by default. With no flags, the script ONLY reads the CSV(s),
 *     reports what it *would* do (rows, unique Cloudinary URLs found,
 *     placeholders skipped, planned R2 keys) and writes nothing — no
 *     network calls to Cloudinary or R2 happen in dry run. This is
 *     deliberately more conservative than migrate-cloudinary-to-r2.mjs
 *     (which does fetch from Cloudinary even in dry run) because this
 *     script has no database write to gate — the CSV output IS the
 *     deliverable, so we want a completely free, instant way to sanity
 *     check row/column matching before spending any network calls.
 *   - Pass --apply to actually download from Cloudinary, upload to R2,
 *     and write the new CSV file(s).
 *   - Output files are written under a NEW name (default: same folder,
 *     "<original>.r2.csv") — your original CSVs are never modified.
 *
 * REQUIRED ENV VARS (.env.local or .env) — only needed for --apply
 * ────────────────────────────────────────
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL
 *
 * USAGE
 * ─────
 *   Dry run (no network calls, just a report):
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv,black_diamonds.csv
 *
 *   Migrate for real:
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv,black_diamonds.csv --apply
 *
 *   Test on the first N rows of each file first:
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv --apply --limit 20
 *
 *   Custom R2 folder (default: "products", matching Product.images convention):
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv --apply --folder products
 *
 *   Custom output location:
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv --apply --output-dir ./out
 *
 *   Resume an interrupted run — just re-run the same command:
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv,black_diamonds.csv --apply
 *
 *   Start over from scratch (ignore any existing checkpoint):
 *     node scripts/migrate-csv-images-to-r2.mjs --input blue_diamonds.csv --apply --reset-checkpoint
 */

import { config } from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { writeFile, readFile, rename, unlink } from 'fs/promises';
import path from 'path';
import csvParser from 'csv-parser';

config({ path: '.env.local' });
config();

// ── CLI args ─────────────────────────────────────────────────────────────
function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const apply = Boolean(getArg('apply', false));
const inputArg = getArg('input');
const limitArg = getArg('limit');
const limit = limitArg ? parseInt(limitArg, 10) : undefined;
const folder = getArg('folder') || 'products';
const outputDir = getArg('output-dir');
const checkpointPath = getArg('checkpoint') || 'csv-image-migration-checkpoint.json';
const resetCheckpoint = Boolean(getArg('reset-checkpoint', false));
const noFallback = Boolean(getArg('no-fallback', false));
const fallbackImagePath = getArg('fallback-image') || 'public/images/product-placeholder.webp';

if (!inputArg) {
  console.error('❌ --input <file1.csv,file2.csv,...> is required');
  process.exit(1);
}
const inputFiles = inputArg.split(',').map((s) => s.trim()).filter(Boolean);

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

if (apply) {
  const missing = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
  if (missing.length) {
    console.error(`❌ Missing env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }
}

const r2Client = apply
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

// ── constants ────────────────────────────────────────────────────────────
// Exact column set from the legacy CSV export. products_image and
// products_image_sm_1 are effectively duplicates of each other in nearly
// every row — both are still processed since dedup makes that free.
const IMAGE_COLUMNS = [
  'products_image',
  'products_image_sm_1',
  'products_image_sm_2',
  'products_image_sm_3',
  'products_image_sm_4',
  'products_image_sm_5',
  'products_image_sm_6',
];

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

// The shared Cloudinary "demo" account placeholder — not a real product
// photo. Treated as "no image" rather than migrated.
function isPlaceholderUrl(url) {
  return (
    typeof url === 'string' &&
    (url.includes('res.cloudinary.com/demo/') || /no-image-available/i.test(url))
  );
}

function guessContentType(url, headerType) {
  if (headerType && headerType.startsWith('image/')) return headerType;
  const ext = url.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

// Mirrors lib/r2.ts's uploadBuffer key scheme: folder/timestamp-filename
function buildKey(folder, sourceUrl) {
  const last = sourceUrl.split('/').pop().split(/[?#]/)[0];
  const base = last.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = last.match(/\.[^.]+$/)?.[0] ?? '';
  return `${folder}/${Date.now()}-${base}${ext}`;
}

// ── CSV writing (RFC4180) ───────────────────────────────────────────────
// Quote any field containing a comma, quote, or newline; double internal
// quotes. Keeps output byte-compatible with how the input was almost
// certainly written.
function csvEscape(value) {
  const v = value ?? '';
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    createReadStream(filePath)
      .pipe(csvParser())
      .on('headers', (h) => {
        headers = h;
      })
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve({ headers, rows }))
      .on('error', reject);
  });
}

// ── checkpoint (resumability + cross-file/cross-run dedup) ─────────────
const migratedCache = new Map(); // cloudinaryUrl -> { url, key, isFallback? }
let fallbackAsset = null;
let checkpointDirty = false;

async function loadCheckpoint() {
  if (resetCheckpoint) {
    try {
      await unlink(checkpointPath);
      console.log(`♻️  --reset-checkpoint: removed existing ${checkpointPath}`);
    } catch {
      // nothing to remove
    }
    return;
  }
  let raw;
  try {
    raw = await readFile(checkpointPath, 'utf8');
  } catch {
    return; // fresh start
  }
  try {
    const data = JSON.parse(raw);
    for (const [url, result] of Object.entries(data.urlCache || {})) {
      migratedCache.set(url, result);
    }
    if (data.fallback) fallbackAsset = data.fallback;
    console.log(`📌 Resuming from ${checkpointPath}: ${migratedCache.size} already-migrated URL(s) loaded.`);
  } catch (err) {
    console.warn(`⚠️  Couldn't parse ${checkpointPath} (${err.message}) — starting fresh.`);
  }
}

async function flushCheckpoint() {
  if (!checkpointDirty) return;
  checkpointDirty = false;
  const data = {
    urlCache: Object.fromEntries(migratedCache),
    fallback: fallbackAsset,
    updatedAt: new Date().toISOString(),
  };
  const tmpPath = `${checkpointPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2));
  await rename(tmpPath, checkpointPath);
}

const stats = {
  rowsScanned: 0,
  cellsWithCloudinaryUrl: 0,
  placeholdersSkipped: 0,
  uniqueUrls: 0,
  downloaded: 0,
  uploaded: 0,
  cached: 0,
  failed: 0,
  fallbackUsed: 0,
  rowsChanged: 0,
};
const failures = []; // { file, products_id, products_model, column, url, error }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`Download failed (${res.status}): ${url}`);
      }
      lastErr = new Error(`Download failed (${res.status}): ${url}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) await sleep(500 * 2 ** i);
  }
  throw lastErr;
}

async function getFallbackAsset() {
  if (fallbackAsset) return fallbackAsset;
  const buffer = await readFile(fallbackImagePath);
  const key = 'fallback/product-placeholder.jpg';
  if (apply) {
    await r2Client.send(
      new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: 'image/jpeg' })
    );
  }
  fallbackAsset = { url: `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`, key, isFallback: true };
  checkpointDirty = true;
  return fallbackAsset;
}

async function migrateUrl(sourceUrl, context) {
  if (migratedCache.has(sourceUrl)) {
    stats.cached++;
    return migratedCache.get(sourceUrl);
  }
  stats.uniqueUrls++;

  if (!apply) {
    // Dry run: no network calls at all — just show what WOULD happen.
    const planned = { url: `<R2_PUBLIC_URL>/${buildKey(folder, sourceUrl)}`, key: buildKey(folder, sourceUrl), planned: true };
    migratedCache.set(sourceUrl, planned);
    return planned;
  }

  let res;
  try {
    res = await fetchWithRetry(sourceUrl);
  } catch (err) {
    if (noFallback) {
      stats.failed++;
      failures.push({ ...context, url: sourceUrl, error: err.message });
      return null;
    }
    const fb = await getFallbackAsset();
    stats.fallbackUsed++;
    failures.push({ ...context, url: sourceUrl, error: err.message, fallback: true });
    migratedCache.set(sourceUrl, fb);
    checkpointDirty = true;
    return fb;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  stats.downloaded++;
  const key = buildKey(folder, sourceUrl);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: guessContentType(sourceUrl, res.headers.get('content-type')),
    })
  );
  stats.uploaded++;

  const result = { url: `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`, key };
  migratedCache.set(sourceUrl, result);
  checkpointDirty = true;
  return result;
}

async function processFile(filePath) {
  console.log(`\n📄 ${filePath}`);
  const { headers, rows } = await readCsv(filePath);
  if (!headers) {
    console.log('   (empty file, skipping)');
    return;
  }

  let rowIdx = 0;
  for (const row of rows) {
    if (limit && rowIdx >= limit) break;
    rowIdx++;
    stats.rowsScanned++;

    const context = {
      file: path.basename(filePath),
      products_id: row.products_id,
      products_model: row.products_model,
    };

    let rowChanged = false;
    for (const col of IMAGE_COLUMNS) {
      const val = (row[col] || '').trim();
      if (!val) continue;

      if (isPlaceholderUrl(val)) {
        stats.placeholdersSkipped++;
        row[col] = ''; // no real image — leave blank rather than migrate a placeholder
        rowChanged = true;
        continue;
      }
      if (!isCloudinaryUrl(val)) continue; // already R2, or some other URL — leave as-is

      stats.cellsWithCloudinaryUrl++;
      const migrated = await migrateUrl(val, { ...context, column: col });
      if (migrated) {
        row[col] = migrated.url;
        rowChanged = true;
      }
      // if migrated is null (hard failure, --no-fallback), leave the
      // original Cloudinary URL in place rather than blanking a cell we
      // couldn't actually fix — never silently drop a working reference.
    }
    if (rowChanged) stats.rowsChanged++;

    if (rowIdx % 200 === 0) {
      process.stdout.write(
        `\r   row ${rowIdx}/${limit ?? rows.length} | ⬆️  ${stats.uploaded} uploaded | ♻️  ${stats.cached} reused | ❌ ${stats.failed} failed   `
      );
    }
  }
  console.log(`\r   ${rowIdx} row(s) processed.                                                      `);

  const outPath = outputDir
    ? path.join(outputDir, path.basename(filePath).replace(/\.csv$/i, '.r2.csv'))
    : filePath.replace(/\.csv$/i, '.r2.csv');

  if (apply) {
    await writeFile(outPath, rowsToCsv(headers, rows));
    console.log(`   ✅ wrote ${outPath}`);
  } else {
    console.log(`   🧪 dry run — would write ${outPath} (re-run with --apply)`);
  }
}

async function main() {
  console.log(apply ? '🚀 APPLY MODE — downloading from Cloudinary, uploading to R2, writing new CSVs' : '🧪 DRY RUN — no network calls, no files written (pass --apply to migrate for real)');
  console.log(`   Input file(s): ${inputFiles.join(', ')}`);
  console.log(`   R2 folder: ${folder}`);
  if (limit) console.log(`   Limited to ${limit} row(s) per file.`);

  await loadCheckpoint();

  for (const f of inputFiles) {
    await processFile(f);
  }

  await flushCheckpoint();

  console.log(`\n\n📊 Summary`);
  console.log(`   Rows scanned:              ${stats.rowsScanned}`);
  console.log(`   Rows with an image change: ${stats.rowsChanged}`);
  console.log(`   Cloudinary cells found:    ${stats.cellsWithCloudinaryUrl}`);
  console.log(`   Unique Cloudinary URLs:    ${stats.uniqueUrls}`);
  console.log(`   Placeholder cells skipped: ${stats.placeholdersSkipped}`);
  if (apply) {
    console.log(`   Downloaded:                ${stats.downloaded}`);
    console.log(`   Uploaded to R2:            ${stats.uploaded}`);
    console.log(`   Reused from cache:         ${stats.cached}`);
    console.log(`   Fallback used:             ${stats.fallbackUsed}`);
    console.log(`   Hard failures:             ${stats.failed}`);
  } else {
    console.log(`   (downloaded/uploaded/failed counts are only meaningful with --apply)`);
  }

  if (failures.length) {
    const logPath = 'csv-image-migration-failures.json';
    await writeFile(logPath, JSON.stringify(failures, null, 2));
    console.log(`\n📝 ${failures.length} failure(s)/fallback(s) logged to ${logPath}`);
  }

  if (!apply) {
    console.log('\n🧪 This was a dry run — re-run with --apply to actually migrate and write the new CSV(s).');
  }
}

main().catch(async (err) => {
  console.error('\n❌ Script failed:', err);
  try {
    await flushCheckpoint();
    console.log(`💾 Checkpoint saved to ${checkpointPath} — re-run the same command to resume.`);
  } catch {}
  process.exit(1);
});
