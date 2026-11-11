import mongoose, { Document, Schema } from 'mongoose';

/**
 * One row per (campaign, recipient). Created when a campaign starts sending and
 * worked through in chunks, so a send survives serverless time limits, can be
 * resumed if the admin closes the tab, and never mails the same address twice
 * for one campaign (enforced by the unique index below).
 */
export type DeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed';
export type DeliverySource = 'website' | 'legacy' | 'user';

export interface INewsletterDelivery extends Document {
  _id: mongoose.Types.ObjectId;
  campaign: mongoose.Types.ObjectId;
  email: string;
  name: string;
  source: DeliverySource;
  status: DeliveryStatus;
  claimId?: string;
  claimedAt?: Date;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsletterDeliverySchema = new Schema<INewsletterDelivery>(
  {
    campaign: { type: Schema.Types.ObjectId, ref: 'NewsletterCampaign', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    source: { type: String, enum: ['website', 'legacy', 'user'], default: 'website' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
    },
    claimId: { type: String },
    claimedAt: { type: Date },
    sentAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

NewsletterDeliverySchema.index({ campaign: 1, email: 1 }, { unique: true });
NewsletterDeliverySchema.index({ campaign: 1, status: 1 });
NewsletterDeliverySchema.index({ claimId: 1 });

const NewsletterDelivery =
  mongoose.models.NewsletterDelivery ||
  mongoose.model<INewsletterDelivery>('NewsletterDelivery', NewsletterDeliverySchema);

export default NewsletterDelivery;
