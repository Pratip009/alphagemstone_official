import mongoose, { Document, Schema } from 'mongoose';

// ─── Diamond / Gemstone enums (unchanged) ─────────────────────────────────────

export const SHAPES = [
  'round',
  'oval',
  'princess',
  'cushion',
  'emerald',
  'pear',
  'marquise',
  'radiant',
  'asscher',
  'heart',

  // Production data
  'trillion',
  'triangle',
  'baguette',
  'tapered-baguette',
  'bullet',
  'kite',
  'hexagon',
  'octagon',
  'shield',
  'rose-cut',
  'cabochon',

  'other',
] as const;

export const COLORS = [
  'D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
'VIOLET',
  'fancy-yellow',
  'fancy-light-yellow',
  'fancy-intense-yellow',
  'fancy-vivid-yellow',
'RASPBERRY RED',
  'fancy-pink',
  'fancy-purple-pink',

  'fancy-blue',
  'fancy-green',
  'fancy-red',
  'fancy-orange',
  'fancy-brown',
  'fancy-grey',
  'fancy-black',
  'fancy-white',

  'champagne',
  'cognac',

  'other',
] as const;

export const CLARITIES = [
  'FL',
  'IF',
  'VVS1',
  'VVS2',
  'VS1',
  'VS2',
  'SI1',
  'SI2',
  'SI3',
  'I1',
  'I2',
  'I3',

  'P1',
  'P2',
  'P3',

  'other',
] as const;

export const CERTIFICATIONS = [
  'GIA',
  'IGI',
  'HRD',
  'AGS',
  'EGL',

  'GCAL',
  'GSI',
  'NGTC',
  'SSEF',
  'GRS',
  'AGL',

  'none',
] as const;

// ─── Watch-specific enums ─────────────────────────────────────────────────────

export const WATCH_GENDERS = [
  'Men',
  'Women',
  'Unisex',
  'Boys',
  'Girls',
  'Kids',
] as const;

export const WATCH_BRANDS = [
  'Rolex', 'Omega', 'Cartier', 'Citizen', 'Seiko',
  'Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin',
  'A. Lange & Söhne', 'Jaeger-LeCoultre', 'IWC', 'Panerai',
  'Breitling', 'TAG Heuer', 'Richard Mille', 'Hublot',
  'Zenith', 'Blancpain', 'Breguet', 'Tudor',
  'Grand Seiko', 'Longines', 'Tissot', 'Hamilton',
  'Frederique Constant', 'Fossil', 'Casio', 'other','Rado',
'Bulova',
'Oris',
'Movado',
'Mido',
'Bell & Ross',
'Ulysse Nardin',
'Corum',
'Piaget',
'Chopard',
'Bulgari',
'Montblanc',
'Maurice Lacroix',
'Raymond Weil',
'Baume & Mercier',
'Nomos',
'Sinn',
'Christopher Ward',
'Victorinox',
'Invicta',
'Timex',
'Orient',
'Daniel Wellington',
'Michael Kors',
'Armani Exchange',
'Emporio Armani',
'Diesel',
'Guess',
'Nixon',
'Skagen',
'Calvin Klein',
'Pulsar',
'other',
] as const;

export const WATCH_MOVEMENTS = [
  'Automatic',
  'Quartz',
  'Mechanical',
  'Manual',
  'Solar',
  'Eco-Drive',
  'Kinetic',
] as const;

export const WATCH_STRAP_TYPES = [
  'Metal Bracelet',
  'Leather',
  'Rubber / Silicone',
  'Fabric',
  'NATO',
  'Canvas',
  'Ceramic',
  'Resin',
] as const;

export const WATCH_CASE_MATERIALS = [
  'Stainless Steel',
  'Gold',
  'Rose Gold',
  'White Gold',
  'Titanium',
  'Ceramic',
  'Carbon',
  'Bronze',
  'Platinum',
  'Two-tone',
] as const;

export const WATCH_DIAL_COLORS = [
  'Black',
  'White',
  'Blue',
  'Green',
  'Gold',
  'Silver',
  'Grey',
  'Brown',
  'Red',
  'Orange',
  'Pink',
  'Purple',
  'Champagne',
  'Mother of Pearl',
  'Skeleton',
  'Transparent',
  'other',
] as const;

