/**
 * Builds a single test URL using Cloudinary's Generative Upscale AI add-on
 * (e_gen_upscale) so you can verify — by opening it in a browser — whether
 * your Cloudinary plan has this add-on enabled BEFORE we roll it out across
 * the zoom feature or the whole catalog.
 *
 * WHY TEST FIRST
 * ───────────────
 * If the add-on isn't enabled on your plan, Cloudinary returns an error
 * image (or a 420-style response) instead of your product photo. Better to
 * find that out on one image than after wiring it into the live site.
 *
 * USAGE
 * ─────
 *   node scripts/test-ai-upscale.mjs --public-id "products/black-diamonds/xyz"
 *
 *   Or just run it with no args and it'll grab the first Cloudinary image
 *   it finds under products/ automatically:
 *   node scripts/test-ai-upscale.mjs
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

function getArg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

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

async function main() {
  let publicId = getArg('public-id');

  if (!publicId) {
    console.log('No --public-id given, grabbing the first image under products/...\n');
    const res = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix: 'products/',
      max_results: 1,
    });
    if (!res.resources.length) {
      console.error('❌ No images found under products/. Pass --public-id explicitly.');
      process.exit(1);
    }
    publicId = res.resources[0].public_id;
    console.log(`Using: ${publicId} (${res.resources[0].width}x${res.resources[0].height})\n`);
  }

  const normalUrl = cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: 2200, crop: 'limit', quality: 'auto:best', fetch_format: 'auto' }],
  });

  const upscaledUrl = cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { effect: 'gen_upscale' },
      { width: 2200, crop: 'scale', quality: 'auto:best', fetch_format: 'auto' },
    ],
  });

  console.log('── Normal (c_limit, never upscales past original) ──');
  console.log(normalUrl);
  console.log('\n── AI Upscale (e_gen_upscale, can enlarge past original) ──');
  console.log(upscaledUrl);
  console.log('\nOpen BOTH links in your browser:');
  console.log('  - If the AI Upscale link shows your actual product photo, larger and still sharp -> add-on is enabled, we can proceed.');
  console.log('  - If it shows a broken image / Cloudinary error page -> the add-on isn\'t enabled on your plan.');
  console.log('    In that case, log into Cloudinary Console -> Add-ons, and check if "Generative Upscale" (or the AI/GenAI transformations add-on) is available for your plan tier.');
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
