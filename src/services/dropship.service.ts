import { Resend } from 'resend';
import { connectDB } from '@/lib/db';
import DropshipApplication, {
  IDropshipApplication,
} from '@/models/DropshipApplication';
import DropshipOrder, { IDropshipOrder } from '@/models/DropshipOrder';
import Product from '@/models/Product';
import { createPayPalOrder, capturePayPalOrder } from './paypal.service';
import {
  getShipEngineRates,
  purchaseLabelFromRate,
} from './shipengine.service';
import {
  STORE_ORIGIN,
  DEFAULT_PACKAGE,
  applyShippingServiceFee,
} from '@/lib/shipping-config';
import { buildTrackingUrl } from '@/models/ORDER_SHIPPING_FIELDS';
import type { ShippingAddress } from '@/types/shipping';
import {
  dropshipApplicationReceivedEmailHtml,
  adminNewDropshipApplicationEmailHtml,
  dropshipApplicationApprovedEmailHtml,
  dropshipApplicationRejectedEmailHtml,
  dropshipOrderConfirmationEmailHtml,
  dropshipOrderPaymentFailedEmailHtml,
  adminNewDropshipOrderEmailHtml,
} from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@alphagemstone.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com';
const ADMIN_NOTIFICATION_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

export class DropshipError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function portalUrlFor(application: { portalToken: string }): string {
  return `${SITE_URL}/drop-shipping/portal/${application.portalToken}`;
}

// ─── Applications ─────────────────────────────────────────────────────────────

export interface ApplyForDropshipInput {
  fullName: string;
  businessName?: string;
  email: string;
  phone?: string;
  website?: string;
  sellingChannels?: string[];
  message?: string;
}

export async function applyForDropship(
  input: ApplyForDropshipInput
): Promise<IDropshipApplication> {
  await connectDB();

  const application = await DropshipApplication.create({
    fullName: input.fullName,
    businessName: input.businessName,
    email: input.email,
    phone: input.phone,
    website: input.website,
    sellingChannels: input.sellingChannels || [],
    message: input.message,
  });

  void sendApplicationReceivedEmail(application);
  void sendAdminNewApplicationEmail(application);

  return application;
}

export async function adminListApplications(params: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  await connectDB();
  const limit = params.limit ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const filter =
    params.status && ['pending', 'approved', 'rejected'].includes(params.status)
      ? { status: params.status }
      : {};

  const [applications, total, pendingCount] = await Promise.all([
    DropshipApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DropshipApplication.countDocuments(filter),
    DropshipApplication.countDocuments({ status: 'pending' }),
  ]);

  return {
    applications,
    total,
    pendingCount,
    page,
    pages: Math.ceil(total / limit),
  };
}

export type AdminApplicationAction =
  | { action: 'approve' }
  | { action: 'reject'; reason?: string }
  | { action: 'deactivate' }
  | { action: 'reactivate' };

export async function adminUpdateApplication(
  applicationId: string,
  reviewerId: string,
  input: AdminApplicationAction
): Promise<IDropshipApplication> {
  await connectDB();

  const application = await DropshipApplication.findById(applicationId);
  if (!application) throw new DropshipError('Application not found', 404);

  if (input.action === 'approve') {
    application.status = 'approved';
    application.reviewedAt = new Date();
    application.reviewedBy = reviewerId;
    await application.save();
    void sendApplicationApprovedEmail(application);
  } else if (input.action === 'reject') {
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = reviewerId;
    application.rejectionReason = input.reason;
    await application.save();
    void sendApplicationRejectedEmail(application);
  } else if (input.action === 'deactivate') {
    // Instantly cuts off the seller's private link — checked on every
    // portal load and every order/payment action. Does not delete or
    // change their approval/order history.
    application.active = false;
    await application.save();
  } else if (input.action === 'reactivate') {
    application.active = true;
    await application.save();
  }

  return application;
}

export async function getApplicationByToken(
  token: string
): Promise<IDropshipApplication | null> {
  await connectDB();
  return DropshipApplication.findOne({ portalToken: token }).lean() as any;
}

// ─── Shipping ─────────────────────────────────────────────────────────────────

