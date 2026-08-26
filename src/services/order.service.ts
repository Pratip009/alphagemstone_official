import Order, { IOrder, IShippingAddress } from '@/models/Order';
import Cart, { ICart } from '@/models/Cart';
import Product, { IProduct } from '@/models/Product';
import User from '@/models/User';
import { clearCart, calculateCartTotals } from './cart.service';
import { capturePayPalOrder, createPayPalOrder } from './paypal.service';
import { validateCoupon, redeemCoupon } from './coupon.service';
import { purchaseLabelFromRate, trackShipEnginePackage } from './shipengine.service';
import { buildTrackingUrl } from '@/models/ORDER_SHIPPING_FIELDS';
import { Resend } from 'resend';
import {
  orderConfirmationEmailHtml,
  orderShippedEmailHtml,
  orderDeliveredEmailHtml,
  adminNewOrderEmailHtml,
} from '@/lib/email-templates';
import { applyShippingServiceFee } from '@/lib/shipping-config';
import { CartIdentity } from '@/middleware/auth.middleware';
const resend    = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const ADMIN_NOTIFICATION_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Estimates order weight in LB (0.5 LB per item, max 5 LB). */
function estimateWeightLb(totalItems: number): number {
  return Math.min(totalItems * 0.5, 5);
}

/** Builds a Cart/Order filter from a CartIdentity — user or guest. */
function identityFilter(identity: CartIdentity) {
  return identity.userId ? { user: identity.userId } : { guestId: identity.guestId };
}

/** Derives the identity that owns an already-created order (for IDOR checks,
 *  cart-clearing, etc. — orders don't carry a CartIdentity, just user/guestId). */
function identityOfOrder(order: { user?: unknown; guestId?: string | null }): CartIdentity {
  return order.user
    ? { userId: order.user.toString() }
    : { guestId: order.guestId as string };
}

function sameIdentity(a: CartIdentity, b: CartIdentity): boolean {
  if (a.userId || b.userId) return !!a.userId && a.userId === b.userId;
  return !!a.guestId && a.guestId === b.guestId;
}

// ─── Order creation ───────────────────────────────────────────────────────────

// `.populate('user', 'name email')` yields null for guest orders (no user
// ref to populate) — every email helper below must handle that and fall
// back to the order's own guestEmail/shippingAddress.fullName.
type PopulatedUserOrder = IOrder & { user?: { name: string; email: string } | null };

export interface ShippingSelection {
  shippingCarrier?:           string;
  shippingService?:           string;
  shippingServiceCode?:       string;
  shippingRateId?:            string;   // ShipEngine rate ID — used to purchase label
  shippingRate?:              number;
  shippingEstimatedDays?:     number;
  shippingEstimatedDelivery?: string;
}

