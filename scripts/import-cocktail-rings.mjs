/**
 * Import the 5 Cocktail Rings products into the live catalog.
 *
 * Run with:   node scripts/import-cocktail-rings.mjs
 * Requires:   MONGODB_URI in your environment or a .env / .env.local file
 *             (same variable src/lib/db.ts reads).
 *
 * What it does
 * ------------
 * 1. Finds (or creates) the "Jewelry" Category and "Cocktail Rings"
 *    Subcategory (nested under Jewelry).
 * 2. Upserts the 5 products below with `product.subcategory` set to that
 *    Cocktail Rings ObjectId. This — NOT `subcategory2Raw` — is what the
 *    storefront actually filters on: /products?category=jewelry&subcategory=
 *    cocktail-rings resolves the slug to a Subcategory _id in
 *    resolveSlugFilters() (productFilter.service.ts) and then does a plain
 *    `filter.subcategory = <that id>` match in buildProductFilterQuery().
 *    subcategory2Raw is still set for record-keeping (it mirrors the CSV's
 *    subcategory_2 column) but no query anywhere in the app reads it, so
 *    setting only that field — which the first version of this script did,
 *    pointing product.subcategory at "Gemstone Rings" instead — left the
 *    real Cocktail Rings listing empty.
 * 3. Upsert key is `legacySku` (the product model/SKU, e.g. NGR012109220)
 *    so re-running this script is safe and just updates the same 5 docs
 *    instead of duplicating them.
 *
 * Source data below was pulled directly from src/lib/products.csv (rows
 * for models NGR012109220, CKR120414001-004), which already carries
 * category_path = "Jewelry > Gemstone Rings > Cocktail Rings" for all five.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
config();
config({ path: '.env.local' }); // Next.js convention — load this too if present

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Set it in your environment, .env, or .env.local file.');
  process.exit(1);
}

// ── Minimal inline schemas — field names/behavior mirror the real models
//    (src/models/Category.ts, Subcategory.ts, Product.ts) closely enough
//    for this import; we reuse the models if this script is ever imported
//    from within the Next.js app instead of run standalone.
const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const SubcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
    price: { type: Number, required: true, min: 0 },
    productKind: { type: String },

    gemstoneName: String,
    shapeRaw: String,
    colorRaw: String,
    clarityRaw: String,
    caratWeight: Number,

    images: { type: [String], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    description: String,

    weight: Number,
    msrp: Number,
    manufacturerId: String,
    minOrder: Number,
    maxOrder: Number,
    qtyBlocks: Number,
    makeAnOffer: { type: Boolean, default: false },
    parentProductId: Number,
    subcategory2Raw: String,
    categoryPath: String,

    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],

    legacyProductId: { type: Number, index: true, sparse: true, unique: true },
    legacySku: { type: String, trim: true },
    legacyCategoryId: [Number],
  },
  { timestamps: true }
);

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

function deriveSlug(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── The 5 products, straight from src/lib/products.csv ─────────────────────
const PRODUCTS = [
  {
    legacyProductId: 36582,
    legacySku: 'CKR120414001',
    name: "Calvin Klein Jewelry Continuity Women's Ring",
    price: 52.0,
    msrp: 110.0,
    stock: 1,
    weight: 0.01,
    isActive: true,
    manufacturerId: '0',
    minOrder: 1,
    maxOrder: 0,
    qtyBlocks: 1,
    makeAnOffer: false,
    parentProductId: undefined,
    images: ['/product-images-migration/jewelry/ringswithgemstones/100/CK-KJ10BR010207.gif'],
    description: "Great deal on Calvin Klein Jewelry Continuity Women's Ring.",
    metaTitle: "Calvin Klein Jewelry Continuity Women's Ring KJ10BR010207",
    metaDescription: "Best price Calvin Klein Jewelry Continuity Women's Ring Only KJ10BR010207 from Alpha Imports",
    metaKeywords: ["Calvin Klein", "Jewelry", "Continuity", "Women's", "Ring", "KJ10BR010207"],
    legacyCategoryId: [277],
    categoryPath: 'Jewelry > Gemstone Rings > Cocktail Rings',
  },
  {
    legacyProductId: 36583,
    legacySku: 'CKR120414002',
    name: "Calvin Klein Jewelry Continuity Women's Ring",
    price: 52.0,
    msrp: 110.0,
    stock: 1,
    weight: 0.01,
    isActive: true,
    manufacturerId: '0',
    minOrder: 1,
    maxOrder: 0,
    qtyBlocks: 1,
    makeAnOffer: false,
    images: ['/product-images-migration/jewelry/ringswithgemstones/100/CK-KJ10BR011208.gif'],
    description: "Great deal on Calvin Klein Jewelry Continuity Women's Ring.",
    metaTitle: "Calvin Klein Jewelry Continuity Women's Ring KJ10BR011208",
    metaDescription: "Best price Calvin Klein Jewelry Continuity Women's Ring Only KJ10BR011208 from Alpha Imports",
    metaKeywords: ["Calvin Klein", "Jewelry", "Continuity", "Women's", "Ring", "KJ10BR011208"],
    legacyCategoryId: [277],
    categoryPath: 'Jewelry > Gemstone Rings > Cocktail Rings',
  },
  {
    legacyProductId: 36584,
    legacySku: 'CKR120414003',
    name: "Calvin Klein Jewelry Continuity Women's Ring",
    price: 52.0,
    msrp: 110.0,
    stock: 1,
    weight: 0.01,
    isActive: true,
    manufacturerId: '0',
    minOrder: 1,
    maxOrder: 0,
    qtyBlocks: 1,
    makeAnOffer: false,
    images: ['/product-images-migration/jewelry/ringswithgemstones/100/CK-KJ10BR011806.gif'],
    description: "Great deal on Calvin Klein Jewelry Continuity Women's Ring.",
    metaTitle: "Calvin Klein Jewelry Continuity Women's Ring KJ10BR011806",
    metaDescription: "Best price Calvin Klein Jewelry Continuity Women's Ring Only KJ10BR011806 from Alpha Imports",
    metaKeywords: ["Calvin Klein", "Jewelry", "Continuity", "Women's", "Ring", "KJ10BR011806"],
    legacyCategoryId: [277],
    categoryPath: 'Jewelry > Gemstone Rings > Cocktail Rings',
  },
  {
    legacyProductId: 36585,
    legacySku: 'CKR120414004',
    name: "Calvin Klein Jewelry Ellipse Women's Ring",
    price: 52.0,
    msrp: 110.0,
    stock: 3,
    weight: 0.01,
    isActive: true,
    manufacturerId: '0',
    minOrder: 1,
    maxOrder: 0,
    qtyBlocks: 1,
    makeAnOffer: false,
    images: ['/product-images-migration/jewelry/ringswithgemstones/100/CK-KJ03ER010108.gif'],
    description: "Great deal on Calvin Klein Jewelry Ellipse Women's Ring.",
    metaTitle: "Calvin Klein Jewelry Ellipse Women's Ring KJ03ER010108",
    metaDescription: "Best price Calvin Klein Jewelry Ellipse Women's Ring KJ03ER010108 from Alpha Imports",
    metaKeywords: ["Calvin Klein", "Jewelry", "Ellipse", "Women's", "Ring", "KJ03ER010108"],
    legacyCategoryId: [277],
    categoryPath: 'Jewelry > Gemstone Rings > Cocktail Rings',
  },
  {
    legacyProductId: 36587,
    legacySku: 'NGR012109220',
    name: '1.50 ct. Diamond Sapphire Ring in 14k Yellow Gold',
    price: 198.0,
    msrp: 396.0,
    stock: 0,
    weight: 0.01,
    isActive: true,
    manufacturerId: '0',
    minOrder: 1,
    maxOrder: 0,
    qtyBlocks: 1,
    makeAnOffer: true,
    images: ['/product-images-migration/jewelry/Diamondrings/100/NGR012109220.gif'],
    description: 'Great Blue Sapphire Diamond Ring in 14k Yellow Gold. Please check below for more details.',
    metaTitle: '1.50 ct. Diamond sapphire Ring in 14k Yellow Gold',
    metaDescription: 'Best price 1.50 ct. Diamond sapphire Ring in 14k Yellow Gold Only from Alpha Imports',
    metaKeywords: ['14k Gold gemstone ring', 'gemstone diamond ring', 'Sapphire diamond ring', 'Oval Sapphire ring'],
    gemstoneName: 'Sapphire',
    colorRaw: 'Blue/White',
    shapeRaw: 'Oval/Round',
    caratWeight: 1.25,
    productKind: 'gemstone',
    legacyCategoryId: [277],
    categoryPath: 'Jewelry > Gemstone Rings > Cocktail Rings',
  },
];

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected');

  // ── 1. Resolve/create Category: Jewelry ──────────────────────────────────
  const categoryName = 'Jewelry';
  const categorySlug = deriveSlug(categoryName);
  let category = await Category.findOne({
    $or: [{ name: new RegExp(`^${categoryName}$`, 'i') }, { slug: categorySlug }],
  });
  if (!category) {
    category = await Category.create({ name: categoryName, slug: categorySlug, isActive: true });
    console.log(`  Created Category "${categoryName}"`);
  } else {
    console.log(`  Found Category "${category.name}" (${category._id})`);
  }

  // ── 2. Resolve/create Subcategory: Cocktail Rings (under Jewelry) ───────
  //    This is the ObjectId the storefront's /products?subcategory=... query
  //    actually matches against — see comment at top of file.
  const subcategoryName = 'Cocktail Rings';
  const subcategorySlug = deriveSlug(subcategoryName); // "cocktail-rings"
  let subcategory = await Subcategory.findOne({
    category: category._id,
    $or: [{ name: new RegExp(`^${subcategoryName}$`, 'i') }, { slug: subcategorySlug }],
  });
  if (!subcategory) {
    subcategory = await Subcategory.create({
      name: subcategoryName,
      slug: subcategorySlug,
      category: category._id,
      isActive: true,
    });
    console.log(`  Created Subcategory "${subcategoryName}" (slug: ${subcategorySlug})`);
  } else {
    console.log(`  Found Subcategory "${subcategory.name}" (${subcategory._id}, slug: ${subcategory.slug})`);
  }

  // ── 3. Upsert each product, tagged into Cocktail Rings ───────────────────
  console.log('\nUpserting products…');
  let created = 0;
  let updated = 0;

  for (const p of PRODUCTS) {
    const doc = {
      ...p,
      category: category._id,
      subcategory: subcategory._id,
      subcategory2Raw: 'Cocktail Rings', // ← this is the field the Cocktail
                                          //    Rings listing filters on
      productKind: p.productKind || 'jewelry',
    };

    const result = await Product.findOneAndUpdate(
      { legacySku: p.legacySku },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    );

    if (result.lastErrorObject?.updatedExisting) {
      updated++;
      console.log(`  ↻ Updated  ${p.legacySku} — ${p.name}`);
    } else {
      created++;
      console.log(`  + Created  ${p.legacySku} — ${p.name}`);
    }
  }

  console.log(`\n✅ Done. ${created} created, ${updated} updated, ${PRODUCTS.length} total.`);
  console.log(`   All 5 now have subcategory = Cocktail Rings (${subcategory._id}).`);
  console.log('   Check: /products?category=jewelry&subcategory=cocktail-rings');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('❌ Import failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
