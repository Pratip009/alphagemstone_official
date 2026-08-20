import mongoose, { Document, Schema } from 'mongoose';
import {
  SHAPES, COLORS, CLARITIES, CERTIFICATIONS,
  WATCH_GENDERS, WATCH_BRANDS, WATCH_MOVEMENTS, WATCH_STRAP_TYPES,
  WATCH_CASE_MATERIALS, WATCH_DIAL_COLORS, WATCH_FEATURES, WATCH_STYLES,
  WATCH_CASE_SIZES, PRODUCT_KINDS,
  type ProductKind, type Shape, type Color, type Clarity, type Certification,
  type WatchGender, type WatchBrand, type WatchMovement, type WatchStrapType,
  type WatchCaseMaterial, type WatchDialColor, type WatchFeature,
  type WatchStyle, type WatchCaseSize,
} from '@/lib/productAttributes';

// Diamond/gemstone/watch attribute vocab (SHAPES, COLORS, CLARITIES, WATCH_*,
// PRODUCT_KINDS, etc.) now lives in a single place — src/lib/productAttributes.ts
// — instead of being duplicated here. That file is also the canonical source
// for the filter UI (FilterSidebar, FilterBar, SearchBar), so a value can
// never drift between what's filterable and what's actually on a product.
// The option lists themselves were rebuilt from the real
// products_with_matched_categories.csv export: SHAPES/COLORS/CLARITIES now
// reflect the gemstone-trade language actually used in attributes.shape/
// color/clarity (not a diamond GIA grading scale that never matched this
// catalog), and WATCH_BRANDS was trimmed from ~60 luxury brands down to the
// 6 that actually appear on this store's watch SKUs.
export {
  SHAPES, COLORS, CLARITIES, CERTIFICATIONS,
  WATCH_GENDERS, WATCH_BRANDS, WATCH_MOVEMENTS, WATCH_STRAP_TYPES,
  WATCH_CASE_MATERIALS, WATCH_DIAL_COLORS, WATCH_FEATURES, WATCH_STYLES,
  WATCH_CASE_SIZES, PRODUCT_KINDS,
};
export type {
  ProductKind, Shape, Color, Clarity, Certification,
  WatchGender, WatchBrand, WatchMovement, WatchStrapType,
  WatchCaseMaterial, WatchDialColor, WatchFeature, WatchStyle, WatchCaseSize,
};


// ─── Memo status (per-item) ────────────────────────────────────────────────────
// Mirrors the status enum on the Memo model itself (src/models/Memo.ts).
// Kept here too so Product never has to import Memo just for this union.
export const MEMO_ITEM_STATUSES = [
  'pending',
  'rejected',
  'approved',
  'shipped',
  'with_customer',
  'return_requested',
  'return_in_transit',
  'returned',
  'overdue',
  'recalled',
  'force_converted',
  'lost',
  'damaged',
  'cancelled',
] as const;
export type MemoItemStatus = (typeof MEMO_ITEM_STATUSES)[number];

// Hard business ceiling — no product may offer a memo window longer than
// this, and no in-flight memo (including after an approved extension) may
// run longer than this from approval. Enforced again in memo.service.ts;
// duplicated here as a schema-level backstop so a bad value can never even
// be saved on a product.
export const MEMO_MAX_DAYS_CEILING = 14;

