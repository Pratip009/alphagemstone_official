import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ sortOrder: 1 });

const Category = (() => {
  if (mongoose.models && mongoose.models.Category) {
    return mongoose.models.Category as mongoose.Model<ICategory>;
  }
  return mongoose.model<ICategory>('Category', CategorySchema);
})();

export default Category;