// lib/cloudinary-client.ts
export function cldUrl(
  src: string,
  opts: {
    width?: number;
    quality?: number | 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | 'auto:low';
    format?: 'auto';
    /**
     * When true, allows Cloudinary to enlarge PAST the original resolution
     * using their Upscale AI effect, instead of c_limit (which never
     * upscales and just returns the original size). Requires the
     * add-on to be enabled on the Cloudinary plan — if it isn't, Cloudinary
     * returns an error image, so test on one product first.
     */
    aiUpscale?: boolean;
  } = {}
): string {
  // Pass through anything that isn't a Cloudinary asset (e.g. Unsplash fallbacks)
  if (!src.includes('res.cloudinary.com') && !src.startsWith('http')) {
    // only a bare public_id reaches here — safe to build a Cloudinary URL
  } else if (!src.includes('res.cloudinary.com')) {
    return src; // some other absolute URL (Unsplash, etc.) — leave untouched
  }

  const { width, quality = 'auto', format = 'auto', aiUpscale = false } = opts;
  const parts: string[] = [];
  if (aiUpscale) parts.push('e_upscale');
  if (width) parts.push(`w_${width}`, aiUpscale ? 'c_scale' : 'c_limit');
  parts.push(`q_${quality}`, `f_${format}`);
  const transform = parts.join(',');

  if (src.includes('res.cloudinary.com')) {
    return src.replace('/upload/', `/upload/${transform}/`);
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${src}`;
}