import Order, { IOrder, IShippingAddress } from '@/models/Order';
import Cart, { ICart } from '@/models/Cart';
import Product, { IProduct } from '@/models/Product';
import User from '@/models/User';
import { clearCart, calculateCartTotals } from './cart.service';
import { capturePayPalOrder, createPayPalOrder } from './paypal.service';
import { validateCoupon, redeemCoupon } from './coupon.service';
import { purchaseLabelFromRate } from './shipengine.service';
import { Resend } from 'resend';
import { orderConfirmationEmailHtml, orderShippedEmailHtml } from '@/lib/email-templates';

const resend    = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Estimates order weight in LB (0.5 LB per item, max 5 LB). */
function estimateWeightLb(totalItems: number): number {
  return Math.min(totalItems * 0.5, 5);
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
  paymentMethod: 'paypal' | 'cod',
  couponCode?: string,
  shippingSelection?: ShippingSelection
) {
  const cart = await Cart.findOne({ user: userId })
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

  const selectedShippingCost = shippingSelection?.shippingRate ?? shippingCost;
  const finalTotal = Math.max(0, subtotal + tax + selectedShippingCost - couponDiscount);

  const order = new Order({
    user:            userId,
    items,
    shippingAddress,
    subtotal,
    tax,
    shippingCost:    selectedShippingCost,
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
    shippingEstimatedDays:     shippingSelection?.shippingEstimatedDays     ?? null,
    shippingEstimatedDelivery: shippingSelection?.shippingEstimatedDelivery ?? null,
  });

  await order.save();

  if (appliedCouponCode) {
    await redeemCoupon(appliedCouponCode, order._id.toString());
  }

  return order;
}

// ─── PayPal ───────────────────────────────────────────────────────────────────

export async function initiatePayPalPayment(orderId: string) {
  const order = await Order.findById(orderId) as IOrder | null;
  if (!order) throw new Error('Order not found');

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
export async function capturePayment(paypalOrderId: string) {
  const captureData = await capturePayPalOrder(paypalOrderId);
  if (captureData.status !== 'COMPLETED') throw new Error('Payment not completed');

  const order = await Order.findOne({ paypalOrderId }) as IOrder | null;
  if (!order) throw new Error('Order not found');

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

  await clearCart(order.user.toString());

  void sendOrderConfirmationEmail(order);

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

export async function updateOrderStatus(orderId: string, status: string) {
  const validStatuses = [
    'pending', 'paid', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded',
  ];
  if (!validStatuses.includes(status)) throw new Error('Invalid status');

  const order = await Order.findByIdAndUpdate(
    orderId,
    { $set: { status } },
    { new: true }
  )
    .populate('user', 'name email')
    .lean() as (IOrder & { user: { name: string; email: string } }) | null;

  if (order && status === 'shipped') {
    void sendOrderShippedEmail(order);
  }

  return order;
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

  await Order.findByIdAndUpdate(orderId, {
    $set: {
      labelId:        label.labelId,
      labelUrl:       label.labelUrl,
      trackingNumber: label.trackingNumber,
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