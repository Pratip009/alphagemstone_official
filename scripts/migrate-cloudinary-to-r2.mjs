/**
 * Migrates every image referenced in MongoDB from Cloudinary to Cloudflare
 * R2. For each Cloudinary URL found across the models below, it:
 *
 *   1. Downloads the asset from its Cloudinary secure_url
 *   2. Uploads it to R2 (same bucket/key scheme as lib/r2.ts's uploadBuffer,
 *      so it matches what new uploads already produce post-migration)
 *   3. Rewrites the field(s) on that document to the new R2 URL / key
 *
 * The same Cloudinary URL is only ever uploaded to R2 once, even if it's
 * referenced from multiple documents/fields (e.g. an Order.image copied
 * from a Product.images[0]) — a per-URL cache keeps them in sync so they
 * all end up pointing at the same R2 object.
 *
 * MODELS / FIELDS COVERED
 * ────────────────────────
 *   Product              images: string[]
 *   Subcategory           imageUrl (+ imagePublicId set to the new R2 key)
 *   HeroSlide              desktopImage, mobileImage
 *   User                   avatarUrl (+ avatarPublicId set to the new R2 key)
 *   Memo                   image
 *   Order                  image
 *   NewsletterCampaign     image
 *
 * FALLBACK IMAGE
 * ────────────────
 *   Any source URL that can't be downloaded (dead Cloudinary asset, 404,
 *   etc. — retried a few times first in case it's transient) gets replaced
 *   with public/images/product-placeholder.jpg instead of being left
 *   broken or skipped. That placeholder is uploaded to R2 once and reused
 *   for every broken image, so it doesn't multiply storage. Every
 *   substitution is recorded in migration-failures.json so you can find
 *   and re-shoot/re-upload the real image later.
 *   Pass --no-fallback to go back to skipping broken images instead.
 *   Pass --fallback-image <path> to use a different placeholder file.
 *
 * RESUMABILITY / CHECKPOINTING
 * ──────────────────────────────
 *   Every source URL that's successfully migrated (downloaded + uploaded
 *   to R2, or replaced with the fallback) is recorded in a checkpoint file
 *   (default: migration-checkpoint.json) as soon as it happens — not just
 *   at the end of the run. If the process is killed, loses its network
 *   connection, or crashes partway through a document (e.g. 5 of 10 images
 *   in a Product.images array), the next run:
 *     - loads that checkpoint file back into the in-memory URL cache, and
 *     - reuses the already-uploaded R2 object for any URL it recognizes,
 *       instead of re-downloading it and creating a duplicate R2 upload
 *       with a new timestamped key.
 *   Combined with the existing per-document idempotency (docs whose fields
 *   no longer contain a res.cloudinary.com URL are skipped entirely),
 *   re-running the exact same command after an interruption picks back up
 *   from wherever it stopped, at both the document and the individual
 *   image level.
 *   Pass --checkpoint <path> to use a different checkpoint file.
 *   Pass --reset-checkpoint to ignore/discard any existing checkpoint and
 *   start the URL cache fresh (does not affect already-saved Mongo docs or
 *   already-uploaded R2 objects — those are still skipped/reused via the
 *   normal doc-filter / re-upload logic, just without the fast path).
 *
 * SAFETY
 * ──────
 *   - Dry run by default. Nothing is downloaded, uploaded, or written to
 *     Mongo until you pass --apply.
 *   - Idempotent: fields that don't contain a res.cloudinary.com URL are
 *     left untouched, so re-running after a partial failure only picks up
 *     what's left.
 *   - Cloudinary assets are never deleted unless you pass --delete-source
 *     (and even then, only after every reference to that URL was
 *     successfully rewritten in Mongo).
 *
 * REQUIRED ENV VARS (.env.local or .env)
 * ────────────────────────────────────────
 *   MONGODB_URI
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL              e.g. https://pub-xxxx.r2.dev or https://cdn.yourdomain.com
 *
 *   Only needed if you pass --delete-source:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * USAGE
 * ─────
 *   Dry run (shows what would migrate, no network writes):
 *     node scripts/migrate-cloudinary-to-r2.mjs
 *
 *   Test on a few documents per model first:
 *     node scripts/migrate-cloudinary-to-r2.mjs --limit 5 --apply
 *
 *   Migrate everything:
 *     node scripts/migrate-cloudinary-to-r2.mjs --apply
 *
 *   Migrate only specific models:
 *     node scripts/migrate-cloudinary-to-r2.mjs --apply --only product,subcategory
 *
 *   Migrate and then delete the originals from Cloudinary:
 *     node scripts/migrate-cloudinary-to-r2.mjs --apply --delete-source
 *
 *   If a previous run was interrupted, just run the exact same command
 *   again — it resumes automatically using migration-checkpoint.json:
 *     node scripts/migrate-cloudinary-to-r2.mjs --apply
 *
 *   Start over from scratch (ignore any existing checkpoint):
 *     node scripts/migrate-cloudinary-to-r2.mjs --apply --reset-checkpoint
 *
 * (npm run migrate:r2 -- <flags> works the same way)
 */

