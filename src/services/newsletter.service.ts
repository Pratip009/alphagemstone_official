import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Resend } from 'resend';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import NewsletterCampaign, {
  INewsletterCampaign,
  ICampaignAudience,
  ICampaignProduct,
} from '@/models/NewsletterCampaign';
import NewsletterDelivery, { DeliverySource } from '@/models/NewsletterDelivery';
import User from '@/models/User';
import Product from '@/models/Product';
import {
  renderNewsletterEmail,
  applyMergeTags,
  NewsletterContent,
  NewsletterRecipient,
} from '@/lib/newsletter-template';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.NEWSLETTER_FROM || process.env.EMAIL_FROM || 'onboarding@resend.dev';
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO || process.env.SUPPORT_EMAIL || undefined;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com').replace(/\/$/, '');

/** Resend's batch endpoint accepts up to 100 messages per request. */
const BATCH_SIZE = 100;
/** Pause between batch requests — keeps us under Resend's default 2 req/s limit. */
const BATCH_PAUSE_MS = 600;
/** How long one /send request keeps working before handing back to the browser.
 *  Kept well under typical serverless limits; the admin page calls again. */
const CHUNK_TIME_BUDGET_MS = 40_000;
/** A 'processing' row older than this was abandoned by a crashed request. */
const STALE_CLAIM_MS = 5 * 60_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function unsubscribeUrlFor(email: string) {
  return `${SITE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
}

// Website signups. Old documents have no `source`, so "website" is anything
// that isn't explicitly legacy/account.
const WEBSITE_SOURCE_FILTER = { source: { $nin: ['legacy', 'account'] } };

// ─── Subscribe / unsubscribe ─────────────────────────────────────────────────

export async function subscribeEmail(email: string): Promise<{ alreadySubscribed: boolean }> {
  const normalised = email.toLowerCase().trim();
  const existing = await NewsletterSubscriber.findOne({ email: normalised });

  if (existing) {
    // Someone who unsubscribed earlier and signs up again is opting back in.
    if (existing.status === 'unsubscribed') {
      existing.status = 'active';
      existing.subscribedAt = new Date();
      existing.unsubscribedAt = undefined;
      if (existing.source === 'account') existing.source = 'website';
      await existing.save();
      return { alreadySubscribed: false };
    }
    return { alreadySubscribed: true };
  }

  await NewsletterSubscriber.create({ email: normalised, source: 'website' });
  return { alreadySubscribed: false };
}

/**
 * Opt an address out of every newsletter audience. Registered customers and
 * old-site contacts who were never in the subscriber list get a row created
 * (source 'account') purely so future sends skip them.
 */
export async function unsubscribeEmail(email: string) {
  const normalised = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalised)) return;
  await NewsletterSubscriber.updateOne(
    { email: normalised },
    {
      $set: { status: 'unsubscribed', unsubscribedAt: new Date() },
      $setOnInsert: { email: normalised, source: 'account', subscribedAt: new Date() },
    },
    { upsert: true }
  );
}

// ─── Admin: list subscribers ─────────────────────────────────────────────────

export type SourceFilter = 'all' | 'website' | 'legacy' | 'account';

function sourceFilter(source?: SourceFilter): Record<string, unknown> {
  if (!source || source === 'all') return {};
  if (source === 'website') return WEBSITE_SOURCE_FILTER;
  return { source };
}

export async function listSubscribers(opts: {
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'unsubscribed' | 'all';
  source?: SourceFilter;
}) {
  const { page, limit, search, status, source } = opts;
  const filter: Record<string, unknown> = { ...sourceFilter(source) };

  if (status && status !== 'all') filter.status = status;
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { email: { $regex: safe, $options: 'i' } },
      { name: { $regex: safe, $options: 'i' } },
    ];
  }

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

export async function exportSubscribers(source?: SourceFilter) {
  return NewsletterSubscriber.find({ status: 'active', ...sourceFilter(source) })
    .select('email name source subscribedAt')
    .sort({ subscribedAt: -1 })
    .lean();
}

// ─── Admin: import old-website contacts ───────────────────────────────────────

export async function importLegacyContacts(contacts: { email: string; name?: string }[]) {
  const seen = new Set<string>();
  const valid: { email: string; name: string }[] = [];
  let invalid = 0;

  for (const c of contacts) {
    const email = String(c.email ?? '').toLowerCase().trim();
    if (!EMAIL_RE.test(email) || email.length > 254) { invalid++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push({ email, name: String(c.name ?? '').trim().slice(0, 120) });
  }

  if (valid.length === 0) return { added: 0, alreadyListed: 0, invalid };

  // $setOnInsert only: an address that's already a subscriber (or already
  // unsubscribed) keeps its status and source untouched.
  const now = new Date();
  const res = await NewsletterSubscriber.bulkWrite(
    valid.map(v => ({
      updateOne: {
        filter: { email: v.email },
        update: {
          $setOnInsert: {
            email: v.email,
            name: v.name,
            source: 'legacy',
            status: 'active',
            subscribedAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const added = res.upsertedCount ?? 0;
  return { added, alreadyListed: valid.length - added, invalid };
}

// ─── Audience ─────────────────────────────────────────────────────────────────

interface ResolvedRecipient {
  email: string;
  name: string;
  source: DeliverySource;
}

/**
 * Everyone a campaign would go to, de-duplicated by email (an address that is
 * both a customer and a subscriber gets one email) and minus every address
 * that has unsubscribed — whichever list they came from.
 */
export async function resolveAudience(audience: ICampaignAudience) {
  const [suppressedDocs, websiteDocs, legacyDocs, userDocs] = await Promise.all([
    NewsletterSubscriber.find({ status: 'unsubscribed' }).select('email').lean<{ email: string }[]>(),
    audience.subscribers
      ? NewsletterSubscriber.find({ status: 'active', ...WEBSITE_SOURCE_FILTER }).select('email name').lean()
      : Promise.resolve([]),
    audience.legacy
      ? NewsletterSubscriber.find({ status: 'active', source: 'legacy' }).select('email name').lean()
      : Promise.resolve([]),
    audience.users
      // Accounts created without proving the address (emailVerified: false)
      // are skipped — they're the likeliest bounces.
      ? User.find({ emailVerified: { $ne: false } }).select('email name').lean()
      : Promise.resolve([]),
  ]);

  const suppressed = new Set(
    suppressedDocs.map(d => d.email.toLowerCase())
  );
  const map = new Map<string, ResolvedRecipient>();
  const counts = { subscribers: 0, users: 0, legacy: 0 };

  const add = (docs: { email?: string; name?: string }[], source: DeliverySource, key: keyof typeof counts) => {
    for (const d of docs) {
      const email = (d.email ?? '').toLowerCase().trim();
      if (!EMAIL_RE.test(email) || suppressed.has(email)) continue;
      counts[key]++;
      const existing = map.get(email);
      if (!existing) {
        map.set(email, { email, name: (d.name ?? '').trim(), source });
      } else if (!existing.name && d.name) {
        existing.name = d.name.trim();
      }
    }
  };

  // Order matters only for which "why you got this" line someone sees when
  // they're on several lists: account holders first, then subscribers.
  add(userDocs as { email?: string; name?: string }[], 'user', 'users');
  add(websiteDocs as { email?: string; name?: string }[], 'website', 'subscribers');
  add(legacyDocs as { email?: string; name?: string }[], 'legacy', 'legacy');

  return { recipients: [...map.values()], counts, suppressed: suppressed.size };
}

export async function audienceSummary(audience: ICampaignAudience) {
  const { recipients, counts, suppressed } = await resolveAudience(audience);
  return { ...counts, total: recipients.length, suppressed };
}

// ─── Admin: stats ─────────────────────────────────────────────────────────────

export async function subscriberStats() {
  const [total, active, legacyActive, registeredUsers] = await Promise.all([
    NewsletterSubscriber.countDocuments(WEBSITE_SOURCE_FILTER),
    NewsletterSubscriber.countDocuments({ status: 'active', ...WEBSITE_SOURCE_FILTER }),
    NewsletterSubscriber.countDocuments({ status: 'active', source: 'legacy' }),
    User.countDocuments({ emailVerified: { $ne: false } }),
  ]);
  return { total, active, legacyActive, registeredUsers };
}

export async function campaignStats() {
  const total = await NewsletterCampaign.countDocuments();
  const lastSent = await NewsletterCampaign.findOne({ status: 'sent' })
    .sort({ sentAt: -1 })
    .select('title sentAt')
    .lean();
  return { total, lastSent };
}

// ─── Admin: campaign CRUD ─────────────────────────────────────────────────────

export interface CampaignInput {
  title: string;
  subject: string;
  preheader: string;
  subtitle: string;
  message: string;
  image: string;
  headerStyle: 'onyx' | 'ivory';
  accent: 'gold' | 'sapphire' | 'emerald' | 'ruby';
  greeting: boolean;
  ctaText: string;
  ctaUrl: string;
  promoCode: string;
  promoText: string;
  productsHeading: string;
  products: ICampaignProduct[];
  audience: ICampaignAudience;
}

export async function createCampaign(data: CampaignInput & { createdBy: string }) {
  return NewsletterCampaign.create(data);
}

export async function updateCampaign(id: string, data: CampaignInput) {
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
  await NewsletterDelivery.deleteMany({ campaign: campaign._id });
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

// ─── Rendering ────────────────────────────────────────────────────────────────

function contentOf(c: Partial<INewsletterCampaign> | CampaignInput): NewsletterContent {
  return {
    title: c.title ?? '',
    subject: c.subject ?? '',
    preheader: c.preheader ?? '',
    subtitle: c.subtitle ?? '',
    message: c.message ?? '',
    image: c.image ?? '',
    headerStyle: c.headerStyle ?? 'onyx',
    accent: c.accent ?? 'gold',
    // Campaigns created before these fields existed: keep their old look
    // (no greeting, the old "Shop the Collection" button).
    greeting: c.greeting ?? false,
    ctaText: c.ctaText ?? 'Shop the Collection',
    ctaUrl: c.ctaUrl ?? '',
    promoCode: c.promoCode ?? '',
    promoText: c.promoText ?? '',
    productsHeading: c.productsHeading ?? '',
    products: (c.products ?? []).map(p => ({ ...p })),
  };
}

export function renderPreview(data: CampaignInput, recipient?: Partial<NewsletterRecipient>) {
  const r: NewsletterRecipient = {
    email: recipient?.email || 'customer@example.com',
    name: recipient?.name ?? 'Sarah Collins',
    source: recipient?.source ?? 'website',
  };
  return renderNewsletterEmail(contentOf(data), r, { unsubscribeUrl: '#' });
}

function buildMessage(content: NewsletterContent, r: NewsletterRecipient, sendDate: Date) {
  const unsubscribeUrl = unsubscribeUrlFor(r.email);
  return {
    from: FROM,
    to: r.email,
    subject: applyMergeTags(content.subject, r, false),
    html: renderNewsletterEmail(content, r, { unsubscribeUrl, sendDate }),
    ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    // One-click unsubscribe (RFC 8058). Gmail and Yahoo require it for bulk
    // senders, and it keeps complaints — and spam-folder placement — down.
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export async function sendTestEmail(data: CampaignInput, to: string, name?: string) {
  if (!EMAIL_RE.test(to)) throw new Error('Enter a valid email address for the test');
  const content = contentOf(data);
  const msg = buildMessage(content, { email: to, name: name ?? '', source: 'website' }, new Date());
  const { error } = await resend.emails.send({ ...msg, subject: `[Test] ${msg.subject}` });
  if (error) throw new Error(error.message || 'Resend rejected the test email');
}

/** Re-read featured products right before sending so prices, names and
 *  images are current, and anything deactivated since is dropped. */
async function refreshProducts(products: ICampaignProduct[]): Promise<ICampaignProduct[]> {
  const ids = products.map(p => p.productId).filter(id => mongoose.isValidObjectId(id));
  if (ids.length === 0) return [];
  const docs = await Product.find({ _id: { $in: ids }, isActive: true })
    .select('name price images slug')
    .lean<{ _id: mongoose.Types.ObjectId; name: string; price: number; images?: string[]; slug?: string }[]>();
  const byId = new Map(docs.map(d => [String(d._id), d]));
  return products
    .map(p => {
      const d = byId.get(p.productId);
      if (!d) return null;
      return { productId: p.productId, name: d.name, price: d.price, image: d.images?.[0] ?? p.image, slug: d.slug ?? p.slug };
    })
    .filter((p): p is ICampaignProduct => p !== null);
}

// ─── Admin: send campaign (chunked + resumable) ───────────────────────────────

export interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  done: boolean;
}

async function progressOf(campaignId: mongoose.Types.ObjectId): Promise<Omit<SendProgress, 'done'>> {
  const rows = await NewsletterDelivery.aggregate<{ _id: string; n: number }>([
    { $match: { campaign: campaignId } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const by = Object.fromEntries(rows.map(r => [r._id, r.n])) as Record<string, number>;
  const sent = by.sent ?? 0;
  const failed = by.failed ?? 0;
  const remaining = (by.pending ?? 0) + (by.processing ?? 0);
  return { total: sent + failed + remaining, sent, failed, remaining };
}

/** Moves a draft into 'sending' and writes one delivery row per recipient. */
async function startCampaign(id: string) {
  // Atomic draft → sending, so two clicks can't both start the same campaign.
  const campaign = await NewsletterCampaign.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { $set: { status: 'sending' } },
    { new: true }
  );
  if (!campaign) return null;

  try {
    const audience: ICampaignAudience = {
      subscribers: campaign.audience?.subscribers ?? true,
      users: campaign.audience?.users ?? false,
      legacy: campaign.audience?.legacy ?? false,
    };
    if (!audience.subscribers && !audience.users && !audience.legacy) {
      throw new Error('Choose at least one audience before sending');
    }
    const { recipients } = await resolveAudience(audience);
    if (recipients.length === 0) {
      throw new Error('The selected audience has no one to send to');
    }

    campaign.products = await refreshProducts(campaign.products ?? []);
    campaign.totalRecipients = recipients.length;
    await campaign.save();

    for (let i = 0; i < recipients.length; i += 1000) {
      const slice = recipients.slice(i, i + 1000).map(r => ({
        campaign: campaign._id,
        email: r.email,
        name: r.name,
        source: r.source,
        status: 'pending',
      }));
      try {
        await NewsletterDelivery.insertMany(slice, { ordered: false });
      } catch (err) {
        // Duplicate-key errors only mean a row already exists — fine.
        const code = (err as { code?: number }).code;
        const writeErrors = (err as { writeErrors?: { code?: number; err?: { code?: number } }[] }).writeErrors;
        const allDupes = code === 11000 || (writeErrors ?? []).every(e => (e.code ?? e.err?.code) === 11000);
        if (!allDupes) throw err;
      }
    }
  } catch (err) {
    // Couldn't build the recipient list — put it back to draft so it can be retried.
    await NewsletterDelivery.deleteMany({ campaign: campaign._id });
    campaign.status = 'draft';
    await campaign.save();
    throw err;
  }

  return campaign;
}

/**
 * Starts (if still a draft) and then works through the campaign's queue for up
 * to ~40 seconds. The admin page calls this repeatedly until `done` is true,
 * which shows live progress and stays inside serverless time limits. If the
 * page is closed mid-way, the campaign stays "sending" and can be resumed.
 */
export async function sendCampaignChunk(id: string): Promise<SendProgress> {
  if (!mongoose.isValidObjectId(id)) throw new Error('Campaign not found');

  let campaign = await NewsletterCampaign.findById(id);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent') throw new Error('Campaign already sent');

  if (campaign.status === 'draft') {
    const started = await startCampaign(id);
    campaign = started ?? (await NewsletterCampaign.findById(id));
    if (!campaign) throw new Error('Campaign not found');
  }

  const content = contentOf(campaign.toObject());
  const sendDate = new Date();
  const startedAt = Date.now();

  // Rows claimed by a request that died mid-way go back in the queue.
  await NewsletterDelivery.updateMany(
    { campaign: campaign._id, status: 'processing', claimedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
    { $set: { status: 'pending' }, $unset: { claimId: 1, claimedAt: 1 } }
  );

  while (Date.now() - startedAt < CHUNK_TIME_BUDGET_MS) {
    // Claim a batch. Only rows still 'pending' at update time are taken, so a
    // second tab working the same campaign can never grab the same people.
    const candidates = await NewsletterDelivery.find({ campaign: campaign._id, status: 'pending' })
      .select('_id')
      .limit(BATCH_SIZE)
      .lean<{ _id: mongoose.Types.ObjectId }[]>();
    if (candidates.length === 0) break;

    const claimId = randomUUID();
    await NewsletterDelivery.updateMany(
      { _id: { $in: candidates.map(c => c._id) }, status: 'pending' },
      { $set: { status: 'processing', claimId, claimedAt: new Date() } }
    );
    const batch = await NewsletterDelivery.find({ claimId }).lean<
      { _id: mongoose.Types.ObjectId; email: string; name: string; source: DeliverySource }[]
    >();
    if (batch.length === 0) continue;

    const messages = batch.map(d => buildMessage(content, { email: d.email, name: d.name, source: d.source }, sendDate));

    let attempt = 0;
    let lastError: { message?: string; name?: string; statusCode?: number | null } | null = null;
    let ok = false;
    while (attempt < 3 && !ok) {
      attempt++;
      try {
        const { error } = await resend.batch.send(messages);
        if (!error) { ok = true; break; }
        lastError = error as typeof lastError;
        const rateLimited = (error as { statusCode?: number }).statusCode === 429 || /rate/i.test(error.name ?? '');
        if (!rateLimited) break;
        await sleep(1500 * attempt);
      } catch (err) {
        lastError = { message: err instanceof Error ? err.message : String(err) };
        await sleep(1000 * attempt);
      }
    }

    if (ok) {
      await NewsletterDelivery.updateMany(
        { claimId },
        { $set: { status: 'sent', sentAt: new Date() }, $unset: { claimId: 1, claimedAt: 1 } }
      );
    } else {
      console.error('[Newsletter] Batch failed:', lastError);
      await NewsletterDelivery.updateMany(
        { claimId },
        {
          $set: { status: 'failed', error: (lastError?.message ?? 'Unknown error').slice(0, 300) },
          $unset: { claimId: 1, claimedAt: 1 },
        }
      );
    }

    await sleep(BATCH_PAUSE_MS);
  }

  const p = await progressOf(campaign._id);
  const done = p.remaining === 0;

  campaign.sentCount = p.sent;
  campaign.failedCount = p.failed;
  if (done) {
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.totalRecipients = p.sent;
    console.log(`[Newsletter] Campaign "${campaign.title}" finished: ${p.sent} sent, ${p.failed} failed`);
  }
  await campaign.save();

  return { ...p, done };
}
