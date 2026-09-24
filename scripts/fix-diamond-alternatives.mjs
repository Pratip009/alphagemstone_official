/**
 * Move moissanite, cubic zirconia, simulated and lab-created (non-diamond)
 * stones out of the natural-stone categories into a new
 * "Diamond Alternatives" category, and stop presenting them as diamonds.
 *
 * What it does
 *   1. Creates the "Diamond Alternatives" category (listed right after
 *      Diamonds) with four subcategories: Moissanite, Cubic Zirconia (CZ),
 *      Simulated Stones, Lab-Created Stones.
 *   2. Moves matching products from Diamonds / Precious Gems / Semi Precious
 *      into it. Jewelry and Specials keep their category (a CZ pendant is
 *      still jewelry), but are corrected in step 3.
 *   3. Any matching product typed productKind "diamond" becomes "gemstone".
 *   4. Renames moissanite listings that call themselves a diamond:
 *      "2 Carat Round Moissanite Synthetic Diamond" → "2 Carat Round Moissanite"
 *      (name, metaTitle, metaDescription, metaKeywords). URLs/slugs are NOT
 *      changed, so existing links keep working.
 *   5. Hides the old "Moissanite Synthetic" and "Mystic CZ" subcategories
 *      once they are empty. Nothing is deleted. ("Simulated Gemstones" is
 *      left alone: most of its products are natural stones.)
 *
 * Lab-grown / created / synthetic DIAMONDS are real diamonds and are left
 * where they are — they are only listed in the report for a manual check.
 *
 * Safe by default: without --apply it only prints what WOULD change.
 * Safe to re-run: every step is idempotent.
 *
 * Usage:
 *   MONGODB_URI=... node scripts/fix-diamond-alternatives.mjs          # preview
 *   MONGODB_URI=... node scripts/fix-diamond-alternatives.mjs --apply  # write
 *
 * Keep the patterns below in sync with src/lib/diamondAlternatives.ts.
 */
import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// ─── Classification (mirror of src/lib/diamondAlternatives.ts) ──────────────
export const TARGET_CATEGORY = 'Diamond Alternatives';
export const SUBCATEGORIES = {
  moissanite: { name: 'Moissanite', slug: 'moissanite' },
  cz: { name: 'Cubic Zirconia (CZ)', slug: 'cubic-zirconia' },
  simulated: { name: 'Simulated Stones', slug: 'simulated-stones' },
  labCreated: { name: 'Lab-Created Stones', slug: 'lab-created-stones' },
};
const MOISSANITE = /moissanite/i;
const CZ = /\bcz\b|cubic\s+zirconi/i;
const SIMULATED = /simulat|imitation/i;
const LAB_CREATED = /synthetic|lab[-\s]?(created|grown)|\bcreated\b|man[-\s]?made/i;
const DIAMOND = /diamond/i;

export function classifyAlternative(...texts) {
  const t = texts.filter(Boolean).join(' ');
  if (!t) return null;
  if (MOISSANITE.test(t)) return 'moissanite';
  if (CZ.test(t)) return 'cz';
  if (SIMULATED.test(t)) return 'simulated';
  if (LAB_CREATED.test(t)) return DIAMOND.test(t) ? null : 'labCreated';
  return null;
}

/**
 * Legacy subcategories that contain ONLY alternatives (verified against the
 * data): their images are reused and they are hidden once empty.
 * Classification itself is always per product, by its own name — the legacy
 * "Simulated Gemstones" subcategory, for example, mostly holds NATURAL
 * stones (Swiss Blue Topaz, Garnet, Citrine…) and must not be moved wholesale.
 */
export const LEGACY_SUBCATEGORY_KIND = {
  'moissanite synthetic': 'moissanite',
  'mystic cz': 'cz',
};
const LOOSE_STONE_CATEGORIES = /^(diamonds?|precious gems|semi[\s-]?precious)$/i;

/**
 * "…Moissanite Synthetic Diamond 5.8 mm" → "…Moissanite 5.8 mm".
 * Accepts a string or an array of strings (metaKeywords is a list in some
 * databases); anything else is returned unchanged.
 */
