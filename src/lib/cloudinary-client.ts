// lib/cloudinary-client.ts
export function cldUrl(
  src: string,
  opts: { width?: number; quality?: number | 'auto'; format?: 'auto' } = {}
): string {
  // Pass through anything that isn't a Cloudinary asset (e.g. Unsplash fallbacks)
  if (!src.includes('res.cloudinary.com') && !src.startsWith('http')) {
    // only a bare public_id reaches here — safe to build a Cloudinary URL
  } else if (!src.includes('res.cloudinary.com')) {
    return src; // some other absolute URL (Unsplash, etc.) — leave untouched
  }

  const { width, quality = 'auto', format = 'auto' } = opts;
  const parts: string[] = [];
  if (width) parts.push(`w_${width}`, 'c_limit');
  parts.push(`q_${quality}`, `f_${format}`);
  const transform = parts.join(',');

  if (src.includes('res.cloudinary.com')) {
    return src.replace('/upload/', `/upload/${transform}/`);
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${src}`;
}