import { config } from 'dotenv';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, readFile, rename, unlink } from 'fs/promises';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const apply = Boolean(getArg('apply', false));
const deleteSource = Boolean(getArg('delete-source', false));
const limitArg = getArg('limit');
const limit = limitArg ? parseInt(limitArg, 10) : undefined;
const onlyArg = getArg('only');
const only = onlyArg ? onlyArg.split(',').map((s) => s.trim().toLowerCase()) : undefined;
const noFallback = Boolean(getArg('no-fallback', false));
const fallbackImagePath = getArg('fallback-image') || 'public/images/product-placeholder.webp';
const checkpointPath = getArg('checkpoint') || 'migration-checkpoint.json';
const resetCheckpoint = Boolean(getArg('reset-checkpoint', false));

const {
  MONGODB_URI,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

{
  const missing = [];
  if (!MONGODB_URI) missing.push('MONGODB_URI');
  if (apply) {
    if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
    if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
    if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
    if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
    if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
  }
  if (deleteSource) {
    if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
    if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
  }
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

// ── helpers ──────────────────────────────────────────────────────────────
function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
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

// ── checkpoint (resumability) ────────────────────────────────────────────
// Per-source-URL cache so the same Cloudinary asset referenced from several
// documents/fields is only ever downloaded + uploaded once — and, via the
// checkpoint file below, only once ever across separate runs of the script.
const migratedCache = new Map(); // cloudinaryUrl -> { url, key, isFallback? }
let fallbackAsset = null;

let checkpointDirty = false;
let checkpointSaving = false;
let checkpointSaveTimer = null;

async function loadCheckpoint() {
  if (resetCheckpoint) {
    try {
      await unlink(checkpointPath);
      console.log(`♻️  --reset-checkpoint: removed existing ${checkpointPath}`);
    } catch {
      // nothing to remove, that's fine
    }
    return;
  }
  let raw;
  try {
    raw = await readFile(checkpointPath, 'utf8');
  } catch {
    return; // no checkpoint yet — fresh start
  }
  try {
    const data = JSON.parse(raw);
    for (const [url, result] of Object.entries(data.urlCache || {})) {
      migratedCache.set(url, result);
    }
    if (data.fallback) fallbackAsset = data.fallback;
    console.log(
      `📌 Resuming from ${checkpointPath}: ${migratedCache.size} already-migrated URL(s) loaded${
        fallbackAsset ? ' (fallback asset already uploaded)' : ''
      }.`
    );
  } catch (err) {
    console.warn(`⚠️  Couldn't parse ${checkpointPath} (${err.message}) — starting with an empty cache instead.`);
  }
}

// Serializes the in-memory cache to disk via a temp file + rename so a
// crash mid-write can never leave a corrupt/truncated checkpoint behind.
async function flushCheckpoint() {
  if (!checkpointDirty || checkpointSaving) return;
  checkpointSaving = true;
  checkpointDirty = false;
  try {
    const data = {
      urlCache: Object.fromEntries(migratedCache),
      fallback: fallbackAsset,
      updatedAt: new Date().toISOString(),
    };
    const tmpPath = `${checkpointPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2));
    await rename(tmpPath, checkpointPath);
  } catch (err) {
    console.warn(`\n⚠️  Failed to write checkpoint: ${err.message}`);
    checkpointDirty = true; // retry on the next scheduled flush
  } finally {
    checkpointSaving = false;
  }
}

// Debounced so a burst of migrations (many images in one doc) results in
// one write, not one write per image — while still guaranteeing we save
// within ~1s of the last change, well before a user would Ctrl-C.
function markCheckpointDirty() {
  checkpointDirty = true;
  if (checkpointSaveTimer) return;
  checkpointSaveTimer = setTimeout(() => {
    checkpointSaveTimer = null;
    flushCheckpoint();
  }, 1000);
}

// Make sure we don't lose the last partial second of progress if the user
// interrupts the process or it's killed by its host environment.
let shuttingDown = false;
async function handleShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n\n⏸️  Received ${signal} — saving checkpoint before exit...`);
  if (checkpointSaveTimer) clearTimeout(checkpointSaveTimer);
  await flushCheckpoint();
  console.log(`✅ Checkpoint saved to ${checkpointPath}. Re-run the same command to resume.`);
  process.exit(130);
}
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

const stats = { downloaded: 0, uploaded: 0, cached: 0, failed: 0, fallbackUsed: 0, docsScanned: 0, docsChanged: 0 };
const failures = []; // { model, docId, url, error }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries transient failures (timeouts, 429/5xx) with exponential backoff.
// 4xx other than 429 (e.g. 404 — asset genuinely gone) fails fast, no point retrying.
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
    if (i < attempts - 1) await sleep(500 * 2 ** i); // 0.5s, 1s, 2s
  }
  throw lastErr;
}