export const WATCH_FEATURES = [
  'Chronograph',
  'Date Display',
  'Day-Date',
  'Moonphase',
  'GMT',
  'Power Reserve',
  'Water Resistant',
  'Diamond Studded',
  'Skeleton Dial',
  'Tourbillon',
  'Perpetual Calendar',
  'World Time',
  'Alarm',
] as const;

export const WATCH_STYLES = [
  'Luxury',
  'Casual',
  'Sport',
  'Dress',
  'Diver',
  'Pilot',
  'Field',
  'Racing',
] as const;
export const WATCH_CASE_SIZES = [
  'Extra Small',
  'Small',
  'Medium',
  'Large',
  'Extra Large',
] as const;

// ─── Product kind ──────────────────────────────────────────────────────────────
// Explicit, stored classification instead of inferring from which fields
// happen to be populated. Four real buckets exist in the actual catalog:
// diamonds, colored gemstones, watches, and stoneless jewelry/silver/vouchers.
export const PRODUCT_KINDS = ['diamond', 'gemstone', 'watch', 'jewelry'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type Shape        = (typeof SHAPES)[number];
export type Color        = (typeof COLORS)[number];
export type Clarity      = (typeof CLARITIES)[number];
export type Certification = (typeof CERTIFICATIONS)[number];

export type WatchGender       = (typeof WATCH_GENDERS)[number];
export type WatchBrand        = (typeof WATCH_BRANDS)[number];
export type WatchMovement     = (typeof WATCH_MOVEMENTS)[number];
export type WatchStrapType    = (typeof WATCH_STRAP_TYPES)[number];
export type WatchCaseMaterial = (typeof WATCH_CASE_MATERIALS)[number];
export type WatchDialColor    = (typeof WATCH_DIAL_COLORS)[number];
export type WatchFeature      = (typeof WATCH_FEATURES)[number];
export type WatchStyle        = (typeof WATCH_STYLES)[number];
export type WatchCaseSize     = (typeof WATCH_CASE_SIZES)[number];

// ─── IProduct interface ───────────────────────────────────────────────────────

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId;
  price: number;

  productKind?: ProductKind;

  // Diamond / gemstone fields
  shape?: Shape[];
  size?: number;
  color?: Color[];
  clarity?: Clarity[];
  certification?: Certification[];

  // Gemstone-specific — free text preserved verbatim. The legacy catalog's
  // color/clarity/grade vocabulary (e.g. "Raspberry Red", "Top Clean/Superior")
  // doesn't fit the diamond-grading enums above, so it's kept here rather
  // than lossily forced into them.
  gemstoneName?: string;
  shapeRaw?: string;
  colorRaw?: string;
  clarityRaw?: string;
  gradeRaw?: string;

  // Watch fields
  watchGender?:       WatchGender;
  watchBrand?:        WatchBrand;
  watchModel?:        string;
  watchMovement?:     WatchMovement;
  watchStrapType?:    WatchStrapType;
  watchCaseMaterial?: WatchCaseMaterial;
  watchDialColor?:    WatchDialColor;
  watchFeatures?:     WatchFeature[];
  watchStyle?:        WatchStyle;
  watchCaseSize?:     WatchCaseSize;

  // Everything else from the legacy catalog that doesn't map to a fixed
  // enum (cut style, luster, hardness, treatment, origin, metal, ring size,
  // carat/size ranges, approx weight, shipping weight, clarity description
  // text) — stored verbatim so no data is lost.
  legacyAttributes?: Record<string, string>;

  // Re-import idempotency — lets bulk upload upsert by original legacy ID
  // instead of creating duplicates on repeated runs.
  legacyProductId?: number;
  legacySku?: string;

  // SEO metadata carried over from the legacy catalog's per-product head
  // tags (products_head_title_tag / _desc_tag / _keywords_tag). Populated
  // on the vast majority of legacy rows, so worth first-class fields
  // rather than burying them in legacyAttributes.
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];

  images: string[];
  stock: number;
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: 'Subcategory',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },

    productKind: {
      type: String,
      enum: { values: PRODUCT_KINDS, message: 'Invalid product kind: {VALUE}' },
    },

    // ── Diamond / gemstone fields (all optional at schema level) ────────────
    shape: {
      type: [String],
      enum: { values: SHAPES, message: 'Invalid shape: {VALUE}' },
      default: undefined,
    },
    size: {
      type: Number,
      min: [0.01, 'Size must be at least 0.01 carat'],
    },
    color: {
      type: [String],
      enum: { values: COLORS, message: 'Invalid color: {VALUE}' },
      default: undefined,
    },
    clarity: {
      type: [String],
      enum: { values: CLARITIES, message: 'Invalid clarity: {VALUE}' },
      default: undefined,
    },
    certification: {
      type: [String],
      enum: { values: CERTIFICATIONS, message: 'Invalid certification: {VALUE}' },
      default: [],
    },

    gemstoneName: { type: String, trim: true, maxlength: 100 },
    shapeRaw:     { type: String, trim: true, maxlength: 100 },
    colorRaw:     { type: String, trim: true, maxlength: 100 },
    clarityRaw:   { type: String, trim: true, maxlength: 100 },
    gradeRaw:     { type: String, trim: true, maxlength: 100 },

    // ── Watch fields ────────────────────────────────────────────────────────
    watchGender: {
      type: String,
      enum: { values: WATCH_GENDERS, message: 'Invalid gender: {VALUE}' },
    },
    watchBrand: {
      type: String,
      enum: { values: WATCH_BRANDS, message: 'Invalid brand: {VALUE}' },
    },
    watchModel: { type: String, trim: true, maxlength: 100 },
    watchMovement: {
      type: String,
      enum: { values: WATCH_MOVEMENTS, message: 'Invalid movement: {VALUE}' },
    },
    watchStrapType: {
      type: String,
      enum: { values: WATCH_STRAP_TYPES, message: 'Invalid strap type: {VALUE}' },
    },
    watchCaseMaterial: {
      type: String,
      enum: { values: WATCH_CASE_MATERIALS, message: 'Invalid case material: {VALUE}' },
    },
    watchDialColor: {
      type: String,
      enum: { values: WATCH_DIAL_COLORS, message: 'Invalid dial color: {VALUE}' },
    },
    watchFeatures: {
      type: [String],
      enum: { values: WATCH_FEATURES, message: 'Invalid feature: {VALUE}' },
      default: [],
    },
    watchStyle: {
      type: String,
      enum: { values: WATCH_STYLES, message: 'Invalid style: {VALUE}' },
    },
    watchCaseSize: {
      type: String,
      enum: { values: WATCH_CASE_SIZES, message: 'Invalid case size: {VALUE}' },
    },

    legacyAttributes: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    legacyProductId: {
      type: Number,
      index: true,
      sparse: true,
      unique: true,
    },
    legacySku: { type: String, trim: true, maxlength: 100 },

    // ── SEO fields ──────────────────────────────────────────────────────────
    metaTitle: { type: String, trim: true, maxlength: 200 },
    metaDescription: { type: String, trim: true, maxlength: 500 },
    metaKeywords: {
      type: [String],
      default: undefined,
    },

    // ── Common fields ───────────────────────────────────────────────────────
    images: {
      type: [String],
      default: [],
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Diamond indexes
ProductSchema.index({ shape: 1 });
ProductSchema.index({ color: 1 });
ProductSchema.index({ clarity: 1 });
ProductSchema.index({ size: 1 });

// Watch indexes
ProductSchema.index({ watchGender: 1 });
ProductSchema.index({ watchBrand: 1 });
ProductSchema.index({ watchMovement: 1 });
ProductSchema.index({ watchStrapType: 1 });
ProductSchema.index({ watchCaseMaterial: 1 });
ProductSchema.index({ watchDialColor: 1 });
ProductSchema.index({ watchFeatures: 1 });
ProductSchema.index({ watchStyle: 1 });
ProductSchema.index({ watchCaseSize: 1 });

// Gemstone / kind indexes
ProductSchema.index({ productKind: 1 });
ProductSchema.index({ gemstoneName: 1 });

// Common indexes
ProductSchema.index({ price: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ category: 1, subcategory: 1 });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ shape: 1, size: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

const Product = (() => {
  if (mongoose.models && mongoose.models.Product) {
    return mongoose.models.Product as mongoose.Model<IProduct>;
  }
  return mongoose.model<IProduct>('Product', ProductSchema);
})();

export default Product;