import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletterSubscriber extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  status: 'active' | 'unsubscribed';
  subscribedAt: Date;
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
    status: {
      type: String,
      enum: ['active', 'unsubscribed'],
      default: 'active',
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

NewsletterSubscriberSchema.index({ email: 1 });
NewsletterSubscriberSchema.index({ status: 1 });

const NewsletterSubscriber =
  mongoose.models.NewsletterSubscriber ||
  mongoose.model<INewsletterSubscriber>('NewsletterSubscriber', NewsletterSubscriberSchema);

export default NewsletterSubscriber;