export interface ShippingDestinationInput {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

/**
 * Live ShipEngine/ShipStation rates for a dropship order, using the exact
 * same store origin/package defaults and tiered service fee as the normal
 * customer checkout (see order.service.ts / shipping-config.ts) — each rate
 * comes back with both the raw carrier rate and the fee-inclusive cost the
 * seller will actually be charged.
 */
export async function getDropshipShippingRates(
  token: string,
  destination: ShippingDestinationInput
) {
  await connectDB();

  const application = await DropshipApplication.findOne({ portalToken: token });
  if (!application) throw new DropshipError('Invalid portal link', 404);
  if (application.status !== 'approved') {
    throw new DropshipError('Your dropship application is not yet approved', 403);
  }
  if (application.active === false) {
    throw new DropshipError('This dropship account has been deactivated.', 403);
  }

  // ShipStation rejects anything but an exact 2-letter code for US/CA
  // addresses with an opaque error — catching it here gives the seller a
  // clear, actionable message instead of a raw carrier-API exception.
  const state = (destination.state || '').trim().toUpperCase();
  if (state.length !== 2) {
    throw new DropshipError(
      'Please select a valid state/province before getting shipping rates.',
      400
    );
  }

  const destAddr: ShippingAddress = {
    fullName: 'Dropship Customer',
    street1: destination.street1,
    street2: destination.street2,
    city: destination.city,
    state,
    postalCode: destination.postalCode,
    country: destination.country || 'US',
  };

  const rates = await getShipEngineRates(STORE_ORIGIN, destAddr, DEFAULT_PACKAGE);

  return rates.map((r) => ({
    ...r,
    costWithFee: applyShippingServiceFee(r.rate),
  }));
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface DropshipShippingSelection {
  carrier: string;
  service: string;
  serviceCode: string;
  rateId: string;
  rate: number; // raw carrier rate, as quoted by getDropshipShippingRates
  estimatedDays?: number;
  estimatedDelivery?: string;
}

export interface SubmitDropshipOrderInput {
  productId: string;
  quantity?: number;
  specifications?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  shippingSelection: DropshipShippingSelection;
  specialInstructions?: string;
}

/**
 * Creates a dropship order against a real catalog product and atomically
 * reserves its stock (mirrors reserveStockForItems in order.service.ts) —
 * the order starts life as pending_payment / unpaid, and does NOT get
 * handed to fulfillment until PayPal payment is captured. Shipping is a
 * real ShipEngine rate the seller picked, with the same tiered service fee
 * as the normal customer checkout — never a free-text guess.
 */
export async function submitDropshipOrder(
  token: string,
  input: SubmitDropshipOrderInput
): Promise<IDropshipOrder> {
  await connectDB();

  const application = await DropshipApplication.findOne({ portalToken: token });
  if (!application) throw new DropshipError('Invalid portal link', 404);
  if (application.status !== 'approved') {
    throw new DropshipError('Your dropship application is not yet approved', 403);
  }
  if (application.active === false) {
    throw new DropshipError(
      'This dropship account has been deactivated. Contact Alpha Gemstone for help.',
      403
    );
  }

  if (!input.shippingSelection?.rateId) {
    throw new DropshipError('Please select a shipping method before continuing.', 400);
  }

  const quantity = Math.max(1, input.quantity || 1);

  const product = await Product.findOneAndUpdate(
    {
      _id: input.productId,
      $expr: {
        $gte: [
          { $subtract: ['$stock', { $ifNull: ['$reservedForMemo', 0] }] },
          quantity,
        ],
      },
    },
    { $inc: { stock: -quantity } },
    { new: true }
  );
  if (!product) {
    throw new DropshipError(
      'That product is no longer available in the quantity requested. Please check availability and try again.',
      409
    );
  }

  // Same tiered fee logic as normal checkout — computed once here from the
  // raw rate so nothing downstream has to re-derive it (see the identical
  // comment/reasoning in order.service.ts createOrderFromCart).
  const productAmount = Math.round(product.price * quantity * 100) / 100;
  const shippingCost = applyShippingServiceFee(input.shippingSelection.rate);
  const serviceFee = Math.round((shippingCost - input.shippingSelection.rate) * 100) / 100;
  const amount = Math.round((productAmount + shippingCost) * 100) / 100;

  try {
    const order = await DropshipOrder.create({
      application: application._id,
      sellerBusinessName: application.businessName || application.fullName,
      sellerEmail: application.email,
      product: product._id,
      productName: product.name,
      productImage: Array.isArray((product as any).images) ? (product as any).images[0] : (product as any).image,
      unitPrice: product.price,
      quantity,
      productAmount,
      amount,
      specifications: input.specifications,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country || 'United States',
      shippingCarrier: input.shippingSelection.carrier,
      shippingService: input.shippingSelection.service,
      shippingServiceCode: input.shippingSelection.serviceCode,
      shippingRateId: input.shippingSelection.rateId,
      shippingRate: input.shippingSelection.rate,
      shippingCost,
      serviceFee,
      shippingEstimatedDays: input.shippingSelection.estimatedDays,
      shippingEstimatedDelivery: input.shippingSelection.estimatedDelivery,
      specialInstructions: input.specialInstructions,
      stockReserved: true,
    });
    return order;
  } catch (err) {
    // Order creation failed after stock was reserved — release it back
    // rather than leaving the unit stuck in limbo.
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: quantity } }).catch(() => {});
    throw err;
  }
}

