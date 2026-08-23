import mongoose, { Document, Schema } from 'mongoose';

// ─── Admin reply sub-document ──────────────────────────────────────────────
// A review can carry at most one admin reply (matches how the storefront
// renders it — a single "Reply from Alpha Gemstone" block under the
// review). Re-posting a reply just overwrites text/repliedAt/repliedBy
// rather than stacking multiple replies.
export interface IReviewReply {
  text: string;
  repliedBy: mongoose.Types.ObjectId;
  repliedAt: Date;
}

const ReviewReplySchema = new Schema<IReviewReply>(
  {
    text: {
      type: String,
      required: [true, 'Reply text is required'],
      trim: true,
      maxlength: [1000, 'Reply cannot exceed 1000 characters'],
    },
    repliedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repliedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  // Snapshot of the buyer's name at review time — populate() covers the
  // common case, but this keeps the review readable even if the user's
  // account is later deleted.
  userName: string;
  // Set once at creation by checking the buyer's order history for a
  // paid/delivered order containing this product. Never recomputed later.
  verifiedPurchase: boolean;
  // "Helpful" / like reactions — one per user, toggled on/off. Stored as
  // an array of user ids (not just a counter) so we can tell a given
  // visitor whether *they* have already reacted, and so a double-click
  // can never double-count.
  likes: mongoose.Types.ObjectId[];
  adminReply?: IReviewReply;
  // Lets an admin unpublish a review (spam, abuse) without permanently
  // destroying the record. Storefront queries always filter isHidden: false.
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number between 1 and 5',
      },
    },
    title: { type: String, trim: true, maxlength: [150, 'Title cannot exceed 150 characters'] },
    comment: {
      type: String,
      required: [true, 'Review text is required'],
      trim: true,
      minlength: [3, 'Review is too short'],
      maxlength: [2000, 'Review cannot exceed 2000 characters'],
    },
    userName: { type: String, required: true, trim: true },
    verifiedPurchase: { type: Boolean, default: false },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    adminReply: { type: ReviewReplySchema, default: undefined },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One review per user per product — resubmission should edit the existing
// review, not create a second one.
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });
// Storefront's default query: newest-first reviews for a visible product.
ReviewSchema.index({ product: 1, isHidden: 1, createdAt: -1 });

const Review = (() => {
  if (mongoose.models && mongoose.models.Review) {
    return mongoose.models.Review as mongoose.Model<IReview>;
  }
  return mongoose.model<IReview>('Review', ReviewSchema);
})();

export default Review;