// ─── TypeScript types ─────────────────────────────────────────────────────────
// Shape/Color/Clarity/Certification/Watch* types are already imported (as
// types) and re-exported above, alongside the value exports — no need to
// re-import/re-export them a second time here.

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

  gemstoneName?: string;
  shapeRaw?: string;
  colorRaw?: string;
  clarityRaw?: string;
  gradeRaw?: string;
  cutType?: string;
  luster?: string;
  hardness?: string;
  treatment?: string;
  origin?: string;
  caratWeight?: number;
  dimensions?: string;

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

  legacyAttributes?: Record<string, string>;
  legacyProductId?: number;
  legacySku?: string;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];

  images: string[];
  stock: number;
  isActive: boolean;
  description?: string;

  // ── Fields from the "matched categories" legacy export ──────────────────
  weight?: number;
  msrp?: number;
  manufacturerId?: string;
  minOrder?: number;
  maxOrder?: number;
  qtyBlocks?: number;
  makeAnOffer?: boolean;
  parentProductId?: number;
  subcategory2Raw?: string;
  categoryPath?: string;

  // ── Memo fields ──────────────────────────────────────────────────────────
  // Most SKUs should never be memo-eligible — memo only makes sense for
  // unique, high-value, one-of-a-kind pieces. An admin opts a product in
  // explicitly via `memoEligible`.
  memoEligible: boolean;
  // Units currently out on an active memo. NEVER read `stock` directly to
  // decide purchasability anywhere in the storefront/cart/order code —
  // always read the `availableStock` virtual below instead.
  reservedForMemo: number;
  memoMinDays?: number;
  memoMaxDays?: number;

  // Virtual, not persisted: stock - reservedForMemo, floored at 0.
  readonly availableStock: number;

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

    shape: {
      type: [String],
      enum: { values: SHAPES, message: 'Invalid shape: {VALUE}' },
      default: undefined,
    },
    size: {
      type: Number,
      // Legacy melee-diamond SKUs go down to ~0.002ct — the floor only
      // guards against 0/negative, not against genuinely tiny stones.
      min: [0.001, 'Size must be at least 0.001 carat'],
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
    cutType:      { type: String, trim: true, maxlength: 100 },
    luster:       { type: String, trim: true, maxlength: 100 },
    hardness:     { type: String, trim: true, maxlength: 100 },
    treatment:    { type: String, trim: true, maxlength: 100 },
    origin:       { type: String, trim: true, maxlength: 100 },
    caratWeight:  { type: Number, min: [0, 'caratWeight cannot be negative'] },
    dimensions:   { type: String, trim: true, maxlength: 100 },

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

    metaTitle: { type: String, trim: true, maxlength: 200 },
    metaDescription: { type: String, trim: true, maxlength: 500 },
    metaKeywords: {
      type: [String],
      default: undefined,
    },

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

    // ── Fields from the "matched categories" legacy export ────────────────────
    weight: { type: Number, min: [0, 'weight cannot be negative'] },
    msrp: { type: Number, min: [0, 'msrp cannot be negative'] },
    manufacturerId: { type: String, trim: true, maxlength: 50 },
    minOrder: { type: Number, min: [0, 'minOrder cannot be negative'] },
    maxOrder: { type: Number, min: [0, 'maxOrder cannot be negative'] },
    qtyBlocks: { type: Number, min: [0, 'qtyBlocks cannot be negative'] },
    makeAnOffer: { type: Boolean, default: false },
    // 0 in the source export means "no parent" — the app only ever sets/reads
    // this when > 0 (see fileParser.service.ts), so it's sparse rather than
    // defaulted to 0 for every simple product.
    parentProductId: { type: Number, index: true, sparse: true },
    subcategory2Raw: { type: String, trim: true, maxlength: 150 },
    categoryPath: { type: String, trim: true, maxlength: 300 },

    // ── Memo fields ─────────────────────────────────────────────────────────
    memoEligible: {
      type: Boolean,
      default: false,
    },
    reservedForMemo: {
      type: Number,
      default: 0,
      min: [0, 'reservedForMemo cannot be negative'],
    },
    memoMinDays: {
      type: Number,
      default: 3,
      min: [1, 'memoMinDays must be at least 1'],
    },
    memoMaxDays: {
      type: Number,
      default: MEMO_MAX_DAYS_CEILING,
      min: [1, 'memoMaxDays must be at least 1'],
      max: [
        MEMO_MAX_DAYS_CEILING,
        `memoMaxDays cannot exceed ${MEMO_MAX_DAYS_CEILING} days`,
      ],
      validate: {
        validator: function (this: IProduct, v: number) {
          return v >= (this.memoMinDays ?? 3);
        },
        message: 'memoMaxDays must be greater than or equal to memoMinDays',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

// Every "is this in stock / can I add to cart" check across the storefront
// must read THIS instead of raw `stock` — otherwise a customer can buy an
// item that's physically out on memo with a trade customer. Not stored, so
// it can never drift from stock/reservedForMemo.
ProductSchema.virtual('availableStock').get(function (this: IProduct) {
  return Math.max(0, this.stock - (this.reservedForMemo || 0));
});

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
ProductSchema.index({ cutType: 1 });
ProductSchema.index({ origin: 1 });
ProductSchema.index({ treatment: 1 });

// Common indexes
ProductSchema.index({ price: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ category: 1, subcategory: 1 });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ category: 1, price: 1 });

// Covers the storefront's default subcategory-browse query — filter on
// {category, subcategory, isActive} sorted by createdAt (the "newest" default
// sort). Without this, Mongo can only use {category:1, subcategory:1} for the
// filter and then has to sort the matched set in memory on every request,
// which is exactly the "click a subcategory → wait" symptom.
ProductSchema.index({ category: 1, subcategory: 1, isActive: 1, createdAt: -1 });
// Category-only browse (no subcategory selected) needs the same treatment.
ProductSchema.index({ category: 1, isActive: 1, createdAt: -1 });

ProductSchema.index({ shape: 1, size: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

// Memo index
ProductSchema.index({ memoEligible: 1 });

const Product = (() => {
  if (mongoose.models && mongoose.models.Product) {
    return mongoose.models.Product as mongoose.Model<IProduct>;
  }
  return mongoose.model<IProduct>('Product', ProductSchema);
})();

export default Product;