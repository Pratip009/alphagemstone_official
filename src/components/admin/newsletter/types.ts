export type Accent = 'gold' | 'sapphire' | 'emerald' | 'ruby';
export type HeaderStyle = 'onyx' | 'ivory';

export interface CampaignProduct {
  productId: string;
  name: string;
  price: number;
  image: string;
  slug: string;
}

export interface Audience {
  subscribers: boolean;
  users: boolean;
  legacy: boolean;
}

export interface CampaignFormData {
  title: string;
  subject: string;
  preheader: string;
  subtitle: string;
  message: string;
  image: string;
  headerStyle: HeaderStyle;
  accent: Accent;
  greeting: boolean;
  ctaText: string;
  ctaUrl: string;
  promoCode: string;
  promoText: string;
  productsHeading: string;
  products: CampaignProduct[];
  audience: Audience;
}

export interface Campaign extends Partial<CampaignFormData> {
  _id: string;
  title: string;
  subject: string;
  message: string;
  image: string;
  status: 'draft' | 'sending' | 'sent';
  sentAt?: string;
  totalRecipients: number;
  sentCount?: number;
  failedCount?: number;
  createdAt: string;
}

export interface AudienceSummary {
  subscribers: number;
  users: number;
  legacy: number;
  total: number;
  suppressed: number;
}

export const EMPTY_FORM: CampaignFormData = {
  title: '',
  subject: '',
  preheader: '',
  subtitle: '',
  message: '',
  image: '',
  headerStyle: 'onyx',
  accent: 'gold',
  greeting: true,
  ctaText: 'Shop the Collection',
  ctaUrl: '',
  promoCode: '',
  promoText: '',
  productsHeading: 'Hand-picked for you',
  products: [],
  audience: { subscribers: true, users: false, legacy: false },
};

/** Fill in defaults for campaigns saved before the advanced fields existed. */
export function formFromCampaign(c: Partial<CampaignFormData>): CampaignFormData {
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== null)),
    audience: { ...EMPTY_FORM.audience, ...(c.audience ?? {}) },
    products: c.products ?? [],
  } as CampaignFormData;
}

export const AUDIENCE_LABELS: Record<keyof Audience, { label: string; help: string }> = {
  subscribers: { label: 'Newsletter subscribers', help: 'Signed up with the newsletter form on the site' },
  users: { label: 'Registered customers', help: 'Everyone with an account on the current site' },
  legacy: { label: 'Old website contacts', help: 'Customer emails imported from the previous website' },
};

export function audienceQuery(a: Audience) {
  return new URLSearchParams({
    subscribers: a.subscribers ? '1' : '0',
    users: a.users ? '1' : '0',
    legacy: a.legacy ? '1' : '0',
  }).toString();
}