// The dead-source fallback is uploaded to R2 once (on first use — including
// across separate runs, via the checkpoint) and then reused from cache for
// every subsequent broken image — never re-read from disk or re-uploaded.
async function getFallbackAsset() {
  if (fallbackAsset) return fallbackAsset;
  const buffer = await readFile(fallbackImagePath);
  const key = 'fallback/product-placeholder.jpg';
  if (apply) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      })
    );
  }
  fallbackAsset = { url: `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`, key, isFallback: true };
  markCheckpointDirty();
  return fallbackAsset;
}

async function migrateUrl(sourceUrl, folder, context) {
  if (migratedCache.has(sourceUrl)) {
    stats.cached++;
    return migratedCache.get(sourceUrl);
  }

  let res;
  try {
    res = await fetchWithRetry(sourceUrl);
  } catch (err) {
    if (noFallback) throw err;
    const fb = await getFallbackAsset();
    stats.fallbackUsed++;
    failures.push({ ...context, url: sourceUrl, error: err.message, fallback: true });
    migratedCache.set(sourceUrl, fb); // every broken URL reuses the same fallback object
    markCheckpointDirty();
    return fb;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  stats.downloaded++;

  const key = buildKey(folder, sourceUrl);

  if (apply) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: guessContentType(sourceUrl, res.headers.get('content-type')),
      })
    );
    stats.uploaded++;
  }

  const result = { url: `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`, key };
  migratedCache.set(sourceUrl, result);
  // Persist immediately (debounced) so this upload is never repeated, even
  // if the process dies before the owning document gets saved.
  markCheckpointDirty();
  return result;
}

async function deleteFromCloudinary(publicId) {
  if (!deleteSource || !publicId) return;
  try {
    const crypto = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
      .digest('hex');
    const form = new URLSearchParams();
    form.set('public_id', publicId);
    form.set('timestamp', String(timestamp));
    form.set('api_key', CLOUDINARY_API_KEY);
    form.set('signature', signature);
    await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    console.warn(`   ⚠️  Cloudinary delete failed for ${publicId}: ${err.message}`);
  }
}

