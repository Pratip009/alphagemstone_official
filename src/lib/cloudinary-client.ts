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
     *
     * IMPORTANT: e_upscale is a FIXED ~4x-per-dimension multiplier, not a
     * "resize to my target width" operation (Cloudinary's own docs: it
     * "scales each dimension by four, multiplying the total number of
     * pixels by 16"). A 100x100 source only reaches ~400x400 through one
     * pass — asking for width:900 beyond that just falls back to plain
     * interpolation for the remainder, which is blurry. Use upscalePasses
     * to chain it more than once for very small sources.
     */
    aiUpscale?: boolean;
    /**
     * How many times to chain e_upscale before the final resize (default 1
     * = ~4x). Each pass is its own transformation step, e.g. 2 passes on a
     * 100x100 source reaches ~1600x1600 before we scale back down to the
     * requested width — a downscale, which stays sharp, instead of
     * stretching a 400x400 result up to 900 with ordinary interpolation.
     * Each pass is a separate premium AI transform, so only raise this for
     * sources you know are small; it costs more and is slower to generate.
     */
    upscalePasses?: number;
  } = {}
): string {
  // Pass through anything that isn't a Cloudinary asset (e.g. Unsplash fallbacks)
  if (!src.includes('res.cloudinary.com') && !src.startsWith('http')) {
    // only a bare public_id reaches here — safe to build a Cloudinary URL
  } else if (!src.includes('res.cloudinary.com')) {
    return src; // some other absolute URL (Unsplash, etc.) — leave untouched
  }

  const {
    width,
    quality = 'auto',
    format = 'auto',
    aiUpscale = false,
    upscalePasses = 1,
  } = opts;

  // e_upscale needs to run as its OWN chained step(s) — combining it with
  // w_/c_ in a single comma-separated component makes Cloudinary treat it
  // as one ordinary crop/resize instruction instead of running the AI
  // upscale first. Cloudinary's documented pattern chains them with "/",
  // e.g. c_scale,w_1200/e_upscale,f_auto,q_auto.
  const segments: string[] = [];
  if (aiUpscale) {
    const passes = Math.max(1, upscalePasses);
    for (let i = 0; i < passes; i++) segments.push('e_upscale');
  }

  const finalParts: string[] = [];
  if (width) finalParts.push(`w_${width}`, aiUpscale ? 'c_scale' : 'c_limit');
  finalParts.push(`q_${quality}`, `f_${format}`);
  segments.push(finalParts.join(','));

  const transform = segments.join('/');

  if (src.includes('res.cloudinary.com')) {
    return src.replace('/upload/', `/upload/${transform}/`);
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${src}`;
}