export async function listOrdersForToken(
  token: string
): Promise<{ application: IDropshipApplication; orders: IDropshipOrder[] } | null> {
  await connectDB();
  const application = await DropshipApplication.findOne({
    portalToken: token,
  }).lean();
  if (!application) return null;

  const orders = await DropshipOrder.find({ application: (application as any)._id })
    .sort({ createdAt: -1 })
    .lean();

  return { application: application as any, orders: orders as any };
}

/** Starts PayPal checkout for a pending, unpaid dropship order. Returns the PayPal order id for the smart buttons. */
export async function initiateDropshipPayment(
  token: string,
  orderId: string
): Promise<{ paypalOrderId: string }> {
  await connectDB();

  const application = await DropshipApplication.findOne({ portalToken: token });
  if (!application) throw new DropshipError('Invalid portal link', 404);
  if (application.active === false) {
    throw new DropshipError('This dropship account has been deactivated.', 403);
  }

  const order = await DropshipOrder.findOne({ _id: orderId, application: application._id });
  if (!order) throw new DropshipError('Order not found', 404);
  if (order.paymentStatus === 'completed') {
    throw new DropshipError('This order has already been paid.', 409);
  }

  const paypalOrder = await createPayPalOrder(order.amount);
  order.paypalOrderId = paypalOrder.id;
  await order.save();

  return { paypalOrderId: paypalOrder.id };
}

/**
 * Captures a PayPal payment for a dropship order. Only on a successful
 * capture does the order become eligible for fulfillment (status moves to
 * 'processing') — adminUpdateOrder refuses to move status forward before
 * this. Stock was already reserved at submission time, so a successful
 * capture does not touch stock again; a failed capture releases it.
 */
export async function captureDropshipPayment(
  token: string,
  paypalOrderId: string
): Promise<IDropshipOrder> {
  await connectDB();

  const application = await DropshipApplication.findOne({ portalToken: token });
  if (!application) throw new DropshipError('Invalid portal link', 404);

  // Look the order up by BOTH paypalOrderId and application — a token can
  // only ever capture payment for its own orders, never someone else's.
  const order = await DropshipOrder.findOne({
    paypalOrderId,
    application: application._id,
  });
  if (!order) throw new DropshipError('Order not found for this payment', 404);
  if (order.paymentStatus === 'completed') {
    return order; // already captured (e.g. duplicate client call) — no-op
  }

  let captureData;
  try {
    captureData = await capturePayPalOrder(paypalOrderId);
  } catch (err) {
    order.paymentStatus = 'failed';
    await order.save();
    void sendPaymentFailedEmail(order, application);
    throw new DropshipError('Payment could not be completed. Please try again.', 402);
  }

  if (captureData.status !== 'COMPLETED') {
    order.paymentStatus = 'failed';
    await order.save();
    void sendPaymentFailedEmail(order, application);
    throw new DropshipError('Payment was not completed.', 402);
  }

  order.paymentStatus = 'completed';
  order.status = 'processing';
  order.paypalPaymentId =
    captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  await order.save();

  void sendOrderPaidEmail(order, application);
  void sendAdminNewOrderEmail(order);

  // Auto-purchase the ShipEngine label using the rate the seller picked at
  // checkout — same as order.service.ts's capturePayment. Best-effort: a
  // failure here must never undo the payment we already took; it's logged
  // and left for admin to retry manually (see adminPurchaseDropshipLabel).
  if (order.shippingRateId) {
    try {
      await purchaseAndSaveDropshipLabel(order);
    } catch (err) {
      console.error(`[ShipEngine] Auto-label failed for dropship order ${order._id}:`, err);
    }
  }

  return order;
}