export async function createOrderFromCart(
  identity: CartIdentity,
  shippingAddress: IShippingAddress,
  paymentMethod: 'paypal' | 'cod',
  couponCode?: string,
  shippingSelection?: ShippingSelection,
  // Required for guest checkout — logged-in users' email comes from their
  // account instead. Validated by the route's zod schema when identity is a
  // guest; double-checked here since this function is the source of truth.
  guestEmail?: string
) {
  if (!identity.userId && !guestEmail) {
    throw new Error('Email is required to check out as a guest');
  }

  const cart = await Cart.findOne(identityFilter(identity))
    .populate('items.product')
    .lean() as ICart | null;
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  const items = [];
  for (const item of cart.items) {
    const productDoc = item.product as unknown as IProduct;
    const product = await Product.findOne({
      _id: productDoc._id,
      isActive: true,
    }) as IProduct | null;
    if (!product) throw new Error('Product is no longer available');
    if (product.stock < item.quantity)
      throw new Error(`Insufficient stock for ${product.name}`);

    items.push({
      product:  product._id,
      name:     product.name,
      price:    product.price,
      quantity: item.quantity,
      image:    product.images[0],
    });
  }

  const { subtotal, tax, shippingCost } = calculateCartTotals(items);

  // Apply coupon
  let couponDiscount    = 0;
  let appliedCouponCode: string | null = null;
  if (couponCode) {
    const validation = await validateCoupon(couponCode, subtotal);
    if (validation.valid) {
      couponDiscount    = validation.discount;
      appliedCouponCode = couponCode.toUpperCase().trim();
    }
  }

  // rawShippingRate = the carrier's actual quoted rate (e.g. $7.50 for USPS).
  // serviceFee       = $2 if rawShippingRate < $10, else $0 — computed ONCE here
  //                    from the raw rate and stored as its own field, so nothing
  //                    downstream (admin panel, order history, emails) has to
  //                    re-derive it by subtracting numbers back out of a combined
  //                    total. That re-derivation is exactly what causes the
  //                    "$7.50 splits into $5.50 shipping + $2 fee" style bugs.
  const rawShippingRate =
    shippingSelection?.shippingRate !== undefined
      ? shippingSelection.shippingRate
      : shippingCost;
  const combinedShippingCost =
    shippingSelection?.shippingRate !== undefined
      ? applyShippingServiceFee(shippingSelection.shippingRate)
      : shippingCost;
  const serviceFee = Math.round((combinedShippingCost - rawShippingRate) * 100) / 100;
  const finalTotal = Math.max(0, subtotal + tax + combinedShippingCost - couponDiscount);

  const order = new Order({
    user:            identity.userId ?? undefined,
    guestId:         identity.guestId ?? undefined,
    guestEmail:      identity.userId ? undefined : guestEmail!.toLowerCase().trim(),
    items,
    shippingAddress,
    subtotal,
    tax,
    shippingCost:    combinedShippingCost,
    serviceFee,
    totalAmount:     finalTotal,
    appliedCouponCode,
    couponDiscount,
    paymentMethod,
    status:          'pending',
    paymentStatus:   'pending',
    // ShipEngine shipping selection
    shippingCarrier:           shippingSelection?.shippingCarrier           ?? null,
    shippingService:           shippingSelection?.shippingService           ?? null,
    shippingServiceCode:       shippingSelection?.shippingServiceCode       ?? null,
    shippingRateId:            shippingSelection?.shippingRateId            ?? null,
    shippingRate:              rawShippingRate,
    shippingEstimatedDays:     shippingSelection?.shippingEstimatedDays     ?? null,
    shippingEstimatedDelivery: shippingSelection?.shippingEstimatedDelivery ?? null,
  });

  await order.save();

  if (appliedCouponCode) {
    await redeemCoupon(appliedCouponCode, order._id.toString(), subtotal);
  }

  return order;
}

// ─── PayPal ───────────────────────────────────────────────────────────────────

export async function initiatePayPalPayment(
  orderId: string,
  identity?: CartIdentity,
  { skipOwnerCheck = false }: { skipOwnerCheck?: boolean } = {}
) {
  const order = await Order.findById(orderId) as IOrder | null;
  if (!order) throw new Error('Order not found');

  // IDOR guard: only the order's owner (logged-in user OR the guest whose
  // guest_id cookie matches — an explicit admin/webhook caller passes
  // skipOwnerCheck) may initiate payment on this order.
  if (!skipOwnerCheck) {
    if (!identity) throw new Error('Unauthorized');
    if (!sameIdentity(identityOfOrder(order), identity)) throw new Error('Order not found');
  }

  const paypalOrder = await createPayPalOrder(order.totalAmount);
  order.paypalOrderId = paypalOrder.id;
  await order.save();

  const approvalUrl = (
    paypalOrder.links as Array<{ rel: string; href: string }>
  )?.find((l) => l.rel === 'approve')?.href;

  return { paypalOrderId: paypalOrder.id, approvalUrl };
}

/**
 * Captures PayPal payment.
 * If a shippingRateId was saved at checkout, automatically purchases a
 * ShipEngine label. Label failure is non-fatal — admin can buy it manually
 * via POST /api/admin/orders/:id/purchase-label.
 */
