import mongoose, { Document, Schema } from 'mongoose';

// ─── Sub-document interfaces ─────────────────────────────────────────────────

export interface IBlogReply {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  userName: string;
  isAdmin: boolean;
  message: string;
  createdAt: Date;
}

export interface IBlogComment {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  userName: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  replies: IBlogReply[];
}

// ─── Main Blog interface ─────────────────────────────────────────────────────

export interface IBlog extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  shortDescription: string;
  content: string;
  featuredImage: string;
  category: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  status: 'draft' | 'published';
  author: mongoose.Types.ObjectId;
  authorName: string;
  views: number;
  likes: mongoose.Types.ObjectId[];
  comments: IBlogComment[];
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Reply sub-schema ────────────────────────────────────────────────────────

const ReplySchema = new Schema<IBlogReply>(
  {
    user:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    isAdmin:  { type: Boolean, default: false },
    message:  { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ─── Comment sub-schema ──────────────────────────────────────────────────────

const CommentSchema = new Schema<IBlogComment>(
  {
    user:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    message:  { type: String, required: true, trim: true, maxlength: 2000 },
    replies:  { type: [ReplySchema], default: [] },
  },
  { timestamps: true }
);

// ─── Blog schema ─────────────────────────────────────────────────────────────

const BlogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
      maxlength: [500, 'Short description cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    featuredImage: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    seoTitle:       { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    views:    { type: Number, default: 0, min: 0 },
    likes:    { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    comments: { type: [CommentSchema], default: [] },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────

BlogSchema.index({ slug: 1 }, { unique: true });
BlogSchema.index({ status: 1 });
BlogSchema.index({ publishedAt: -1 });
BlogSchema.index({ category: 1 });
BlogSchema.index({ tags: 1 });
BlogSchema.index(
  { title: 'text', shortDescription: 'text', tags: 'text' },
  { weights: { title: 10, shortDescription: 5, tags: 3 } }
);

// ─── Model ───────────────────────────────────────────────────────────────────

const Blog = (() => {
  if (mongoose.models && mongoose.models.Blog) {
    return mongoose.models.Blog as mongoose.Model<IBlog>;
  }
  return mongoose.model<IBlog>('Blog', BlogSchema);
})();

export default Blog;