/**
 * Purchases a ShipEngine label for a paid dropship order using its stored
 * shippingRateId, and saves labelId/labelUrl/trackingNumber/trackingUrl/
 * shippedAt. Mirrors order.service.ts's purchaseAndSaveLabel. Safe to call
 * more than once — a label already on the order is left untouched.
 */
export async function purchaseAndSaveDropshipLabel(
  order: IDropshipOrder
): Promise<IDropshipOrder> {
  if (order.paymentStatus !== 'completed') {
    throw new DropshipError('Cannot purchase a label before payment is completed.', 409);
  }
  if (order.labelId) return order; // already purchased — no-op

  if (!order.shippingRateId) {
    throw new DropshipError('This order has no shipping rate on file.', 400);
  }

  const label = await purchaseLabelFromRate(order.shippingRateId);
  const trackingUrl = buildTrackingUrl(order.shippingCarrier ?? null, label.trackingNumber);

  order.labelId = label.labelId;
  order.labelUrl = label.labelUrl;
  order.trackingNumber = label.trackingNumber;
  order.trackingUrl = trackingUrl ?? undefined;
  order.shippedAt = new Date();
  await order.save();

  return order;
}

/** Admin manual retry when auto-purchase-on-payment failed or needs redoing. */
export async function adminPurchaseDropshipLabel(orderId: string): Promise<IDropshipOrder> {
  await connectDB();
  const order = await DropshipOrder.findById(orderId);
  if (!order) throw new DropshipError('Order not found', 404);
  return purchaseAndSaveDropshipLabel(order);
}

export async function adminListOrders(params: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  await connectDB();
  const limit = params.limit ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const filter =
    params.status &&
    ['pending_payment', 'processing', 'shipped', 'delivered', 'cancelled'].includes(
      params.status
    )
      ? { status: params.status }
      : {};

  const [orders, total, pipeline] = await Promise.all([
    DropshipOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('application', 'fullName businessName email')
      .lean(),
    DropshipOrder.countDocuments(filter),
    getPipelineCounts(),
  ]);

  return { orders, total, page, pages: Math.ceil(total / limit), pipeline };
}

/** Simple funnel counts for the admin "at a glance" dashboard Balu asked for. */
export async function getPipelineCounts() {
  await connectDB();
  const [
    applicantsPending,
    applicantsApproved,
    ordersAwaitingPayment,
    ordersPaid,
    ordersShipped,
    ordersDelivered,
  ] = await Promise.all([
    DropshipApplication.countDocuments({ status: 'pending' }),
    DropshipApplication.countDocuments({ status: 'approved' }),
    DropshipOrder.countDocuments({ paymentStatus: 'pending', status: { $ne: 'cancelled' } }),
    DropshipOrder.countDocuments({ paymentStatus: 'completed', status: 'processing' }),
    DropshipOrder.countDocuments({ status: 'shipped' }),
    DropshipOrder.countDocuments({ status: 'delivered' }),
  ]);
  return {
    applicantsPending,
    applicantsApproved,
    ordersAwaitingPayment,
    ordersPaid,
    ordersShipped,
    ordersDelivered,
  };
}

export interface AdminOrderUpdateInput {
  status?: 'pending_payment' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  adminNotes?: string;
}

export async function adminUpdateOrder(
  orderId: string,
  input: AdminOrderUpdateInput
): Promise<IDropshipOrder> {
  await connectDB();
  const order = await DropshipOrder.findById(orderId);
  if (!order) throw new DropshipError('Order not found', 404);

  if (input.status) {
    const movingIntoFulfillment = ['processing', 'shipped', 'delivered'].includes(
      input.status
    );
    // Balu's explicit requirement: only a PAID order may move into the
    // shipping process. Cancelling is always allowed (e.g. a stalled,
    // never-paid order).
    if (movingIntoFulfillment && order.paymentStatus !== 'completed') {
      throw new DropshipError(
        'This order has not been paid yet — it cannot move into fulfillment until payment is completed.',
        409
      );
    }
    if (input.status === 'cancelled' && order.stockReserved) {
      await Product.findByIdAndUpdate(order.product, { $inc: { stock: order.quantity } }).catch(() => {});
      order.stockReserved = false;
    }
    order.status = input.status;
  }
  if (input.trackingNumber !== undefined) order.trackingNumber = input.trackingNumber;
  if (input.trackingUrl !== undefined) order.trackingUrl = input.trackingUrl;
  if (input.adminNotes !== undefined) order.adminNotes = input.adminNotes;

  await order.save();
  return order;
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function sendApplicationReceivedEmail(
  application: IDropshipApplication
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: application.email,
      subject: 'We received your Alpha Gemstone Dropship application',
      html: dropshipApplicationReceivedEmailHtml({ fullName: application.fullName }),
    });
    if (error) console.error('[dropshipApplicationReceivedEmail] Resend error:', error);
  } catch (err) {
    console.error('[dropshipApplicationReceivedEmail] Failed:', err);
  }
}