export function stripDiamondWording(text) {
  if (Array.isArray(text)) {
    const cleaned = text.map((t) => stripDiamondWording(t)).filter((t) => t !== '');
    return [...new Set(cleaned)];
  }
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/\s*\bsynthetic\s+diamonds?\b/gi, '')
    .replace(/\bmoissanite\s+diamonds?\b/gi, 'Moissanite')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Pure planning step (no DB access) so it can be tested on exported data.
 * categories: [{_id, name}], subcategories: [{_id, name, category}],
 * products: [{_id, name, gemstoneName, productKind, category, subcategory, ...}]
 */
export function plan({ categories, subcategories, products }) {
  const catName = new Map(categories.map((c) => [String(c._id), c.name]));
  const subName = new Map(subcategories.map((s) => [String(s._id), s.name]));
  const moves = [];
  const kindFixes = [];
  const renames = [];
  const manualCheck = [];

  for (const p of products) {
    const cName = catName.get(String(p.category)) ?? '';
    const sName = subName.get(String(p.subcategory)) ?? '';
    if (cName === TARGET_CATEGORY) continue; // already migrated

    const kind = classifyAlternative(p.name, p.gemstoneName);

    if (!kind) {
      if (/(lab[-\s]?grown|created|synthetic)\s+diamond/i.test(`${p.name} ${p.gemstoneName ?? ''}`)) {
        manualCheck.push({ p, cName, reason: 'Lab-grown/created diamond — confirm it is a real diamond, not a simulant' });
      }
      continue;
    }

    if (LOOSE_STONE_CATEGORIES.test(cName.trim())) moves.push({ p, kind, from: `${cName} > ${sName || '—'}` });
    if (p.productKind === 'diamond') kindFixes.push({ p, from: cName });
    if (kind === 'moissanite') {
      const next = stripDiamondWording(p.name);
      if (next !== p.name) renames.push({ p, next });
    }
    if (kind === 'labCreated' && p.gemstoneName && !LAB_CREATED.test(p.gemstoneName)) {
      manualCheck.push({ p, cName, reason: `Gem name "${p.gemstoneName}" doesn't say synthetic/lab-created` });
    }
  }
  return { moves, kindFixes, renames, manualCheck };
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function main() {
  config({ path: '.env.local' });
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Aborting — refusing to run against no database.');
    process.exit(1);
  }
  const APPLY = process.argv.includes('--apply');
  console.log(APPLY ? '✍️  APPLY mode — changes WILL be written.\n' : '👀 Preview only (add --apply to write changes).\n');

  const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
  const Subcategory = mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }), 'subcategories');
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }), 'products');

  await mongoose.connect(MONGODB_URI);
  try {
    const categories = await Category.find({}, { name: 1, slug: 1, sortOrder: 1 }).lean();
    const subcategories = await Subcategory.find({}, { name: 1, category: 1, imageUrl: 1, imagePublicId: 1 }).lean();
    const products = await Product.find(
      {},
      { name: 1, gemstoneName: 1, productKind: 1, category: 1, subcategory: 1, metaTitle: 1, metaDescription: 1, metaKeywords: 1, categoryPath: 1 },
    ).lean();

    const { moves, kindFixes, renames, manualCheck } = plan({ categories, subcategories, products });

    // ── Report ──
    const byKind = {};
    for (const m of moves) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
    console.log(`Products to move into "${TARGET_CATEGORY}": ${moves.length}`);
    for (const [k, n] of Object.entries(byKind)) console.log(`   ${String(n).padStart(5)}  → ${SUBCATEGORIES[k].name}`);
    const fromCounts = {};
    for (const m of moves) fromCounts[m.from] = (fromCounts[m.from] ?? 0) + 1;
    console.log('   coming from:');
    for (const [f, n] of Object.entries(fromCounts).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${f}`);
    console.log(`\nproductKind "diamond" → "gemstone": ${kindFixes.length}`);
    for (const k of kindFixes.slice(0, 8)) console.log(`         ${k.p.name}  [${k.from}]`);
    console.log(`\nMoissanite names to correct: ${renames.length}`);
    for (const r of renames.slice(0, 5)) console.log(`         "${r.p.name}" → "${r.next}"`);
    console.log(`\nNeeds a manual check (not changed): ${manualCheck.length}`);
    for (const m of manualCheck) console.log(`         ${m.p.name}  [${m.cName}] — ${m.reason}`);

    if (!APPLY) {
      console.log('\nNothing was written. Re-run with --apply to make these changes.');
      return;
    }

    // ── 1. Category ──
    const diamonds = categories.filter((c) => /^diamonds?$/i.test(String(c.name).trim()));
    const sortOrder = (diamonds.length ? Math.min(...diamonds.map((d) => d.sortOrder ?? 0)) : 0) + 0.5;
    const cat = await Category.findOneAndUpdate(
      { name: TARGET_CATEGORY },
      {
        $setOnInsert: {
          name: TARGET_CATEGORY,
          slug: 'diamond-alternatives',
          description: 'Moissanite, cubic zirconia, simulated and lab-created stones — beautiful alternatives to natural diamonds and gemstones.',
          isActive: true,
          sortOrder,
          createdAt: new Date(),
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true },
    ).lean();

    // ── 2. Subcategories (reuse old subcategory images where available) ──
    const legacyImage = {};
    for (const s of subcategories) {
      const k = LEGACY_SUBCATEGORY_KIND[String(s.name ?? '').toLowerCase().trim()];
      if (k && s.imageUrl && !legacyImage[k]) legacyImage[k] = { imageUrl: s.imageUrl, imagePublicId: s.imagePublicId };
    }
    const subId = {};
    for (const [k, def] of Object.entries(SUBCATEGORIES)) {
      const sub = await Subcategory.findOneAndUpdate(
        { slug: def.slug, category: cat._id },
        {
          $setOnInsert: { name: def.name, slug: def.slug, category: cat._id, isActive: true, createdAt: new Date(), ...(legacyImage[k] ?? {}) },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, new: true },
      ).lean();
      subId[k] = sub._id;
    }

    // ── 3. Products ──
    const ops = [];
    const renameMap = new Map(renames.map((r) => [String(r.p._id), r]));
    const kindFixIds = new Set(kindFixes.map((k) => String(k.p._id)));
    const moveMap = new Map(moves.map((m) => [String(m.p._id), m]));
    const ids = new Set([...renameMap.keys(), ...kindFixIds, ...moveMap.keys()]);
    for (const id of ids) {
      const $set = {};
      const $unset = {};
      const m = moveMap.get(id);
      if (m) {
        $set.category = cat._id;
        $set.subcategory = subId[m.kind];
        $unset.subSubcategory = '';
        if (m.p.categoryPath) $set.categoryPath = `${TARGET_CATEGORY} > ${SUBCATEGORIES[m.kind].name}`;
      }
      if (kindFixIds.has(id)) $set.productKind = 'gemstone';
      const r = renameMap.get(id);
      if (r) {
        $set.name = r.next;
        for (const f of ['metaTitle', 'metaDescription', 'metaKeywords']) {
          if (r.p[f]) $set[f] = stripDiamondWording(r.p[f]);
        }
      }
      ops.push({ updateOne: { filter: { _id: new mongoose.Types.ObjectId(id) }, update: { $set, ...(Object.keys($unset).length && { $unset }) } } });
    }
    for (let i = 0; i < ops.length; i += 500) await Product.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    console.log(`\n✅ Updated ${ops.length} products.`);

    // ── 4. Hide emptied legacy subcategories ──
    for (const s of subcategories) {
      if (!LEGACY_SUBCATEGORY_KIND[String(s.name ?? '').toLowerCase().trim()]) continue;
      if (String(s.category) === String(cat._id)) continue;
      const left = await Product.countDocuments({ subcategory: s._id });
      if (left === 0) {
        await Subcategory.updateOne({ _id: s._id }, { $set: { isActive: false, updatedAt: new Date() } });
        console.log(`   Hid empty subcategory "${s.name}"`);
      } else {
        console.log(`   Kept subcategory "${s.name}" (${left} products still in it)`);
      }
    }
    console.log('\nDone. Clear any caches / redeploy so menus pick up the new category.');
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('❌', err);
    process.exit(1);
  });
}
