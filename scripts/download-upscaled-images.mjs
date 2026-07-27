/**
 * Bakes every product image on Cloudinary into a permanent, static, already-
 * upscaled asset — so the site never has to run Cloudinary's generative
 * e_upscale AI transform at request time again.
 *
 * WHY
 * ───
 * Today, cldUrl() (src/lib/cloudinary-client.ts) is called with
 * `aiUpscale: true` in several places (ProductCard.tsx, Specialsmarquee.tsx —
 * unconditionally on EVERY image — and ProductGallery.tsx, gated by real
 * resolution). e_upscale is a generative ML transform: the first time a given
 * transformed URL is requested, Cloudinary has to run a model server-side,
 * which is a multi-second cold-cache delay. That's a direct hit to LCP on
 * product cards, the homepage marquee, and product detail pages.
 *
 * This script does the expensive work ONCE, offline, instead of on a
 * customer's first page load:
 *
 *   1. Lists every image under a Cloudinary folder (Admin API — no downloads
 *      needed just to see width/height).
 *   2. For images below the target resolution: builds the SAME e_upscale
 *      transform the site already uses, so the result is pixel-identical to
 *      what the AI upscale path produces today.
 *   3. For images already at/above target resolution: just bakes q_auto:best
 *      + the right format — no AI, just a normal resize.
 *   4. Downloads the resulting bytes.
 *   5. Re-uploads them to Cloudinary under a NEW prefix as a plain, already-
 *      processed asset (no transformation needed at delivery time — an <img>
 *      tag pointing at it is a flat file fetch from Cloudinary's CDN).
 *   6. Writes a manifest (CSV + JSON) mapping old URL -> new URL, so you can
 *      bulk-swap references in MongoDB (scripts/apply-image-manifest.mjs) or
 *      in your product import CSV.
 *
 * Nothing existing is touched — this only reads from Cloudinary and writes
 * NEW assets under --new-prefix. Safe to run repeatedly (skips work already
 * done locally and already-uploaded new assets).
 *
 * USAGE
 * ─────
 *   Small test batch first (no folder needed if your images are flat/root-level):
 *     node scripts/download-upscaled-images.mjs --limit 5
 *
 *   Full run across the whole catalog:
 *     node scripts/download-upscaled-images.mjs
 *
 *   If your images DO live under folders, you can still scope to one:
 *     node scripts/download-upscaled-images.mjs --folder products/black-diamonds --limit 5
 *
 *   Useful flags:
 *     --folder <prefix>       Cloudinary prefix to scan (default: none — scans
 *                              the whole account, including root-level images)
 *     --target-width <n>      "good enough" width in px (default: 2200 — same
 *                              ceiling ProductGallery already uses for zoom)
 *     --new-prefix <prefix>   where baked assets are re-uploaded
 *                              (default: products-hd/)
 *     --out <dir>             local folder to save downloaded files
 *                              (default: downloads/upscaled-images)
 *     --concurrency <n>       parallel images in flight (default: 3 — keep
 *                              this low, e_upscale is slow & rate-limited)
 *     --limit <n>             only process the first N images (testing)
 *     --skip-reupload         download + save manifest locally only, don't
 *                              push new assets back to Cloudinary
 *
 * Requires CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 * in .env.local or .env (same as the other Cloudinary scripts in this repo).
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

// No default prefix — if --folder isn't passed, scan the whole account
// (root-level images included). Only apply a prefix filter when one is
// explicitly given. Normalized to end with "/" so "products" can never
// accidentally string-prefix-match "products-hd/..." (Cloudinary's Admin
// API prefix filter is a plain string prefix, not a folder-boundary match).
let folderFilter = getArg('folder');
if (folderFilter && !folderFilter.endsWith('/')) folderFilter += '/';
const TARGET_WIDTH = parseInt(getArg('target-width') || '2200', 10);
const NEW_PREFIX = (getArg('new-prefix') || 'products-hd/').replace(/^\/|\/$/g, '') + '/';
const OUT_DIR = getArg('out') || 'downloads/upscaled-images';
const CONCURRENCY = Math.max(1, parseInt(getArg('concurrency') || '3', 10));
const LIMIT = getArg('limit') ? parseInt(getArg('limit'), 10) : Infinity;
const SKIP_REUPLOAD = Boolean(getArg('skip-reupload', false));

// Same thresholds ProductGallery.tsx already uses — a second AI pass is only
// worth it for genuinely tiny sources.
const TWO_PASS_BELOW = 250;

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

// ── List every resource under the folder ───────────────────────────────────
async function fetchAllResources() {
  const resources = [];
  let nextCursor;
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
    process.stdout.write(`\rListing Cloudinary resources... ${resources.length}`);
  } while (nextCursor);
  console.log('');
  return resources;
}

// ── Build the baked (permanent) transform URL for one resource ─────────────
// Hand-assembled the same way cldUrl() (src/lib/cloudinary-client.ts) already
// builds it — chained "/" segments — so the AI-upscale result here is
// pixel-identical to what the live site produces today.
function buildBakedUrlSimple(resource) {
  const longest = Math.max(resource.width, resource.height);
  const needsUpscale = longest < TARGET_WIDTH;
  const passes = needsUpscale && longest > 0 && longest < TWO_PASS_BELOW ? 2 : 1;

  const segments = [];
  if (needsUpscale) {
    for (let i = 0; i < passes; i++) segments.push('e_upscale');
  }
  segments.push(`w_${TARGET_WIDTH},${needsUpscale ? 'c_scale' : 'c_limit'},q_auto:best,f_${resource.format}`);
  const transform = segments.join('/');

  const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${resource.public_id}`;
  return { url, needsUpscale, passes, longest };
}

function localPathFor(resource) {
  const ext = resource.format || 'jpg';
  return path.join(OUT_DIR, `${resource.public_id}.${ext}`);
}

// ── Crash-safe incremental progress log ─────────────────────────────────────
// For a batch this size (thousands of images, each possibly taking up to a
// minute on a cold AI-upscale cache), we cannot afford to lose everything if
// the terminal closes, the network drops, or Cloudinary rate-limits us
// partway through. Every completed row is appended to progress.ndjson (one
// JSON object per line) IMMEDIATELY, not just at the very end. Re-running the
// script reads this file first and skips anything already marked "ok".
const PROGRESS_PATH = path.join(OUT_DIR, 'progress.ndjson');

function loadAllProgress() {
  const map = new Map(); // old_public_id -> most recent row for that id
  if (!fs.existsSync(PROGRESS_PATH)) return map;
  const lines = fs.readFileSync(PROGRESS_PATH, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      map.set(row.old_public_id, row); // later lines overwrite earlier ones for the same id
    } catch {
      // ignore a corrupted trailing line (e.g. process killed mid-write)
    }
  }
  return map;
}

function loadDoneOnly() {
  const done = new Map();
  for (const [id, row] of loadAllProgress()) {
    if (row.status === 'ok') done.set(id, row);
  }
  return done;
}

function appendProgress(row) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(PROGRESS_PATH, JSON.stringify(row) + '\n');
}

function newPublicIdFor(resource) {
  // Mirror the same relative path under the new prefix, e.g.
  // products/black-diamonds/abc  ->  products-hd/black-diamonds/abc
  // If images are flat (no folder, or --folder wasn't used), rel is just
  // the original public_id, e.g. abc123 -> products-hd/abc123
  const rel = folderFilter && resource.public_id.startsWith(folderFilter)
    ? resource.public_id.slice(folderFilter.length)
    : resource.public_id;
  return `${NEW_PREFIX}${rel}`;
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} fetching ${url}`);
    err.status = res.status;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  return buf;
}

// Cloudinary returns 423 Locked while a generative AI transform (e_upscale)
// is still being computed in the background — the first request for a given
// transformed URL kicks the AI job off, and it can take anywhere from a few
// seconds to over a minute to finish. This polls patiently instead of giving
// up after a few quick retries (which is fine for plain network errors, but
// not for "the AI model is still running").
async function downloadWithAiPatience(url, filePath, label) {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await downloadToFile(url, filePath);
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      const isLocked = err.status === 423;
      const wait = isLocked ? Math.min(5000 + i * 3000, 30000) : 1500 * (i + 1);
      console.warn(
        `\n⏳ ${label}: ${isLocked ? 'Cloudinary is still generating the AI upscale' : err.message} ` +
        `(attempt ${i + 1}/${maxAttempts}). Waiting ${Math.round(wait / 1000)}s...`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function reuploadBuffer(buf, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buf);
  });
}

async function withRetry(fn, attempts = 3, label = '') {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = 1500 * (i + 1);
      console.warn(`\n⚠️  ${label} failed (attempt ${i + 1}/${attempts}): ${err.message}. Retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function processOne(resource, index, total) {
  const localPath = localPathFor(resource);
  const newPublicId = newPublicIdFor(resource);
  const { url: bakedUrl, needsUpscale, passes, longest } = buildBakedUrlSimple(resource);

  const row = {
    old_public_id: resource.public_id,
    old_url: resource.secure_url,
    new_public_id: newPublicId,
    new_url: null,
    local_path: localPath,
    original_longest_edge: longest,
    upscaled: needsUpscale,
    passes: needsUpscale ? passes : 0,
    status: 'pending',
  };

  try {
    let buf;
    if (fs.existsSync(localPath)) {
      buf = fs.readFileSync(localPath);
    } else {
      buf = await downloadWithAiPatience(bakedUrl, localPath, resource.public_id);
    }

    if (!SKIP_REUPLOAD) {
      const uploaded = await withRetry(
        () => reuploadBuffer(buf, newPublicId),
        3,
        `reupload ${newPublicId}`
      );
      row.new_url = uploaded.secure_url;
    }

    row.status = 'ok';
  } catch (err) {
    row.status = `error: ${err.message}`;
  }

  process.stdout.write(
    `\r[${index + 1}/${total}] ${row.status === 'ok' ? '✅' : '❌'} ${resource.public_id}${' '.repeat(20)}`
  );
  appendProgress(row);
  return row;
}

// Small concurrency pool — keep this modest, e_upscale is slow & rate-limited.
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

async function main() {
  console.log(
    folderFilter
      ? `Scanning Cloudinary folder "${folderFilter}"...`
      : 'Scanning entire Cloudinary account (no --folder given)...'
  );
  let resources = await fetchAllResources();

  // Safety net: never reprocess our own previously-baked output, even if a
  // loose --folder filter would otherwise match it (e.g. "products" also
  // string-prefix-matching "products-hd/...").
  const beforeGuard = resources.length;
  resources = resources.filter((r) => !r.public_id.startsWith(NEW_PREFIX));
  if (beforeGuard !== resources.length) {
    console.log(`Skipped ${beforeGuard - resources.length} resource(s) already under "${NEW_PREFIX}" (previously baked output).`);
  }

  if (resources.length === 0) {
    console.log('No resources found.');
    return;
  }

  // Resume support: skip anything a previous run already completed successfully.
  const previouslyDone = loadDoneOnly();
  if (previouslyDone.size > 0) {
    const before = resources.length;
    resources = resources.filter((r) => !previouslyDone.has(r.public_id));
    console.log(`Resuming: ${previouslyDone.size} already completed in a previous run, skipping those. ${resources.length}/${before} remaining.`);
  }

  if (LIMIT < resources.length) {
    console.log(`--limit ${LIMIT} set — only processing the first ${LIMIT} of ${resources.length}.`);
    resources = resources.slice(0, LIMIT);
  }

  if (resources.length === 0) {
    console.log('Nothing left to process — everything is already done. Skipping straight to manifest rebuild.');
  } else {
    console.log(`Target width: ${TARGET_WIDTH}px | New prefix: ${NEW_PREFIX} | Local dir: ${OUT_DIR}`);
    console.log(`Re-upload to Cloudinary: ${SKIP_REUPLOAD ? 'NO (--skip-reupload)' : 'YES'}`);
    console.log(`Progress is saved incrementally to ${PROGRESS_PATH} — safe to Ctrl+C and resume later.\n`);

    await runPool(resources, processOne, CONCURRENCY);
    console.log('\n');
  }

  // Rebuild the final manifest from the FULL progress log (everything ever
  // attempted across all runs, latest result per image), not just this
  // invocation's in-memory rows — this is what makes resuming safe, and
  // keeps failed rows visible instead of silently disappearing.
  const rows = [...loadAllProgress().values()];

  const ok = rows.filter((r) => r.status === 'ok');
  const failed = rows.filter((r) => r.status !== 'ok');
  const upscaled = ok.filter((r) => r.upscaled);

  console.log(`📊 Total completed so far: ${ok.length}/${rows.length}`);
  console.log(`   Needed AI upscale (source < ${TARGET_WIDTH}px): ${upscaled.length}`);
  console.log(`   Already good enough (quality/format bake only): ${ok.length - upscaled.length}`);
  if (failed.length) {
    console.log(`   ❌ Still failing: ${failed.length} (see manifest "status" column — re-run the script to retry them)`);
  }

  // ── Write manifest ────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifestJsonPath = path.join(OUT_DIR, 'manifest.json');
  const manifestCsvPath = path.join(OUT_DIR, 'manifest.csv');

  fs.writeFileSync(manifestJsonPath, JSON.stringify(rows, null, 2));

  const header = [
    'old_public_id', 'old_url', 'new_public_id', 'new_url',
    'local_path', 'original_longest_edge', 'upscaled', 'passes', 'status',
  ];
  const csvLines = [header.join(',')];
  for (const r of rows) {
    csvLines.push(
      header.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
  }
  fs.writeFileSync(manifestCsvPath, csvLines.join('\n'));

  console.log(`\n💾 Manifest written:`);
  console.log(`   ${manifestJsonPath}`);
  console.log(`   ${manifestCsvPath}`);

  if (!SKIP_REUPLOAD) {
    console.log(
      `\nNext step: node scripts/apply-image-manifest.mjs --manifest ${manifestJsonPath}` +
      `\n(dry-run by default — add --apply once the preview looks right)`
    );
  } else {
    console.log(
      `\n--skip-reupload was set, so images are only saved locally under ${OUT_DIR}.` +
      `\nUpload them yourself and rebuild the manifest's new_url column before ` +
      `running apply-image-manifest.mjs, or re-run without --skip-reupload.`
    );
  }
}

main().catch((err) => {
  console.error('\n❌ Script failed:', err);
  process.exit(1);
});
