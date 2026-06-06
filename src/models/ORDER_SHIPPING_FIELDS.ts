/**
 * Order model — shipping fields to add
 *
 * Add these fields to your existing Order Mongoose schema in src/models/Order.ts
 * Copy the fields below into your OrderSchema definition.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * STEP 1: In src/models/Order.ts, add these fields to the schema:
 * ──────────────────────────────────────────────────────────────────────────────
 */

// Paste these inside your existing OrderSchema({...}) object:
export const SHIPPING_FIELDS_TO_ADD = `
  // ── Shipping carrier selection ────────────────────────────────────────────
  shippingCarrier: {
    type: String,
    enum: ["FedEx", "USPS", "UPS"],
    default: null,
  },
  shippingService: {
    type: String,
    default: null,              // e.g. "Priority Mail", "UPS Ground", "FedEx 2Day"
  },
  shippingServiceCode: {
    type: String,
    default: null,              // carrier internal code
  },
  shippingRate: {
    type: Number,
    default: 0,                 // quoted shipping cost in USD
  },
  shippingEstimatedDays: {
    type: Number,
    default: null,
  },
  shippingEstimatedDelivery: {
    type: String,
    default: null,
  },
  trackingNumber: {
    type: String,
    default: null,
    index: true,               // allow fast lookup by tracking number
  },
  trackingUrl: {
    type: String,
    default: null,
  },
  shippedAt: {
    type: Date,
    default: null,
  },
`;

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * STEP 2: Update your POST /api/orders handler (src/services/order.service.ts)
 * to accept these fields from the request body:
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * In createOrder(), destructure and save:
 *
 *   const {
 *     shippingAddress,
 *     paymentMethod,
 *     shippingCarrier,    // ← new
 *     shippingService,    // ← new
 *     shippingServiceCode,
 *     shippingRate,
 *     shippingEstimatedDays,
 *     shippingEstimatedDelivery,
 *   } = orderData;
 *
 *   const order = await Order.create({
 *     user: userId,
 *     items: cartItems,
 *     shippingAddress,
 *     paymentMethod,
 *     shippingCarrier,
 *     shippingService,
 *     shippingServiceCode,
 *     shippingRate: shippingRate ?? 0,
 *     shippingEstimatedDays,
 *     shippingEstimatedDelivery,
 *     subtotal,
 *     total: subtotal + (shippingRate ?? 0),   // ← add shipping to total
 *   });
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * STEP 3: Admin can set trackingNumber via PUT /api/admin/orders/:id
 * Add to your admin order update handler:
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   const { status, trackingNumber, trackingUrl, shippedAt } = body;
 *   const updates: any = {};
 *   if (status)        updates.status = status;
 *   if (trackingNumber) {
 *     updates.trackingNumber = trackingNumber;
 *     updates.trackingUrl    = trackingUrl ?? buildTrackingUrl(shippingCarrier, trackingNumber);
 *     updates.shippedAt      = shippedAt ?? new Date();
 *     if (status === "shipped") updates.status = "shipped";
 *   }
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Tracking URL builder helper (put in src/lib/shipping-urls.ts):
 * ──────────────────────────────────────────────────────────────────────────────
 */

export function buildTrackingUrl(carrier: string | null, trackingNumber: string): string | null {
  if (!carrier || !trackingNumber) return null;
  switch (carrier.toLowerCase()) {
    case "ups":
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    default:
      return null;
  }
}
