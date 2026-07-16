import Coupon, { ICoupon } from '@/models/Coupon';
import { Resend } from 'resend';
import { couponEmailHtml } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const DISCOUNT_PERCENT = 10;   // 10% off subtotal
const MIN_PURCHASE     = 200;  // $200 minimum subtotal
const VALIDITY_DAYS    = 30;   // 1 month

/** Computes the dollar discount for a given subtotal at the given percentage, rounded to cents. */
function calculateDiscountAmount(subtotal: number, percent: number): number {
  return Math.round(subtotal * (percent / 100) * 100) / 100;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a unique 10-character alphanumeric code prefixed with "AG" */
async function generateUniqueCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let attempts = 0;
  while (attempts < 20) {
    const rand = Array.from({ length: 8 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    const code = `AG${rand}`; // 10 chars total
    const exists = await Coupon.exists({ code });
    if (!exists) return code;
    attempts++;
  }
  throw new Error('Failed to generate a unique coupon code');
}

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendCouponEmail(
  email: string,
  code: string,
  expiresAt: Date,
  discountPercent: number,
) {
  const { error } = await resend.emails.send({
    from:    EMAIL_FROM,
    to:      email,
    subject: `Your ${discountPercent}% Off Coupon — Alpha Imports`,
    html:    couponEmailHtml({ email, code, expiresAt, discountPercent, minPurchase: MIN_PURCHASE }),
  });

  if (error) {
    console.error('[couponEmail] Resend error:', error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
}

// ─── Public: subscribe (from modal) ──────────────────────────────────────────

/**
 * Creates a coupon for the given email and sends it via Resend.
 * Returns the coupon document.
 */
export async function subscribeCoupon(email: string): Promise<ICoupon> {
  const normalizedEmail = email.toLowerCase().trim();

  // Prevent duplicates — one active coupon per email
  const existing = await Coupon.findOne({ email: normalizedEmail, isUsed: false });
  if (existing) {
    // Resend the existing code if still valid
    if (existing.expiresAt > new Date()) {
      await sendCouponEmail(normalizedEmail, existing.code, existing.expiresAt, existing.discountPercent);
      return existing;
    }
    // Expired — fall through to create a new one
  }

  const code      = await generateUniqueCode();
  const expiresAt = new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  const coupon = new Coupon({
    email:           normalizedEmail,
    code,
    discountPercent: DISCOUNT_PERCENT,
    minPurchase:     MIN_PURCHASE,
    expiresAt,
  });
  await coupon.save();

  await sendCouponEmail(normalizedEmail, code, expiresAt, DISCOUNT_PERCENT);

  return coupon;
}

// ─── Public: validate (from checkout) ────────────────────────────────────────

interface ValidateResult {
  valid: boolean;
  discount: number;
  message: string;
  couponId?: string;
}

export async function validateCoupon(code: string, subtotal: number): Promise<ValidateResult> {
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

  if (!coupon) {
    return { valid: false, discount: 0, message: 'Invalid coupon code.' };
  }
  if (coupon.isUsed) {
    return { valid: false, discount: 0, message: 'This coupon has already been used.' };
  }
  if (coupon.expiresAt < new Date()) {
    return { valid: false, discount: 0, message: 'This coupon has expired.' };
  }
  if (subtotal < coupon.minPurchase) {
    return {
      valid: false,
      discount: 0,
      message: `A minimum purchase of $${coupon.minPurchase} is required to use this coupon.`,
    };
  }

  const discountAmount = calculateDiscountAmount(subtotal, coupon.discountPercent);

  return {
    valid:    true,
    discount: discountAmount,
    message:  `${coupon.discountPercent}% off applied! (-$${discountAmount.toFixed(2)})`,
    couponId: coupon._id.toString(),
  };
}

// ─── Admin: resend coupon email ───────────────────────────────────────────────

/**
 * Re-sends the coupon email for an existing coupon by its id.
 * Throws if the coupon doesn't exist, is already used, or has expired.
 */
export async function resendCouponEmail(id: string): Promise<ICoupon> {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new Error('Coupon not found');
  if (coupon.isUsed) throw new Error('Cannot resend a coupon that has already been used');
  if (coupon.expiresAt < new Date()) throw new Error('Cannot resend an expired coupon');

  await sendCouponEmail(coupon.email, coupon.code, coupon.expiresAt, coupon.discountPercent);

  return coupon;
}

// ─── Internal: redeem on order ────────────────────────────────────────────────

export async function redeemCoupon(code: string, orderId: string, subtotal: number): Promise<number> {
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (!coupon || coupon.isUsed || coupon.expiresAt < new Date()) return 0;

  coupon.isUsed        = true;
  coupon.usedAt        = new Date();
  coupon.usedByOrderId = orderId as unknown as any;
  await coupon.save();

  return calculateDiscountAmount(subtotal, coupon.discountPercent);
}

// ─── Admin: list coupons ──────────────────────────────────────────────────────

interface ListOptions {
  page?:   number;
  limit?:  number;
  search?: string;
  status?: 'active' | 'used' | 'expired' | 'all';
}

export async function listCoupons(opts: ListOptions = {}) {
  const { page = 1, limit = 20, search, status = 'all' } = opts;
  const now = new Date();

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { code:  { $regex: search, $options: 'i' } },
    ];
  }

  if (status === 'active')  filter.$and = [{ isUsed: false }, { expiresAt: { $gt: now } }];
  if (status === 'used')    filter.isUsed = true;
  if (status === 'expired') filter.$and = [{ isUsed: false }, { expiresAt: { $lte: now } }];

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('usedByOrderId', '_id')
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  return { coupons, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getCouponStats() {
  const now = new Date();
  const [total, active, used, expired] = await Promise.all([
    Coupon.countDocuments(),
    Coupon.countDocuments({ isUsed: false, expiresAt: { $gt: now } }),
    Coupon.countDocuments({ isUsed: true }),
    Coupon.countDocuments({ isUsed: false, expiresAt: { $lte: now } }),
  ]);
  return { total, active, used, expired };
}

export async function deleteCoupon(id: string) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new Error('Coupon not found');
  if (coupon.isUsed) throw new Error('Cannot delete a redeemed coupon');
  await coupon.deleteOne();
}