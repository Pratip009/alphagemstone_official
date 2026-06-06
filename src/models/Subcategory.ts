import mongoose, { Document, Schema } from 'mongoose';

export interface ISubcategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  category: mongoose.Types.ObjectId;
  description?: string;
  imageUrl?: string;       // Cloudinary secure_url
  imagePublicId?: string;  // Cloudinary public_id — required for deletion
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubcategorySchema = new Schema<ISubcategory>(
  {
    name: {
      type: String,
      required: [true, 'Subcategory name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    description:   { type: String, trim: true },
    imageUrl:      { type: String, trim: true },  // ← new
    imagePublicId: { type: String, trim: true },  // ← new
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

SubcategorySchema.index({ slug: 1, category: 1 }, { unique: true });
SubcategorySchema.index({ category: 1 });
SubcategorySchema.index({ isActive: 1 });

const Subcategory = (() => {
  if (mongoose.models && mongoose.models.Subcategory) {
    return mongoose.models.Subcategory as mongoose.Model<ISubcategory>;
  }
  return mongoose.model<ISubcategory>('Subcategory', SubcategorySchema);
})();

export default Subcategory;