async function sendAdminNewApplicationEmail(
  application: IDropshipApplication
): Promise<void> {
  try {
    if (ADMIN_NOTIFICATION_EMAILS.length === 0) return;
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_NOTIFICATION_EMAILS,
      subject: `New Dropship Application — ${application.fullName}`,
      html: adminNewDropshipApplicationEmailHtml({
        applicationId: application._id.toString(),
        fullName: application.fullName,
        businessName: application.businessName,
        email: application.email,
        phone: application.phone,
        website: application.website,
        sellingChannels: application.sellingChannels,
      }),
    });
    if (error) console.error('[adminNewDropshipApplicationEmail] Resend error:', error);
  } catch (err) {
    console.error('[adminNewDropshipApplicationEmail] Failed:', err);
  }
}

async function sendApplicationApprovedEmail(
  application: IDropshipApplication
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: application.email,
      subject: "You're approved — Alpha Gemstone Dropship Program",
      html: dropshipApplicationApprovedEmailHtml({
        fullName: application.fullName,
        portalUrl: portalUrlFor(application),
      }),
    });
    if (error) console.error('[dropshipApplicationApprovedEmail] Resend error:', error);
  } catch (err) {
    console.error('[dropshipApplicationApprovedEmail] Failed:', err);
  }
}

async function sendApplicationRejectedEmail(
  application: IDropshipApplication
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: application.email,
      subject: 'An update on your Alpha Gemstone Dropship application',
      html: dropshipApplicationRejectedEmailHtml({
        fullName: application.fullName,
        reason: application.rejectionReason,
      }),
    });
    if (error) console.error('[dropshipApplicationRejectedEmail] Resend error:', error);
  } catch (err) {
    console.error('[dropshipApplicationRejectedEmail] Failed:', err);
  }
}

async function sendOrderPaidEmail(
  order: IDropshipOrder,
  application: IDropshipApplication
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: application.email,
      subject: `Payment received — ${order.customerName}'s order`,
      html: dropshipOrderConfirmationEmailHtml({
        sellerName: application.fullName,
        productName: order.productName,
        quantity: order.quantity,
        amount: order.amount,
        customerName: order.customerName,
        portalUrl: portalUrlFor(application),
      }),
    });
    if (error) console.error('[sendOrderPaidEmail] Resend error:', error);
  } catch (err) {
    console.error('[sendOrderPaidEmail] Failed:', err);
  }
}

async function sendPaymentFailedEmail(
  order: IDropshipOrder,
  application: IDropshipApplication
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: application.email,
      subject: `Payment not completed — ${order.productName}`,
      html: dropshipOrderPaymentFailedEmailHtml({
        sellerName: application.fullName,
        productName: order.productName,
        portalUrl: portalUrlFor(application),
      }),
    });
    if (error) console.error('[sendPaymentFailedEmail] Resend error:', error);
  } catch (err) {
    console.error('[sendPaymentFailedEmail] Failed:', err);
  }
}

async function sendAdminNewOrderEmail(order: IDropshipOrder): Promise<void> {
  try {
    if (ADMIN_NOTIFICATION_EMAILS.length === 0) return;
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_NOTIFICATION_EMAILS,
      subject: `Paid Dropship Order — ${order.customerName}`,
      html: adminNewDropshipOrderEmailHtml({
        orderId: order._id.toString(),
        sellerBusinessName: order.sellerBusinessName,
        sellerEmail: order.sellerEmail,
        productName: order.productName,
        quantity: order.quantity,
        amount: order.amount,
        customerName: order.customerName,
        city: order.city,
        country: order.country,
      }),
    });
    if (error) console.error('[adminNewDropshipOrderEmail] Resend error:', error);
  } catch (err) {
    console.error('[adminNewDropshipOrderEmail] Failed:', err);
  }
}
