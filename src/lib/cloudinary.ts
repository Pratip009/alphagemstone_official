// lib/cloudinary.ts
// Single place to configure Cloudinary and expose a typed upload helper.
// Import this in your route handlers — never paste the config inline.

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export { cloudinary };

// ── uploadBuffer ────────────────────────────────────────────────────────────
// Wraps cloudinary.uploader.upload_stream in a Promise so you can await it.
// folder   : Cloudinary folder, e.g. "subcategories"
// filename : Original filename — used to build a readable public_id
export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  folder = 'subcategories'
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        // strip extension from filename so Cloudinary doesn't double it
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        overwrite: false,
        resource_type: 'image',
        // No transformations at upload time — store the original at full quality.
        // For hero-slides we need full-resolution images; for other folders the
        // consumer can apply URL-based transforms via getOptimisedUrl() below.
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// ── getOptimisedUrl ──────────────────────────────────────────────────────────
// Returns a Cloudinary delivery URL with quality/format transformations applied
// at fetch time (never baked into the stored asset).
//
// Usage for hero images:
//   getOptimisedUrl(slide.desktopImage, { width: 1920, quality: 90 })
//
// The input can be either a full https://res.cloudinary.com/… URL or a raw
// public_id.  We reconstruct it so the transform is injected at the right place.
export function getOptimisedUrl(
  src: string,
  opts: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: 'auto' | 'webp' | 'jpg' | 'png';
    crop?: string;
  } = {}
): string {
  const {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'limit',
  } = opts;

  // Build the transformation string
  const parts: string[] = [];
  if (width)  parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push(`c_${crop}`);
  parts.push(`q_${quality}`);
  parts.push(`f_${format}`);
  const transform = parts.join(',');

  // If it's already a Cloudinary URL, inject the transform segment after /upload/
  if (src.includes('res.cloudinary.com')) {
    return src.replace('/upload/', `/upload/${transform}/`);
  }

  // Otherwise treat it as a public_id and build the URL from scratch
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${src}`;
}

// ── destroyImage ────────────────────────────────────────────────────────────
// Silently deletes an image from Cloudinary.
// Never throws — a failed delete should not block the main operation.
export async function destroyImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[Cloudinary] destroy failed for', publicId, err);
  }
}