export async function capturePayment(
  paypalOrderId: string,
  identity?: CartIdentity,
  { skipOwnerCheck = false }: { skipOwnerCheck?: boolean } = {}
) {
  const order = await Order.findOne({ paypalOrderId }) as IOrder | null;
  if (!order) throw new Error('Order not found');

  // IDOR guard: only the order's owner (logged-in user OR matching guest_id
  // cookie — an explicit admin/webhook caller passes skipOwnerCheck) may
  // capture payment on this order. Checked before calling PayPal so a
  // guessed paypalOrderId can't trigger a real capture, stock decrement,
  // cart clear, or confirmation email for someone else's order.
  if (!skipOwnerCheck) {
    if (!identity) throw new Error('Unauthorized');
    if (!sameIdentity(identityOfOrder(order), identity)) throw new Error('Order not found');
  }

  const captureData = await capturePayPalOrder(paypalOrderId);
  if (captureData.status !== 'COMPLETED') throw new Error('Payment not completed');

  // Decrement stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity },
    });
  }

  order.status          = 'paid';
  order.paymentStatus   = 'completed';
  order.paypalPaymentId =
    captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  await order.save();

  await clearCart(identityOfOrder(order));

  void sendOrderConfirmationEmail(order);
 
  void sendAdminNewOrderEmail(order);
  // Auto-purchase ShipEngine label if rate was stored at checkout
  const rateId = (order as any).shippingRateId as string | null;
  if (rateId) {
    try {
      await purchaseAndSaveLabel(order._id.toString(), rateId);
    } catch (err) {
      console.error(
        `[ShipEngine] Auto-label failed for order ${order._id}:`,
        err
      );
    }
  }

  return (await Order.findById(order._id).lean()) ?? order;
}

// ─── Order queries ────────────────────────────────────────────────────────────

