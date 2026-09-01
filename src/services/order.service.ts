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

/**
 * Atomically reserves (decrements) stock for a set of order items, honoring
 * availableStock (stock - reservedForMemo) rather than raw stock — a unit
 * that's out on memo with a trade customer must not be sellable online.
 *
 * Each item is reserved with a single conditional update, so two concurrent
 * checkouts racing for the last unit can't both succeed. If any item can't
 * be reserved, everything reserved so far in this call is rolled back before
 * throwing, so a failed order never leaves partial stock held.
 */
async function reserveStockForItems(
  items: Array<{ product: unknown; name: string; quantity: number }>
): Promise<void> {
  const reserved: Array<{ productId: unknown; quantity: number }> = [];
  try {
    for (const item of items) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.product,
          // availableStock = stock - reservedForMemo; only reserve if enough
          // is actually free to sell (not committed to a trade customer).
          $expr: {
            $gte: [
              { $subtract: ['$stock', { $ifNull: ['$reservedForMemo', 0] }] },
              item.quantity,
            ],
          },
        },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
      reserved.push({ productId: item.product, quantity: item.quantity });
    }
  } catch (err) {
    // Roll back whatever was already reserved in this call.
    for (const r of reserved) {
      await Product.findByIdAndUpdate(r.productId, { $inc: { stock: r.quantity } }).catch(() => {});
    }
    throw err;
  }
}

/** Restores stock previously reserved by reserveStockForItems for an order's items. */
async function releaseStockForItems(
  items: Array<{ product: unknown; quantity: number }>
): Promise<void> {
  for (const item of items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }).catch(() => {});
  }
}

/**
 * Cancels a pending, unpaid order and releases any stock it was holding.
 * Safe to call more than once — checks stockReserved before touching stock,
 * and does nothing if the order is already cancelled.
 * Refuses to cancel an order that has actually been paid for.
 */
async function cancelOrderAndReleaseStock(order: IOrder): Promise<void> {
  if (order.status === 'cancelled') return;
  if (order.paymentStatus === 'completed') {
    throw new Error('Cannot cancel an order that has already been paid.');
  }
  if (order.stockReserved) {
    await releaseStockForItems(order.items);
  }
  order.status = 'cancelled';
  order.stockReserved = false;
  await order.save();
}