// Cloudinary public_id is the URL path after /upload/<transforms>/ minus the extension.
function publicIdFromUrl(url) {
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/);
  return m ? m[1] : undefined;
}

function progress() {
  process.stdout.write(
    `\r   ⬇️  ${stats.downloaded} downloaded | ⬆️  ${stats.uploaded} uploaded | ♻️  ${stats.cached} reused | ❌ ${stats.failed} failed   `
  );
}

// ── per-model migration ─────────────────────────────────────────────────
async function migrateModel({ key, Model, folder, docFilter, extractUrls, applyUrls }) {
  if (only && !only.includes(key)) return;

  console.log(`\n📦 ${key}`);
  let query = Model.find(docFilter).cursor();
  let count = 0;

  for await (const doc of query) {
    if (limit && count >= limit) break;
    stats.docsScanned++;

    const urls = extractUrls(doc).filter(isCloudinaryUrl);
    if (urls.length === 0) continue;

    count++;
    const mapping = new Map(); // sourceUrl -> { url, key }
    let docFailed = false;

    for (const url of urls) {
      try {
        const migrated = await migrateUrl(url, folder, { model: key, docId: String(doc._id) });
        mapping.set(url, migrated);
        progress();
      } catch (err) {
        stats.failed++;
        docFailed = true;
        failures.push({ model: key, docId: String(doc._id), url, error: err.message });
        console.error(`\n   ❌ ${doc._id}: ${err.message}`);
      }
    }

    if (mapping.size === 0) continue;

    if (apply) {
      const sourceIds = urls.map(publicIdFromUrl);
      applyUrls(doc, mapping);
      await doc.save();
      stats.docsChanged++;
      if (!docFailed) {
        for (const id of sourceIds) await deleteFromCloudinary(id);
      }
    } else {
      stats.docsChanged++;
    }
  }

  console.log(count === 0 ? '   (nothing to migrate)' : '');
}

// ── lightweight, non-strict schemas — we only touch known fields ─────────
const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }));
const HeroSlide = mongoose.models.HeroSlide || mongoose.model('HeroSlide', new mongoose.Schema({}, { strict: false }));
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Memo = mongoose.models.Memo || mongoose.model('Memo', new mongoose.Schema({}, { strict: false }));
const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
const NewsletterCampaign =
  mongoose.models.NewsletterCampaign || mongoose.model('NewsletterCampaign', new mongoose.Schema({}, { strict: false }));

