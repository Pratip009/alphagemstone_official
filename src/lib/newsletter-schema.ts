import { z } from 'zod';
import { CAMPAIGN_ACCENTS, CAMPAIGN_HEADER_STYLES } from '@/models/NewsletterCampaign';

export const campaignProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(300),
  price: z.number().nonnegative().default(0),
  image: z.string().max(2000).default(''),
  slug: z.string().max(300).default(''),
});

export const campaignAudienceSchema = z.object({
  subscribers: z.boolean().default(true),
  users: z.boolean().default(false),
  legacy: z.boolean().default(false),
});

/** Everything the admin can set on a campaign. Used for create, update,
 *  live preview and test sends so all four always agree. */
export const campaignInputSchema = z.object({
  title: z.string().trim().min(1, 'Headline is required').max(200),
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  preheader: z.string().trim().max(200).default(''),
  subtitle: z.string().trim().max(300).default(''),
  message: z.string().min(1, 'Message is required'),
  image: z.string().max(2000).optional().default(''),
  headerStyle: z.enum(CAMPAIGN_HEADER_STYLES).default('onyx'),
  accent: z.enum(CAMPAIGN_ACCENTS).default('gold'),
  greeting: z.boolean().default(true),
  ctaText: z.string().trim().max(60).default('Shop the Collection'),
  ctaUrl: z.string().trim().max(500).default(''),
  promoCode: z.string().trim().max(40).default(''),
  promoText: z.string().trim().max(200).default(''),
  productsHeading: z.string().trim().max(120).default('Hand-picked for you'),
  products: z.array(campaignProductSchema).max(6).default([]),
  audience: campaignAudienceSchema.default({ subscribers: true, users: false, legacy: false }),
});

/** Preview/test renders allow an unfinished draft. */
export const campaignDraftSchema = campaignInputSchema.extend({
  title: z.string().max(200).default(''),
  subject: z.string().max(300).default(''),
  message: z.string().default(''),
});
