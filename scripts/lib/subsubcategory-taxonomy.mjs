/**
 * Shared taxonomy definition + keyword-matching logic for the
 * SubSubcategory ("type") seeding scripts. Pulled out into its own module
 * so it can be unit-tested / validated against real product data without
 * needing a live MongoDB connection.
 */

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Taxonomy definition, transcribed from semisubcategories.txt ─────────────
// `match` is an array of keyword groups; a product matches a child if ANY
// group matches, and a group matches if ALL its keywords are found
// (case-insensitive, word-boundary + plural-tolerant) somewhere across
// name/shapeRaw/cutType/treatment/gemstoneName/colorRaw/description.
//
// ORDERING MATTERS: children are matched top-to-bottom and (once committed)
// each product is claimed by at most one type per subcategory. Put more
// specific matchers (e.g. a named gemstone, "solitaire", "stud") ABOVE any
// broader/generic catch-all sibling (e.g. bare "earring", "bead necklace")
// in the same subcategory — otherwise the broad one runs first and silently
// steals everything the specific one should have gotten, leaving it at 0.
// This bit two sections during development (Silver Jewelry, Bead
// Necklaces) — see git history / conversation for the concrete numbers.
const SHAPE_CHILDREN = (suffix) => [
  { name: `Calibrated ${suffix}`,   match: [['calibrated']] },
  { name: `Oval ${suffix}`,         match: [['oval']] },
  { name: `Trillion ${suffix}`,     match: [['trillion']] },
  { name: `Cushion ${suffix}`,      match: [['cushion']] },
  { name: `Pear ${suffix}`,         match: [['pear']] },
  { name: `Round ${suffix}`,        match: [['round']] },
  { name: `Emerald Cut ${suffix}`,  match: [['emerald', 'cut'], ['emerald-cut']] },
  { name: `Marquise ${suffix}`,     match: [['marquise']] },
  { name: `Heart Shape ${suffix}`,  match: [['heart']] },
];

const CUT_CHILDREN = (suffix) => [
  { name: `Faceted ${suffix}`,  match: [['faceted']] },
  { name: `Cabochon ${suffix}`, match: [['cabochon']] },
];

// Used to disambiguate "gemstone-named silver jewelry" from plain/diamond
// silver jewelry where two children would otherwise share a bare keyword
// like "earring" with no way to tell them apart.
export const GEMSTONE_WORDS = [
  'ruby', 'sapphire', 'emerald', 'tanzanite', 'amethyst', 'citrine', 'garnet',
  'iolite', 'onyx', 'peridot', 'quartz', 'topaz', 'tourmaline', 'chrome diopside',
  'opal', 'aquamarine', 'turquoise', 'moonstone', 'rhodolite', 'chalcedony',
  'tiger eye', 'kunzite', 'carnelian', 'agate', 'fluorite', 'lapis',
];