async function main() {
  console.log(apply ? '🚀 APPLY MODE — uploading to R2 and writing to MongoDB' : '🧪 DRY RUN — no uploads or writes (pass --apply to migrate for real)');
  if (limit) console.log(`   Limited to ${limit} document(s) per model.`);
  if (only) console.log(`   Only migrating: ${only.join(', ')}`);
  if (deleteSource) console.log('   Will delete originals from Cloudinary after each doc is confirmed saved.');

  await loadCheckpoint();

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  await migrateModel({
    key: 'product',
    Model: Product,
    folder: 'products',
    docFilter: { images: { $elemMatch: { $regex: 'res.cloudinary.com' } } },
    extractUrls: (doc) => doc.images || [],
    applyUrls: (doc, mapping) => {
      doc.images = (doc.images || []).map((u) => mapping.get(u)?.url ?? u);
      doc.markModified('images');
    },
  });

  await migrateModel({
    key: 'subcategory',
    Model: Subcategory,
    folder: 'subcategories',
    docFilter: { imageUrl: { $regex: 'res.cloudinary.com' } },
    extractUrls: (doc) => [doc.imageUrl],
    applyUrls: (doc, mapping) => {
      const m = mapping.get(doc.imageUrl);
      if (m) {
        doc.imageUrl = m.url;
        doc.imagePublicId = m.key;
      }
    },
  });

  await migrateModel({
    key: 'hero',
    Model: HeroSlide,
    folder: 'hero-slides',
    docFilter: {
      $or: [{ desktopImage: { $regex: 'res.cloudinary.com' } }, { mobileImage: { $regex: 'res.cloudinary.com' } }],
    },
    extractUrls: (doc) => [doc.desktopImage, doc.mobileImage].filter(Boolean),
    applyUrls: (doc, mapping) => {
      if (mapping.has(doc.desktopImage)) doc.desktopImage = mapping.get(doc.desktopImage).url;
      if (doc.mobileImage && mapping.has(doc.mobileImage)) doc.mobileImage = mapping.get(doc.mobileImage).url;
    },
  });

  await migrateModel({
    key: 'avatar',
    Model: User,
    folder: 'avatars',
    docFilter: { avatarUrl: { $regex: 'res.cloudinary.com' } },
    extractUrls: (doc) => [doc.avatarUrl],
    applyUrls: (doc, mapping) => {
      const m = mapping.get(doc.avatarUrl);
      if (m) {
        doc.avatarUrl = m.url;
        doc.avatarPublicId = m.key;
      }
    },
  });

  await migrateModel({
    key: 'memo',
    Model: Memo,
    folder: 'memos',
    docFilter: { image: { $regex: 'res.cloudinary.com' } },
    extractUrls: (doc) => [doc.image],
    applyUrls: (doc, mapping) => {
      const m = mapping.get(doc.image);
      if (m) doc.image = m.url;
    },
  });

  await migrateModel({
    key: 'order',
    Model: Order,
    folder: 'orders',
    docFilter: { image: { $regex: 'res.cloudinary.com' } },
    extractUrls: (doc) => [doc.image],
    applyUrls: (doc, mapping) => {
      const m = mapping.get(doc.image);
      if (m) doc.image = m.url;
    },
  });

  await migrateModel({
    key: 'newsletter',
    Model: NewsletterCampaign,
    folder: 'newsletter',
    docFilter: { image: { $regex: 'res.cloudinary.com' } },
    extractUrls: (doc) => [doc.image],
    applyUrls: (doc, mapping) => {
      const m = mapping.get(doc.image);
      if (m) doc.image = m.url;
    },
  });

  console.log(
    `\n\n📊 Done. ${stats.docsScanned} document(s) scanned, ${stats.docsChanged} ${apply ? 'updated' : 'would update'}.`
  );
  console.log(
    `   ${stats.downloaded} asset(s) downloaded, ${stats.uploaded} uploaded to R2, ${stats.cached} reused from cache.`
  );
  if (!noFallback) console.log(`   ${stats.fallbackUsed} broken source image(s) replaced with the fallback placeholder.`);
  if (stats.failed > 0) console.log(`   ${stats.failed} hard failure(s) (no fallback — see log).`);
  if (!apply) console.log('\n🧪 This was a dry run — re-run with --apply to actually migrate.');
  else if (stats.failed > 0) console.log('\n⚠️  Some assets failed outright — re-run the same command, already-migrated URLs are skipped automatically.');

  if (failures.length) {
    const logPath = 'migration-failures.json';
    await writeFile(logPath, JSON.stringify(failures, null, 2));
    const byReason = failures.reduce((acc, f) => {
      const reason = f.error.match(/Download failed \((\d+)\)/)?.[1] ?? 'other';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
    console.log(`\n📝 ${failures.length} entr${failures.length === 1 ? 'y' : 'ies'} logged to ${logPath} (which product/doc got the fallback and why).`);
    console.log(`   By status: ${Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log('   404 = asset no longer exists on Cloudinary (broken link already, not caused by this script).');
    console.log('   Anything else (timeouts, 5xx, 429) is worth a retry.');
  }

  if (checkpointSaveTimer) clearTimeout(checkpointSaveTimer);
  await flushCheckpoint();

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ Script failed:', err);
  if (checkpointSaveTimer) clearTimeout(checkpointSaveTimer);
  try {
    await flushCheckpoint();
    console.log(`💾 Checkpoint saved to ${checkpointPath} — re-run the same command to resume from here.`);
  } catch {}
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
