import mongoose, { Document, Schema } from 'mongoose';

export interface IWishlistItem {
  product: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const WishlistItemSchema = new Schema<IWishlistItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WishlistSchema = new Schema<IWishlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [WishlistItemSchema], default: [] },
  },
  { timestamps: true }
);

const Wishlist = (() => {
  if (mongoose.models && mongoose.models.Wishlist) {
    return mongoose.models.Wishlist as mongoose.Model<IWishlist>;
  }
  return mongoose.model<IWishlist>('Wishlist', WishlistSchema);
})();

export default Wishlist;