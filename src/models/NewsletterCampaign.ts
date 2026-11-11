import mongoose, { Document, Schema } from 'mongoose';

export const CAMPAIGN_ACCENTS = ['gold', 'sapphire', 'emerald', 'ruby'] as const;
export type CampaignAccent = (typeof CAMPAIGN_ACCENTS)[number];

export const CAMPAIGN_HEADER_STYLES = ['onyx', 'ivory'] as const;
export type CampaignHeaderStyle = (typeof CAMPAIGN_HEADER_STYLES)[number];

export interface ICampaignProduct {
  productId: string;
  name: string;
  price: number;
  image: string;
  slug: string;
}

export interface ICampaignAudience {
  /** People who signed up through the website newsletter form */
  subscribers: boolean;
  /** Everyone with an account on the current site */
  users: boolean;
  /** Contacts imported from the old website */
  legacy: boolean;
}

export interface INewsletterCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  subject: string;
  preheader: string;
  subtitle: string;
  message: string;
  image: string;
  headerStyle: CampaignHeaderStyle;
  accent: CampaignAccent;
  greeting: boolean;
  ctaText: string;
  ctaUrl: string;
  promoCode: string;
  promoText: string;
  productsHeading: string;
  products: ICampaignProduct[];
  audience: ICampaignAudience;
  status: 'draft' | 'sending' | 'sent';
  sentAt?: Date;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignProductSchema = new Schema<ICampaignProduct>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    image: { type: String, default: '' },
    slug: { type: String, default: '' },
  },
  { _id: false }
);

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
    preheader: { type: String, trim: true, maxlength: 200, default: '' },
    subtitle: { type: String, trim: true, maxlength: 300, default: '' },
    message: {
      type: String,
      required: [true, 'Message is required'],
    },
    image: { type: String, default: '' },
    headerStyle: { type: String, enum: CAMPAIGN_HEADER_STYLES, default: 'onyx' },
    accent: { type: String, enum: CAMPAIGN_ACCENTS, default: 'gold' },
    greeting: { type: Boolean, default: true },
    ctaText: { type: String, trim: true, maxlength: 60, default: 'Shop the Collection' },
    ctaUrl: { type: String, trim: true, maxlength: 500, default: '' },
    promoCode: { type: String, trim: true, maxlength: 40, default: '' },
    promoText: { type: String, trim: true, maxlength: 200, default: '' },
    productsHeading: { type: String, trim: true, maxlength: 120, default: 'Hand-picked for you' },
    products: { type: [CampaignProductSchema], default: [] },
    audience: {
      subscribers: { type: Boolean, default: true },
      users: { type: Boolean, default: false },
      legacy: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['draft', 'sending', 'sent'],
      default: 'draft',
    },
    sentAt: { type: Date },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
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
