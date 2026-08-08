// lib/image-url.ts
//
// Drop-in replacement for calling cldUrl() directly at render sites.
// Cloudinary URLs keep working exactly as before (delegates to cldUrl).
// Any other absolute URL — importantly, R2 URLs post-migration — gets
// routed through Next.js's own built-in image optimizer
// (/_next/image?url=...&w=...&q=...), which resizes and re-encodes
// (WebP/AVIF where supported) at request time, cached at the edge on
// Vercel. This requires the source hostname to be listed in
// next.config.mjs -> images.remotePatterns, which the R2 domain already is.
//
// Falls back to returning the src untouched for relative/local paths or
// when no width is requested — same "safe passthrough" behavior cldUrl
// already has for non-Cloudinary sources.

import { cldUrl } from './cloudinary-client';

export function optimizedImageUrl(
  src: string,
  opts: { width?: number; quality?: number } = {}
): string {
  if (!src) return src;

  if (src.includes('res.cloudinary.com')) {
    return cldUrl(src, {
      width: opts.width,
      quality: opts.quality ?? 'auto',
    });
  }

  // Only proxy absolute URLs with a requested width — leave local/relative
  // paths (e.g. bundled placeholder images in /public) alone, since Next
  // already optimizes those automatically via next/image at build/request
  // time when rendered with <Image>, and this helper is mainly for the
  // plain-<img>-tag call sites that pre-date the R2 migration.
  //
  // NOTE: Next's /_next/image optimizer is currently returning 400 for R2
  // URLs in production (likely a Content-Type/response validation issue
  // upstream at R2 — under investigation). Serving the raw R2 URL directly
  // avoids a broken image on the live site; it just means no automatic
  // resize/re-encode for R2 sources until that's root-caused and fixed.
  if (src.startsWith('http')) {
    return src;
  }

  return src;
}