export const TAXONOMY = [
  // ── Precious Gems ──────────────────────────────────────────────────────
  { subcategory: 'Tanzanite', children: SHAPE_CHILDREN('Tanzanite') },
  { subcategory: 'Emerald',   children: CUT_CHILDREN('Emeralds') },
  { subcategory: 'Ruby',      children: CUT_CHILDREN('Ruby') },
  {
    subcategory: 'Sapphire',
    children: [
      { name: 'Blue Sapphire',       match: [['blue']] },
      { name: 'Pink Sapphire',       match: [['pink']] },
      { name: 'Orange Sapphire',     match: [['orange']] },
      { name: 'Yellow Sapphire',     match: [['yellow']] },
      { name: 'White Sapphire',      match: [['white']] },
      { name: 'Green Sapphire',      match: [['green']] },
      { name: 'Multicolor Sapphire', match: [['multicolor'], ['multi-color'], ['multi', 'color'], ['parti']] },
    ],
  },

  // ── Semi Precious ──────────────────────────────────────────────────────
  { subcategory: 'Amethyst',        children: CUT_CHILDREN('Amethyst') },
  { subcategory: 'Chrome Diopside', children: CUT_CHILDREN('Chrome Diopside') },
  { subcategory: 'Citrine',         children: CUT_CHILDREN('Citrine') },
  { subcategory: 'Garnet',          children: CUT_CHILDREN('Garnet') },
  { subcategory: 'Iolite',          children: CUT_CHILDREN('Iolite') },
  { subcategory: 'Onyx',            children: CUT_CHILDREN('Onyx') },
  { subcategory: 'Peridot',         children: CUT_CHILDREN('Peridot') },
  {
    subcategory: 'Quartz',
    children: [
      { name: 'Canary Green Gold Quartz', match: [['canary', 'green', 'gold']] },
      { name: 'Cinnamon Citrine Quartz',  match: [['cinnamon', 'citrine']] },
      // Real product/gemstoneName data just says "Crystal" — the word
      // "quartz" never actually appears alongside it, so requiring both
      // words matched nothing. Single keyword is correct (scoped to the
      // Quartz subcategory already, so no risk of over-matching).
      { name: 'Crystal Quartz',           match: [['crystal']] },
      // DB data has this misspelled as "Madira" (no middle "e") — matched
      // on the real spelling, with the correct spelling kept as a fallback
      // in case it gets fixed later.
      { name: 'Madeira Citrine',          match: [['madira'], ['madeira']] },
      { name: 'Olive Quartz',             match: [['olive']] },
      { name: 'Green Golden Quartz',      match: [['green', 'gold']] },
      { name: 'Rose Quartz',              match: [['rose']] },
      { name: 'Rutilated Quartz',         match: [['rutilated'], ['rutile']] },
      { name: 'Smoky Quartz',             match: [['smoky'], ['smokey']] },
      { name: 'White Quartz',             match: [['white']] },
    ],
  },
  { subcategory: 'Rhodolite Garnet', children: CUT_CHILDREN('Rhodolite Garnet') },
  { subcategory: 'Sky Blue Topaz',   children: CUT_CHILDREN('Sky Blue Topaz') },
  { subcategory: 'Swiss Blue Topaz', children: CUT_CHILDREN('Swiss Blue Topaz') },
  { subcategory: 'Tourmaline',       children: CUT_CHILDREN('Tourmaline') },

  // ── Jewelry ───────────────────────────────────────────────────────────
  // Jewelry "types" have no shapeRaw/cutType-equivalent attribute to match
  // on — the signal is keywords in the product NAME and DESCRIPTION, so
  // --link-products coverage here is rougher than for gemstones. Spot-check
  // after running.
  //
  // A few subcategory names below were adjusted to match what's actually in
  // the DB (real name used; requested name noted in a comment):
  //   - "Diamond Semi Mounts"      -> "Gold Diamond Semi-mountings"
  //   - "Diamond Fashion Pendants" -> "Diamond Pendants"
  //   - "Beaded Necklaces"         -> "Bead Necklaces" (actual DB name)
  {
    subcategory: 'Gold Diamond Semi-mountings', // requested as "Diamond Semi Mounts"
    children: [
      { name: 'Engagement Rings',              match: [['engagement']] },
      { name: 'Bridal Rings',                  match: [['bridal']] },
      { name: 'Past, Present & Future Rings',  match: [['past', 'present', 'future']] },
      { name: 'Right Hand Rings',              match: [['right', 'hand']] },
    ],
  },
  {
    subcategory: 'Tanzanite Jewelry',
    children: [
      { name: 'Tanzanite Earrings',       match: [['earring']] },
      { name: 'Tanzanite Pendants',       match: [['pendant']] },
      { name: 'Tanzanite Diamond Rings',  match: [['ring']] },
    ],
  },
  {
    subcategory: 'Diamond Rings',
    children: [
      { name: 'Engagement Solitaire Rings', match: [['engagement', 'solitaire']] },
      { name: 'Three Stone Diamond Rings',  match: [['three', 'stone'], ['3', 'stone']] },
      { name: 'Color Diamond Rings',        match: [['color', 'diamond'], ['fancy', 'color']] },
      { name: 'Bridal Diamond Rings',       match: [['bridal']] },
      { name: 'Wedding Diamond Bands',      match: [['wedding', 'band']] },
    ],
  },
  {
    subcategory: 'Diamond Earrings',
    children: [
      // "Diamond Earrings" itself (the parent subcategory name repeated in
      // the requested list) is skipped here — a type can't be its own parent.
      { name: 'Diamond Stud Earrings',   match: [['stud']] },
      { name: 'Diamond Earring Bargains', match: [['bargain'], ['clearance']] },
    ],
  },
  {
    subcategory: 'Diamond Pendants', // requested as "Diamond Fashion Pendants"
    children: [
      { name: 'Diamond Solitaire Pendants',  match: [['solitaire']] },
      { name: '3 Stone Diamond Pendants',    match: [['3', 'stone'], ['three', 'stone']] },
      { name: 'Diamond Fashion Pendants',    match: [['fashion']] },
    ],
  },
  {
    subcategory: 'Gemstone Rings',
    children: [
      { name: 'Ruby Diamond Rings',             match: [['ruby']] },
      { name: 'Sapphire Diamond Rings',         match: [['sapphire']] },
      { name: 'Solitaire Rings With Gemstones', match: [['solitaire']] },
      { name: 'Cocktail Rings',                 match: [['cocktail']] },
      // Catch-all bucket for anything left over — intentionally not
      // auto-matched (empty match list) so it doesn't scoop up every
      // product in the subcategory. Assign manually in the admin UI.
      { name: 'More Gemstone Rings', match: [] },
    ],
  },
  {
    subcategory: 'Bargains',
    children: [
      { name: 'Diamond Loupe',       match: [['loupe']] },
      { name: 'Wish Pearl Necklace', match: [['wish', 'pearl']] },
      { name: 'Silk Cord Necklace',  match: [['silk', 'cord', 'necklace']] },
      { name: 'Silk Cords',          match: [['silk', 'cord']] },
      { name: 'Diamond Earrings',    match: [['earring']] },
    ],
  },
  {
    // Named gemstones BEFORE the broad "Gemstone Bead Necklace" catch-all —
    // otherwise the broad one (matches any "bead" + "necklace") claims
    // sapphire/ruby ones too since it runs first. See ordering note above.
    subcategory: 'Bead Necklaces',
    children: [
      { name: 'Sapphire Bead Necklaces', match: [['sapphire', 'bead']] },
      { name: 'Ruby Bead Necklaces',     match: [['ruby', 'bead']] },
      { name: 'Gemstone Bead Necklace',  match: [['gemstone', 'bead'], ['bead', 'necklace']] },
    ],
  },
  {
    // NOTE ON ORDER: children are matched in the order listed, and once a
    // product is committed to one it's excluded from all later ones in
    // this run. "Gemstone Silver Earrings" and "Silver Earrings" both used
    // to match on the bare word "earring" with no way to tell them apart —
    // whichever ran first (Gemstone) silently claimed every earring in the
    // subcategory, permanently starving the other and "Diamond Stud
    // Earrings in Silver" too. Fix: most-specific matchers first, and
    // "Gemstone Silver Earrings" now requires an actual gemstone name
    // alongside "earring" so the plain/diamond ones fall through to
    // "Silver Earrings" instead of being swallowed upstream.
    subcategory: 'Silver Jewelry',
    children: [
      { name: 'Diamond Stud Earrings in Silver', match: [['stud']] },
      { name: 'Silver Solitaire Pendants',       match: [['solitaire', 'pendant']] },
      { name: 'Silver Solitaire Rings',          match: [['solitaire', 'ring']] },
      { name: 'Silver Brooch',                   match: [['brooch']] },
      { name: 'Silver Bracelet',                 match: [['bracelet']] },
      { name: 'Gemstone Silver Necklaces',       match: [['necklace']] },
      {
        name: 'Gemstone Silver Earrings',
        match: GEMSTONE_WORDS.map((g) => ['earring', g]),
      },
      { name: 'Gemstone Silver Pendants',        match: [['pendant']] },
      { name: 'Silver Rings',                    match: [['ring']] },
      // Catch-all for earrings left over once the gemstone-named and stud
      // ones above have already been claimed (plain/diamond silver
      // earrings with no gemstone word in them).
      { name: 'Silver Earrings',                 match: [['earring']] },
    ],
  },
];

export function haystack(product) {
  return [
    product.name, product.shapeRaw, product.cutType,
    product.treatment, product.gemstoneName, product.colorRaw,
    // Description carries most of the descriptive/style language for
    // jewelry (e.g. "engagement", "past-present-future", "wedding ...
    // band") that never shows up in name/shapeRaw/cutType. Without it,
    // every jewelry "style" type matched close to nothing.
    product.description,
  ].filter(Boolean).join(' ').toLowerCase();
}

// Word-boundary match, not plain substring — otherwise short keywords like
// "ring" match inside unrelated words like "earRING", "gold" inside
// "marigold", etc. Trailing (e)?s? tolerates plain plurals ("Earrings",
// "Pendants", "Brooches", "Sapphires") without reopening that same hole.
export function wordMatch(hay, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}e?s?\\b`, 'i').test(hay);
}

export function matches(product, matchGroups) {
  const hay = haystack(product);
  return matchGroups.some((group) => group.every((kw) => wordMatch(hay, kw)));
}
