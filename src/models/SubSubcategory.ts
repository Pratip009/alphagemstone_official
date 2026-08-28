import mongoose, { Document, Schema } from 'mongoose';

// ─── SubSubcategory ─────────────────────────────────────────────────────────
// A third taxonomy level nested under Subcategory — e.g.
// Precious Gems > Tanzanite > "Oval Tanzanite" / "Calibrated Tanzanite" / …
//
// Deliberately mirrors Subcategory's shape (name/slug/image/isActive) so the
// admin UI and storefront card components can share the same rendering
// logic. `category` is denormalized from the parent Subcategory purely so
// category-scoped queries/admin filters don't need an extra populate hop —
// `subcategory` is always the source of truth for "which subcategory does
// this belong to".
//
// This does NOT show up in the navbar (the mega-menu only ever renders
// Category → Subcategory). It only ever appears once a shopper has drilled
// into a Subcategory landing page that has children — see
// listSubcategoriesWithChildFlag() in category.service.ts for how the
// storefront decides whether to route to this intermediate grid or
// straight to /products.
export interface ISubSubcategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  subcategory: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  description?: string;
  imageUrl?: string;       // R2/Cloudinary secure_url
  imagePublicId?: string;  // required for deletion
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubSubcategorySchema = new Schema<ISubSubcategory>(
  {
    name: {
      type: String,
      required: [true, 'Sub-subcategory name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: 'Subcategory',
      required: [true, 'Subcategory is required'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    description:   { type: String, trim: true },
    imageUrl:      { type: String, trim: true },
    imagePublicId: { type: String, trim: true },
    sortOrder:     { type: Number, default: 0 },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

SubSubcategorySchema.index({ slug: 1, subcategory: 1 }, { unique: true });
SubSubcategorySchema.index({ subcategory: 1, isActive: 1, sortOrder: 1 });
SubSubcategorySchema.index({ category: 1 });
SubSubcategorySchema.index({ isActive: 1 });

const SubSubcategory = (() => {
  if (mongoose.models && mongoose.models.SubSubcategory) {
    return mongoose.models.SubSubcategory as mongoose.Model<ISubSubcategory>;
  }
  return mongoose.model<ISubSubcategory>('SubSubcategory', SubSubcategorySchema);
})();

export default SubSubcategory;
