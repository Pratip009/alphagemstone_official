import mongoose, { Document, Schema } from 'mongoose';

export interface INewsletterCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  subject: string;
  message: string;
  image: string;
  status: 'draft' | 'sending' | 'sent';
  sentAt?: Date;
  totalRecipients: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NewsletterCampaignSchema = new Schema<INewsletterCampaign>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 300,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
    },
    image: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'sending', 'sent'],
      default: 'draft',
    },
    sentAt: {
      type: Date,
    },
    totalRecipients: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

NewsletterCampaignSchema.index({ status: 1 });
NewsletterCampaignSchema.index({ createdAt: -1 });

const NewsletterCampaign =
  mongoose.models.NewsletterCampaign ||
  mongoose.model<INewsletterCampaign>('NewsletterCampaign', NewsletterCampaignSchema);

export default NewsletterCampaign;
