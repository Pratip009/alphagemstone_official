import mongoose, { Document, Schema } from 'mongoose';

/**
 * Where a newsletter contact came from.
 *  - website : signed up through the site's newsletter form (the original flow)
 *  - legacy  : imported from the old website's customer list by an admin
 *  - account : a registered customer who used an unsubscribe link without ever
 *              being a subscriber. These rows only exist to remember the opt-out
 *              (status is always 'unsubscribed') so they're skipped on every send.
 * Documents created before this field existed have no `source` and are treated
 * as 'website'.
 */
export const SUBSCRIBER_SOURCES = ['website', 'legacy', 'account'] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

export interface INewsletterSubscriber extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  source: SubscriberSource;
  status: 'active' | 'unsubscribed';
  subscribedAt: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsletterSubscriberSchema = new Schema<INewsletterSubscriber>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    source: {
      type: String,
      enum: SUBSCRIBER_SOURCES,
      default: 'website',
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed'],
      default: 'active',
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Note: email index is already created by `unique: true` in the schema field definition.
NewsletterSubscriberSchema.index({ status: 1 });
NewsletterSubscriberSchema.index({ source: 1, status: 1 });

const NewsletterSubscriber =
  mongoose.models.NewsletterSubscriber ||
  mongoose.model<INewsletterSubscriber>('NewsletterSubscriber', NewsletterSubscriberSchema);

export default NewsletterSubscriber;