export async function getUserOrders(userId: string) {
  return Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

// `identity` omitted → admin path, no ownership filter applied.
export async function getOrderById(orderId: string, identity?: CartIdentity) {
  const query: Record<string, unknown> = { _id: orderId };
  if (identity) Object.assign(query, identityFilter(identity));
  return Order.findOne(query).populate('items.product', 'name images').lean();
}

export async function getAllOrders(page = 1, limit = 20, status?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, total };
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/**
 * Fetches live tracking info for an order.
 * When userId is provided, only returns the order if it belongs to that user
 * (so customers can't view other people's orders); admins pass no userId.
 */
export async function getOrderTracking(orderId: string, identity?: CartIdentity) {
  const query: Record<string, unknown> = { _id: orderId };
  if (identity) Object.assign(query, identityFilter(identity));

  const order = await Order.findOne(query).lean() as IOrder | null;
  if (!order) throw new Error('Order not found');

  // ShipStation V2 only supports tracking lookups by label_id (not by the
  // customer-facing trackingNumber) — see trackShipEnginePackage's docblock.
  const labelId = (order as any).labelId as string | undefined;
  if (!labelId) {
    if ((order as any).trackingNumber) {
      // A tracking number exists (likely entered manually by an admin for a
      // non-ShipStation shipment) but we have no label to look it up with.
      throw new Error(
        'Live tracking isn\'t available for this order — it was shipped without a ' +
        'ShipStation label. Use the tracking number with the carrier directly.'
      );
    }
    throw new Error('No tracking information available for this order yet');
  }

  const tracking = await trackShipEnginePackage(labelId);

  return {
    trackingNumber:     tracking.trackingNumber,
    status:             tracking.status,
    statusDescription:  tracking.status,
    estimatedDelivery:  tracking.estimatedDelivery,
    actualDelivery:     tracking.deliveredAt ?? null,
    events:             tracking.events.map((e) => ({
      timestamp:   e.timestamp,
      eventType:   e.description,
      description: e.description,
      location:    e.location,
    })),
  };
}

// ─── Order status update ──────────────────────────────────────────────────────

export async function updateOrderStatus(orderId: string, status: string) {
  const validStatuses = [
    'pending', 'paid', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded',
  ];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const $set: Record<string, unknown> = { status };
  // Manually marking an order delivered (e.g. from the admin dropdown) should
  // also stamp deliveredAt, same as the automated webhook/cron path does.
  if (status === 'delivered') $set.deliveredAt = new Date();

  const order = await Order.findByIdAndUpdate(
    orderId,
    { $set },
    { new: true }
  )
    .populate('user', 'name email')
    .lean() as PopulatedUserOrder | null;

  if (order && status === 'shipped') {
    void sendOrderShippedEmail(order);
  }
  if (order && status === 'delivered') {
    void sendOrderDeliveredEmail(order);
  }

  return order;
}
export async function applyDeliveryStatus(
  orderId: string,
  deliveredAtFromCarrier: string | Date | null | undefined
) {
  if (!deliveredAtFromCarrier) return null;

  const order = await Order.findById(orderId)
    .populate('user', 'name email')
    .lean() as PopulatedUserOrder | null;
  if (!order) return null;

  // Already marked delivered (and already emailed) — nothing to do.
  if (order.status === 'delivered' && order.deliveryNotifiedAt) return null;
  // Don't resurrect a cancelled/refunded order just because the carrier
  // still reports movement.
  if (order.status === 'cancelled' || order.status === 'refunded') return null;

  const deliveredAt = new Date(deliveredAtFromCarrier);
  const updated = await Order.findByIdAndUpdate(
    orderId,
    { $set: { status: 'delivered', deliveredAt } },
    { new: true }
  )
    .populate('user', 'name email')
    .lean() as PopulatedUserOrder | null;

  if (updated && !order.deliveryNotifiedAt) {
    void sendOrderDeliveredEmail(updated);
  }

  return updated;
}
export async function getOrdersAwaitingDeliverySync() {
  return Order.find({
    status: { $in: ['processing', 'shipped'] },
    labelId: { $ne: null },
  })
    .select('_id labelId status')
    .lean() as unknown as Array<{ _id: any; labelId: string; status: string }>;
}

/** Look up an order by its ShipStation labelId (used by the webhook route). */
export async function getOrderByLabelId(labelId: string) {
  return Order.findOne({ labelId }).select('_id').lean() as Promise<{ _id: any } | null>;
}
// ─── ShipEngine label purchase ────────────────────────────────────────────────

/**
 * Purchases a ShipEngine label for a paid order.
 * Uses the stored shippingRateId unless rateId is explicitly provided.
 * Saves labelId, labelUrl, trackingNumber, and shippedAt to the order.
 */
export async function purchaseAndSaveLabel(
  orderId: string,
  rateId?: string,
  triggeredByAdmin = false
) {
  const order = await Order.findById(orderId)
    .populate('user', 'name email')
    .lean() as PopulatedUserOrder | null;
  if (!order) throw new Error('Order not found');
  if (order.paymentStatus !== 'completed') {
    throw new Error('Cannot purchase label: payment not completed');
  }

  const resolvedRateId = rateId ?? (order as any).shippingRateId;
  if (!resolvedRateId) {
    throw new Error(
      'No shippingRateId on this order. Select a shipping rate at checkout, or pass a rateId explicitly.'
    );
  }

  const label = await purchaseLabelFromRate(resolvedRateId);

  // When admin manually purchases, advance straight to 'shipped'.
  // When auto-purchased at payment capture, set 'processing' (label ready, not yet picked up).
  const newStatus = triggeredByAdmin ? 'shipped' : 'processing';

  // Carrier name we already have on the order from checkout (e.g. "UPS", "FedEx").
  // Falls back to the ShipStation carrier id if the friendly name isn't stored.
  const carrierForUrl = (order as any).shippingCarrier ?? label.carrierId ?? null;
  const trackingUrl = buildTrackingUrl(carrierForUrl, label.trackingNumber);

  await Order.findByIdAndUpdate(orderId, {
    $set: {
      labelId:        label.labelId,
      labelUrl:       label.labelUrl,
      trackingNumber: label.trackingNumber,
      trackingUrl,
      shippedAt:      new Date(),
      status:         newStatus,
    },
  });

  // Send "Your order has shipped" email when admin buys the label,
  // since they're about to physically hand it to the carrier.
  if (triggeredByAdmin && label.trackingNumber) {
    const updatedOrder = {
      ...order,
      trackingNumber: label.trackingNumber,
      trackingUrl,
      labelUrl:       label.labelUrl,
    } as PopulatedUserOrder;
    void sendOrderShippedEmail(updatedOrder);
  }

  return Order.findById(orderId).lean();
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function sendOrderConfirmationEmail(order: IOrder): Promise<void> {
  try {
    // Guest orders carry their own email/name (from checkout); logged-in
    // orders look the recipient up from the User doc as before.
    let recipientEmail: string | undefined;
    let recipientName: string;
    if (order.user) {
      const user = await User.findById(order.user)
        .select('name email')
        .lean() as { name: string; email: string } | null;
      if (!user) return;
      recipientEmail = user.email;
      recipientName = user.name;
    } else {
      recipientEmail = order.guestEmail;
      recipientName = order.shippingAddress.fullName;
    }
    if (!recipientEmail) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      recipientEmail,
      subject: `Order Confirmed — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    orderConfirmationEmailHtml({
        orderId:         order._id.toString(),
        customerName:    recipientName,
        items:           order.items.map((i) => ({
          name:     i.name,
          quantity: i.quantity,
          price:    i.price,
          image:    i.image,
        })),
        subtotal:        order.subtotal,
        shippingCost:    order.shippingCost,
        tax:             order.tax,
        totalAmount:     order.totalAmount,
        paymentMethod:   order.paymentMethod,
        shippingAddress: order.shippingAddress,
      }),
    });

    if (error) console.error('[orderConfirmationEmail] Resend error:', error);
  } catch (err) {
    console.error('[orderConfirmationEmail] Failed:', err);
  }
}

async function sendOrderShippedEmail(
  order: PopulatedUserOrder
): Promise<void> {
  try {
    if (!order.trackingNumber) return;
    const recipientEmail = order.user?.email ?? order.guestEmail;
    const recipientName  = order.user?.name  ?? order.shippingAddress.fullName;
    if (!recipientEmail) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      recipientEmail,
      subject: `Your Order Has Shipped — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    orderShippedEmailHtml({
        orderId:           order._id.toString(),
        customerName:      recipientName,
        trackingNumber:    order.trackingNumber,
        trackingUrl:       order.trackingUrl   ?? undefined,
        shippingCarrier:   order.shippingCarrier ?? undefined,
        estimatedDelivery: order.shippingEstimatedDelivery ?? undefined,
      }),
    });

    if (error) console.error('[orderShippedEmail] Resend error:', error);
  } catch (err) {
    console.error('[orderShippedEmail] Failed:', err);
  }
}
async function sendOrderDeliveredEmail(
  order: PopulatedUserOrder
): Promise<void> {
  try {
    const recipientEmail = order.user?.email ?? order.guestEmail;
    const recipientName  = order.user?.name  ?? order.shippingAddress.fullName;
    if (!recipientEmail) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      recipientEmail,
      subject: `Your Order Has Been Delivered — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    orderDeliveredEmailHtml({
        orderId:        order._id.toString(),
        customerName:   recipientName,
        trackingNumber: order.trackingNumber ?? undefined,
        deliveredAt:    order.deliveredAt
          ? new Date(order.deliveredAt).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })
          : undefined,
      }),
    });

    if (error) {
      console.error('[orderDeliveredEmail] Resend error:', error);
      return;
    }

    // Mark as notified so applyDeliveryStatus / updateOrderStatus don't
    // re-send this if called again for the same order.
    await Order.findByIdAndUpdate(order._id, { $set: { deliveryNotifiedAt: new Date() } });
  } catch (err) {
    console.error('[orderDeliveredEmail] Failed:', err);
  }
}

async function sendAdminNewOrderEmail(order: IOrder): Promise<void> {
  if (ADMIN_NOTIFICATION_EMAILS.length === 0) return; // not configured — skip silently
  try {
    let customerName: string;
    let customerEmail: string | undefined;
    if (order.user) {
      const user = await User.findById(order.user)
        .select('name email')
        .lean() as { name: string; email: string } | null;
      if (!user) return;
      customerName = user.name;
      customerEmail = user.email;
    } else {
      customerName = `${order.shippingAddress.fullName} (guest)`;
      customerEmail = order.guestEmail;
    }
    if (!customerEmail) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      ADMIN_NOTIFICATION_EMAILS,
      subject: `New Order — #${order._id.toString().slice(-8).toUpperCase()} ($${order.totalAmount.toFixed(2)})`,
      html:    adminNewOrderEmailHtml({
        orderId:       order._id.toString(),
        customerName,
        customerEmail,
        totalAmount:   order.totalAmount,
        itemCount:     order.items.reduce((sum, i) => sum + i.quantity, 0),
        paymentMethod: order.paymentMethod,
      }),
    });

    if (error) console.error('[adminNewOrderEmail] Resend error:', error);
  } catch (err) {
    console.error('[adminNewOrderEmail] Failed:', err);
  }
}