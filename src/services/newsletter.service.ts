import { Resend } from 'resend';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import NewsletterCampaign, { INewsletterCampaign } from '@/models/NewsletterCampaign';
import { newsletterEmailHtml } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com';
const BATCH_SIZE = 50;

// ─── Subscribe ──────────────────────────────────────────────────────────────

export async function subscribeEmail(email: string): Promise<{
  alreadySubscribed: boolean;
}> {
  const normalised = email.toLowerCase().trim();

  const existing = await NewsletterSubscriber.findOne({ email: normalised }).lean();

  if (existing) {
    return { alreadySubscribed: true };
  }

  await NewsletterSubscriber.create({ email: normalised });
  return { alreadySubscribed: false };
}

// ─── Admin: list subscribers ─────────────────────────────────────────────────

export async function listSubscribers(opts: {
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'unsubscribed' | 'all';
}) {
  const { page, limit, search, status } = opts;
  const filter: Record<string, unknown> = {};

  if (status && status !== 'all') filter.status = status;
  if (search) filter.email = { $regex: search, $options: 'i' };

  const [subscribers, total] = await Promise.all([
    NewsletterSubscriber.find(filter)
      .sort({ subscribedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    NewsletterSubscriber.countDocuments(filter),
  ]);

  return { subscribers, total };
}

// ─── Admin: subscriber stats ──────────────────────────────────────────────────

export async function subscriberStats() {
  const [total, active] = await Promise.all([
    NewsletterSubscriber.countDocuments(),
    NewsletterSubscriber.countDocuments({ status: 'active' }),
  ]);
  return { total, active };
}

// ─── Admin: campaign CRUD ─────────────────────────────────────────────────────

export async function createCampaign(data: {
  title: string;
  subject: string;
  message: string;
  image: string;
  createdBy: string;
}) {
  return NewsletterCampaign.create(data);
}

export async function updateCampaign(
  id: string,
  data: { title: string; subject: string; message: string; image: string }
) {
  const campaign = await NewsletterCampaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'draft') throw new Error('Only draft campaigns can be edited');

  Object.assign(campaign, data);
  return campaign.save();
}

export async function deleteCampaign(id: string) {
  const campaign = await NewsletterCampaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'draft') throw new Error('Only draft campaigns can be deleted');
  await campaign.deleteOne();
}

export async function listCampaigns(opts: { page: number; limit: number }) {
  const { page, limit } = opts;
  const [campaigns, total] = await Promise.all([
    NewsletterCampaign.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    NewsletterCampaign.countDocuments(),
  ]);
  return { campaigns, total };
}

export async function getCampaign(id: string) {
  return NewsletterCampaign.findById(id).lean();
}

// ─── Admin: campaign stats ────────────────────────────────────────────────────

export async function campaignStats() {
  const total = await NewsletterCampaign.countDocuments();
  const lastSent = await NewsletterCampaign.findOne({ status: 'sent' })
    .sort({ sentAt: -1 })
    .select('title sentAt')
    .lean();
  return { total, lastSent };
}

// ─── Admin: send campaign ─────────────────────────────────────────────────────

export async function sendCampaign(id: string): Promise<{
  sent: number;
  failed: number;
}> {
  const campaign = await NewsletterCampaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent') throw new Error('Campaign already sent');
  if (campaign.status === 'sending') throw new Error('Campaign is already being sent');

  // Mark as sending immediately so double-clicks are prevented
  campaign.status = 'sending';
  await campaign.save();

  const activeSubscribers = await NewsletterSubscriber.find({ status: 'active' })
    .select('email')
    .lean();

  if (activeSubscribers.length === 0) {
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.totalRecipients = 0;
    await campaign.save();
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Send in batches to respect Resend rate limits
  for (let i = 0; i < activeSubscribers.length; i += BATCH_SIZE) {
    const batch = activeSubscribers.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((sub) => {
        const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(sub.email)}`;
        const html = newsletterEmailHtml({
          title: campaign.title,
          subject: campaign.subject,
          message: campaign.message,
          image: campaign.image || undefined,
          unsubscribeUrl,
        });

        return resend.emails.send({
          from: FROM,
          to: sub.email,
          subject: campaign.subject,
          html,
        });
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        console.error('[Newsletter] Failed to send email:', result.reason);
      }
    }

    // Small delay between batches to be gentle on the API
    if (i + BATCH_SIZE < activeSubscribers.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  campaign.status = 'sent';
  campaign.sentAt = new Date();
  campaign.totalRecipients = sent;
  await campaign.save();

  console.log(`[Newsletter] Campaign "${campaign.title}" sent: ${sent} ok, ${failed} failed`);
  return { sent, failed };
}
