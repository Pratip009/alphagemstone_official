/**
 * Migrates every image from YOUR Cloudinary account to the CLIENT's
 * Cloudinary account, preserving the same public_id / folder structure.
 * Cloudinary fetches each asset server-to-server via its secure_url (no
 * download to this machine needed) and re-uploads it under the same
 * public_id on the destination account.
 *
 * After migration, optionally rewrites every product's `images` array in
 * MongoDB so the stored URLs point at the client's cloud_name instead of
 * yours.
 *
 * SAFETY
 * ──────
 *   - Dry run by default. Nothing is uploaded or written until you pass
 *     the relevant --apply / --update-db flags.
 *   - Idempotent: if a public_id already exists on the destination account,
 *     it's skipped (safe to re-run after a partial failure).
 *   - DB rewrite is a SEPARATE flag from the upload step, so you can verify
 *     every image actually migrated correctly before touching Mongo.
 *
 * REQUIRED ENV VARS (.env.local or .env)
 * ────────────────────────────────────────
 *   SOURCE_CLOUDINARY_CLOUD_NAME
 *   SOURCE_CLOUDINARY_API_KEY
 *   SOURCE_CLOUDINARY_API_SECRET
 *
 *   DEST_CLOUDINARY_CLOUD_NAME
 *   DEST_CLOUDINARY_API_KEY
 *   DEST_CLOUDINARY_API_SECRET
 *
 *   MONGODB_URI                (only needed if using --update-db)
 *
 * USAGE
 * ─────
 *   Dry run (lists what would migrate, no uploads):
 *     node scripts/migrate-cloudinary-account.mjs
 *
 *   Test on a few images first:
 *     node scripts/migrate-cloudinary-account.mjs --limit 5 --apply
 *
 *   Migrate everything:
 *     node scripts/migrate-cloudinary-account.mjs --apply
 *
 *   After confirming all images look correct on the client's account,
 *   rewrite MongoDB URLs to point at the new cloud (dry run first, no flag):
 *     node scripts/migrate-cloudinary-account.mjs --update-db
 *
 *   Then actually write to Mongo:
 *     node scripts/migrate-cloudinary-account.mjs --update-db --apply
 */

import { config } from 'dotenv';
import crypto from 'crypto';
import mongoose from 'mongoose';

config({ path: '.env.local' });
config();

function getArg(name, hasValue = true) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  if (!hasValue) return true;
  return process.argv[i + 1];
}

const apply = Boolean(getArg('apply', false));
const updateDb = Boolean(getArg('update-db', false));
const limitArg = getArg('limit');
const limit = limitArg ? parseInt(limitArg, 10) : undefined;
const folderFilter = getArg('folder');

const {
  SOURCE_CLOUDINARY_CLOUD_NAME,
  SOURCE_CLOUDINARY_API_KEY,
  SOURCE_CLOUDINARY_API_SECRET,
  DEST_CLOUDINARY_CLOUD_NAME,
  DEST_CLOUDINARY_API_KEY,
  DEST_CLOUDINARY_API_SECRET,
  MONGODB_URI,
} = process.env;