// ─── Order creation ───────────────────────────────────────────────────────────

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
  userId: string,
  shippingAddress: IShippingAddress,
  paymentMethod: 'paypal',
  couponCode?: string,
  shippingSelection?: ShippingSelection
) {
  // Raw (unpopulated) cart — keeps the actual stored product ids around even
  // for items whose product no longer exists, so we can self-heal the cart
  // the same way getCart() does, instead of crashing on a null reference.
  const cart = await Cart.findOne({ user: userId }).lean() as ICart | null;
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  const items = [];
  const orphanedProductIds: unknown[] = [];

  for (const item of cart.items as unknown as Array<{ product: unknown; quantity: number }>) {
    const product = await Product.findOne({
      _id: item.product,
      isActive: true,
    }) as IProduct | null;

    if (!product) {
      // Referenced product was deleted/deactivated since it was added to
      // the cart — drop it instead of crashing checkout.
      orphanedProductIds.push(item.product);
      continue;
    }

    // Purchasability must be judged on availableStock (stock minus units
    // out on memo), not raw stock.
    const availableStock = Math.max(0, product.stock - (product.reservedForMemo || 0));
    if (availableStock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    items.push({
      product:  product._id,
      name:     product.name,
      price:    product.price,
      quantity: item.quantity,
      image:    product.images[0],
    });
  }

  if (orphanedProductIds.length > 0) {
    await Cart.updateOne(
      { user: userId },
      { $pull: { items: { product: { $in: orphanedProductIds } } } }
    ).catch(() => {});
  }

  if (items.length === 0) {
    throw new Error(
      'Some items in your cart are no longer available and were removed. Please review your cart and try again.'
    );
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

  // Reserve stock up front, before the order even exists, so two concurrent
  // checkouts can't both succeed on the last unit of a one-of-a-kind piece.
  // Rolled back automatically below if anything after this fails.
  await reserveStockForItems(items);

  try {
    const order = new Order({
      user:            userId,
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
      stockReserved:   true,
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
  } catch (err) {
    // Order row failed to save (validation error, DB hiccup, etc.) — release
    // the stock we just reserved instead of leaving it stuck.
    await releaseStockForItems(items);
    throw err;
  }
}

/**
 * Cancels the caller's own order. Only allowed while it's still pending and
 * unpaid — this exists so the checkout UI can clean up an abandoned order
 * (e.g. the customer went back to change their shipping method and is about
 * to create a fresh one) without leaving stock reserved against it forever.
 */
export async function cancelOwnPendingOrder(orderId: string, userId: string) {
  const order = await Order.findById(orderId) as IOrder | null;
  if (!order) throw new Error('Order not found');
  if (order.user.toString() !== userId) throw new Error('Order not found');
  await cancelOrderAndReleaseStock(order);
  return order;
}

/**
 * Cancels pending orders that were created but never paid for within
 * `maxAgeMinutes`, releasing their reserved stock. Intended to run on a
 * schedule (see /api/cron/release-stale-orders) as the backstop for
 * abandoned checkouts — e.g. someone who closes the tab on the payment step
 * rather than clicking Back (which cancels immediately via
 * cancelOwnPendingOrder above).
 */
export async function releaseExpiredPendingOrders(maxAgeMinutes = 30) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const staleOrders = await Order.find({
    status: 'pending',
    paymentStatus: { $ne: 'completed' },
    stockReserved: true,
    createdAt: { $lt: cutoff },
  }) as IOrder[];

  let released = 0;
  for (const order of staleOrders) {
    try {
      await cancelOrderAndReleaseStock(order);
      released++;
    } catch (err) {
      console.error(`[releaseExpiredPendingOrders] Failed to release order ${order._id}:`, err);
    }
  }
  return released;
}

// ─── PayPal ───────────────────────────────────────────────────────────────────

export async function initiatePayPalPayment(
  orderId: string,
  userId?: string,
  { skipOwnerCheck = false }: { skipOwnerCheck?: boolean } = {}
) {
  const order = await Order.findById(orderId) as IOrder | null;
  if (!order) throw new Error('Order not found');

  // IDOR guard: only the order's owner (or an explicit admin/webhook caller
  // that passes skipOwnerCheck) may initiate payment on this order.
  if (!skipOwnerCheck) {
    if (!userId) throw new Error('Unauthorized');
    if (order.user.toString() !== userId) throw new Error('Order not found');
  }

  // Don't let a customer (accidentally, via a stale tab, or after a false
  // "payment failed" message) start a fresh PayPal payment on an order
  // that's already been paid or cancelled — that's exactly the situation
  // that leads to a real double charge.
  if (order.paymentStatus === 'completed') {
    throw new Error('This order has already been paid.');
  }
  if (order.status === 'cancelled') {
    throw new Error('This order was cancelled and can no longer be paid.');
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
  userId?: string,
  { skipOwnerCheck = false }: { skipOwnerCheck?: boolean } = {}
) {
  const order = await Order.findOne({ paypalOrderId }) as IOrder | null;
  if (!order) throw new Error('Order not found');

  // IDOR guard: only the order's owner (or an explicit admin/webhook caller
  // that passes skipOwnerCheck) may capture payment on this order. Checked
  // before calling PayPal so a guessed paypalOrderId can't trigger a real
  // capture, stock decrement, cart clear, or confirmation email for someone
  // else's order.
  if (!skipOwnerCheck) {
    if (!userId) throw new Error('Unauthorized');
    if (order.user.toString() !== userId) throw new Error('Order not found');
  }

  // Idempotency guard: if this order was already captured (e.g. the
  // customer's first capture request actually succeeded but the response
  // was lost, and they retried), don't call PayPal or touch stock again —
  // just hand back the already-completed order.
  if (order.paymentStatus === 'completed') {
    return Order.findById(order._id).lean();
  }

  const captureData = await capturePayPalOrder(paypalOrderId);
  if (captureData.status !== 'COMPLETED') throw new Error('Payment not completed');

  // Stock for these items was already reserved (decremented) when the order
  // was created — do NOT decrement again here, that would double-count.
  order.status          = 'paid';
  order.paymentStatus   = 'completed';
  order.paypalPaymentId =
    captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

  // PayPal has now actually taken the customer's money. If saving that fact
  // to our own DB fails, we must NOT let the caller surface a generic error
  // that invites the customer to "try again" — that risks a real second
  // charge for an order our system already collected payment on. Retry a
  // couple of times, and if it still fails, fail loudly to logs/admin email
  // instead, with a message that explicitly tells the customer not to repay.
  let saved = false;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3 && !saved; attempt++) {
    try {
      await order.save();
      saved = true;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  if (!saved) {
    console.error(
      `[CRITICAL] PayPal payment ${paypalOrderId} was captured but order ${order._id} ` +
      `could not be marked paid after retries. Needs manual reconciliation.`,
      lastErr
    );
    void sendPaymentReconciliationAlert(order, paypalOrderId, lastErr);
    throw new Error(
      'Your payment went through, but we hit a problem finalizing your order. ' +
      'Please do NOT pay again — contact support with your order reference ' +
      `${order._id.toString().slice(-8).toUpperCase()} and we\'ll sort it out.`
    );
  }

  await clearCart(order.user.toString());

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

export async function getOrderById(orderId: string, userId?: string) {
  const query: Record<string, unknown> = { _id: orderId };
  if (userId) query.user = userId;
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
export async function getOrderTracking(orderId: string, userId?: string) {
  const query: Record<string, unknown> = { _id: orderId };
  if (userId) query.user = userId;

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

  // Cancelling or refunding puts the item(s) back in sellable inventory —
  // release the stock this order was holding (once, guarded by
  // stockReserved so re-running this on an already-released order is a
  // no-op instead of over-crediting stock).
  if (status === 'cancelled' || status === 'refunded') {
    const current = await Order.findById(orderId) as IOrder | null;
    if (current && current.stockReserved) {
      await releaseStockForItems(current.items);
      current.stockReserved = false;
      await current.save();
    }
  }

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
    .lean() as (IOrder & { user: { name: string; email: string } }) | null;

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
    .lean() as (IOrder & { user: { name: string; email: string } }) | null;
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
    .lean() as (IOrder & { user: { name: string; email: string } }) | null;

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
    .lean() as (IOrder & { user: { name: string; email: string } }) | null;
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
    } as IOrder & { user: { name: string; email: string } };
    void sendOrderShippedEmail(updatedOrder);
  }

  return Order.findById(orderId).lean();
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function sendOrderConfirmationEmail(order: IOrder): Promise<void> {
  try {
    const user = await User.findById(order.user)
      .select('name email')
      .lean() as { name: string; email: string } | null;
    if (!user) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      user.email,
      subject: `Order Confirmed — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    orderConfirmationEmailHtml({
        orderId:         order._id.toString(),
        customerName:    user.name,
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
  order: IOrder & { user: { name: string; email: string } }
): Promise<void> {
  try {
    if (!order.trackingNumber) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      order.user.email,
      subject: `Your Order Has Shipped — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    orderShippedEmailHtml({
        orderId:           order._id.toString(),
        customerName:      order.user.name,
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
  order: IOrder & { user: { name: string; email: string } }
): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      order.user.email,
      subject: `Your Order Has Been Delivered — #${order._id.toString().slice(-8).toUpperCase()}`,
      html:    orderDeliveredEmailHtml({
        orderId:        order._id.toString(),
        customerName:   order.user.name,
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
    const user = await User.findById(order.user)
      .select('name email')
      .lean() as { name: string; email: string } | null;
    if (!user) return;

    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      ADMIN_NOTIFICATION_EMAILS,
      subject: `New Order — #${order._id.toString().slice(-8).toUpperCase()} ($${order.totalAmount.toFixed(2)})`,
      html:    adminNewOrderEmailHtml({
        orderId:       order._id.toString(),
        customerName:  user.name,
        customerEmail: user.email,
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

/**
 * Fires when PayPal has captured a customer's payment but we failed to save
 * that onto the order after retries — a state that needs a human to look at
 * immediately, since the customer has been charged but our system doesn't
 * reflect it yet. Best-effort: never throws, since it's already firing from
 * inside a failure path.
 */
async function sendPaymentReconciliationAlert(
  order: IOrder,
  paypalOrderId: string,
  err: unknown
): Promise<void> {
  if (ADMIN_NOTIFICATION_EMAILS.length === 0) return;
  try {
    const errMessage = err instanceof Error ? err.message : String(err);
    const { error } = await resend.emails.send({
      from:    EMAIL_FROM,
      to:      ADMIN_NOTIFICATION_EMAILS,
      subject: `⚠️ URGENT: Payment captured but order not saved — #${order._id.toString().slice(-8).toUpperCase()}`,
      html: `
        <p>PayPal successfully captured payment for order <strong>${order._id.toString()}</strong>
        (PayPal order ${paypalOrderId}, amount $${order.totalAmount.toFixed(2)}), but our system
        failed to record the order as paid after 3 retries.</p>
        <p><strong>The customer HAS been charged.</strong> Please verify in the PayPal dashboard
        and manually mark this order as paid in the admin panel.</p>
        <p>Underlying error: <code>${errMessage}</code></p>
      `,
    });
    if (error) console.error('[paymentReconciliationAlert] Resend error:', error);
  } catch (alertErr) {
    console.error('[paymentReconciliationAlert] Failed to send alert itself:', alertErr);
  }
}