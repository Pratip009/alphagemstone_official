// lib/r2.ts
// Cloudflare R2 replacement for lib/cloudinary.ts.
// Same public interface (uploadBuffer / destroyImage) so every route that
// previously imported from '@/lib/cloudinary' only needs its import path
// changed — no call-site changes required.
//
// R2 is S3-compatible, so this uses @aws-sdk/client-s3 pointed at R2's
// account-scoped endpoint. The same code works unmodified against real AWS
// S3 too — just point R2_* env vars at your S3 bucket/region instead.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL, // e.g. https://pub-xxxx.r2.dev  or  https://cdn.yourdomain.com
} = process.env;

function requireEnv() {
  const missing: string[] = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
  if (missing.length) {
    throw new Error(`[r2] Missing env var(s): ${missing.join(', ')}`);
  }
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? '',
  },
});

function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
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
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

// ── uploadBuffer ────────────────────────────────────────────────────────────
// Drop-in replacement for cloudinary.ts's uploadBuffer. `public_id` here is
// the R2 object key (folder/timestamp-filename), and `secure_url` is the
// public URL built from R2_PUBLIC_URL — same shape the rest of the app
// already expects (secure_url, public_id).
export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  folder = 'subcategories'
): Promise<{ secure_url: string; public_id: string }> {
  requireEnv();

  // Mirror Cloudinary's old public_id scheme: strip extension, prefix with
  // a timestamp so re-uploads of the same filename never collide.
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = filename.match(/\.[^.]+$/)?.[0] ?? '';
  const key = `${folder}/${Date.now()}-${base}${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: guessContentType(filename),
    })
  );

  const secure_url = `${R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
  return { secure_url, public_id: key };
}

// ── destroyImage ────────────────────────────────────────────────────────────
// `publicId` is the R2 object key (what uploadBuffer returned as public_id).
// Never throws — a failed delete should not block the main operation.
export async function destroyImage(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    requireEnv();
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: publicId,
      })
    );
  } catch (err) {
    console.warn('[R2] destroy failed for', publicId, err);
  }
}