if (!updateDb) {
  const missing = [];
  if (!SOURCE_CLOUDINARY_CLOUD_NAME) missing.push('SOURCE_CLOUDINARY_CLOUD_NAME');
  if (!SOURCE_CLOUDINARY_API_KEY) missing.push('SOURCE_CLOUDINARY_API_KEY');
  if (!SOURCE_CLOUDINARY_API_SECRET) missing.push('SOURCE_CLOUDINARY_API_SECRET');
  if (!DEST_CLOUDINARY_CLOUD_NAME) missing.push('DEST_CLOUDINARY_CLOUD_NAME');
  if (!DEST_CLOUDINARY_API_KEY) missing.push('DEST_CLOUDINARY_API_KEY');
  if (!DEST_CLOUDINARY_API_SECRET) missing.push('DEST_CLOUDINARY_API_SECRET');
  if (missing.length) {
    console.error(`❌ Missing env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ── Admin API: list all resources on the source account ────────────────────
async function listSourceResources() {
  const resources = [];
  let nextCursor;
  const auth = Buffer.from(`${SOURCE_CLOUDINARY_API_KEY}:${SOURCE_CLOUDINARY_API_SECRET}`).toString('base64');

  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${SOURCE_CLOUDINARY_CLOUD_NAME}/resources/image`);
    url.searchParams.set('type', 'upload');
    url.searchParams.set('max_results', '500');
    if (folderFilter) url.searchParams.set('prefix', folderFilter);
    // No folder filter = scan the WHOLE account, not just a "products/" prefix.
    // Your actual images live under "alphaimports-legacy/", not "products/".
    if (nextCursor) url.searchParams.set('next_cursor', nextCursor);

    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) {
      throw new Error(`Source Admin API error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    resources.push(...data.resources);
    nextCursor = data.next_cursor;
    process.stdout.write(`\rListed ${resources.length} source image(s)...`);
  } while (nextCursor);

  console.log('');
  return resources;
}

// ── Admin API: check if a public_id already exists on destination ─────────
async function existsOnDestination(publicId) {
  const auth = Buffer.from(`${DEST_CLOUDINARY_API_KEY}:${DEST_CLOUDINARY_API_SECRET}`).toString('base64');
  const url = `https://api.cloudinary.com/v1_1/${DEST_CLOUDINARY_CLOUD_NAME}/resources/image/upload/${encodeURIComponent(publicId)}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  return res.ok;
}

// ── Upload API: signed fetch-upload from source secure_url to destination ─
function signParams(params, apiSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex');
}

async function uploadToDestination(sourceUrl, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = publicId.includes('/') ? publicId.split('/').slice(0, -1).join('/') : undefined;
  const filenameOnly = publicId.includes('/') ? publicId.split('/').pop() : publicId;

  const paramsToSign = {
    public_id: publicId,
    timestamp,
  };
  const signature = signParams(paramsToSign, DEST_CLOUDINARY_API_SECRET);

  const form = new URLSearchParams();
  form.set('file', sourceUrl); // Cloudinary fetches this server-to-server
  form.set('public_id', publicId);
  form.set('timestamp', String(timestamp));
  form.set('api_key', DEST_CLOUDINARY_API_KEY);
  form.set('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${DEST_CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Upload failed for ${publicId}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Step 1: migrate assets ──────────────────────────────────────────────
async function migrateAssets() {
  console.log(`Listing images on source account "${SOURCE_CLOUDINARY_CLOUD_NAME}"...\n`);
  let resources = await listSourceResources();
  if (limit) resources = resources.slice(0, limit);

  console.log(`\nFound ${resources.length} image(s) to migrate${limit ? ` (limited to ${limit})` : ''}.\n`);

  if (!apply) {
    console.log('🧪 DRY RUN — no uploads will happen. Sample of what would migrate:\n');
    for (const r of resources.slice(0, 5)) {
      console.log(`   ${r.public_id}  (${r.width}x${r.height})`);
    }
    console.log('\nRe-run with --apply to actually migrate. Use --limit N to test on a few first.');
    return;
  }

  let migrated = 0, skipped = 0, failed = 0;
  for (const r of resources) {
    try {
      const already = await existsOnDestination(r.public_id);
      if (already) {
        skipped++;
        process.stdout.write(`\r✅ Migrated: ${migrated} | ⏭️  Skipped (exists): ${skipped} | ❌ Failed: ${failed}`);
        continue;
      }
      await uploadToDestination(r.secure_url, r.public_id);
      migrated++;
    } catch (err) {
      failed++;
      console.error(`\n❌ ${r.public_id}: ${err.message}`);
    }
    process.stdout.write(`\r✅ Migrated: ${migrated} | ⏭️  Skipped (exists): ${skipped} | ❌ Failed: ${failed}`);
  }

  console.log(`\n\n📊 Done. Migrated ${migrated}, skipped ${skipped} (already existed), failed ${failed}.`);
  if (failed > 0) {
    console.log('⚠️  Some uploads failed — re-run the same command, it will skip already-migrated ones and retry the rest.');
  }
  console.log(`\nNext: spot-check a few images on the client's account, then run with --update-db to repoint MongoDB.`);
}

// ── Step 2: update MongoDB URLs to point at the new cloud name ────────────
async function updateDatabase() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set');
    process.exit(1);
  }
  if (!DEST_CLOUDINARY_CLOUD_NAME) {
    console.error('❌ DEST_CLOUDINARY_CLOUD_NAME is not set');
    process.exit(1);
  }
  // SOURCE_CLOUDINARY_CLOUD_NAME needed to know what to replace
  const sourceCloud = SOURCE_CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!sourceCloud) {
    console.error('❌ SOURCE_CLOUDINARY_CLOUD_NAME is not set (needed to know what to replace in URLs)');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(`Rewriting URLs: res.cloudinary.com/${sourceCloud}/... -> res.cloudinary.com/${DEST_CLOUDINARY_CLOUD_NAME}/...\n`);

  const ProductSchema = new mongoose.Schema({ images: [String] }, { strict: false });
  const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

  const cursor = Product.find({ 'images.0': { $exists: true } }).select('images').cursor();

  let scanned = 0, changed = 0, imagesChanged = 0;
  let bulkOps = [];
  const BATCH_SIZE = 500;

  for await (const product of cursor) {
    scanned++;
    let didChange = false;
    const newImages = (product.images || []).map((url) => {
      if (typeof url === 'string' && url.includes(`res.cloudinary.com/${sourceCloud}/`)) {
        didChange = true;
        imagesChanged++;
        return url.replace(`res.cloudinary.com/${sourceCloud}/`, `res.cloudinary.com/${DEST_CLOUDINARY_CLOUD_NAME}/`);
      }
      return url;
    });

    if (didChange) {
      changed++;
      if (apply) {
        bulkOps.push({ updateOne: { filter: { _id: product._id }, update: { $set: { images: newImages } } } });
        if (bulkOps.length >= BATCH_SIZE) {
          await Product.bulkWrite(bulkOps, { ordered: false });
          bulkOps = [];
        }
      }
    }
  }
  if (apply && bulkOps.length) await Product.bulkWrite(bulkOps, { ordered: false });

  console.log(`📊 Scanned ${scanned} product(s), ${apply ? 'updated' : 'would update'} ${changed} product(s) / ${imagesChanged} image URL(s).`);
  if (!apply) console.log('🧪 DRY RUN — re-run with --update-db --apply to write changes.');
  await mongoose.disconnect();
}

async function main() {
  if (updateDb) {
    await updateDatabase();
  } else {
    await migrateAssets();
  }
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
