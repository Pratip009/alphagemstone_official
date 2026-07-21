import mongoose, { Schema, Document, Model } from "mongoose";

export type AnalyticsEventType =
  // Phase 1
  | "page_view"
  | "session_start"
  | "session_end"
  | "heartbeat"
  // Phase 2
  | "click"
  | "cta_click"
  | "product_view"
  | "search"
  | "filter_apply"
  // Phase 3
  | "product_impression"      // product shown in a list/grid (for funnel: impression -> view -> cart)
  // Phase 4
  | "add_to_cart"
  | "remove_from_cart"
  | "cart_view"
  | "checkout_start"
  | "checkout_step"
  | "purchase";

export interface IAnalyticsEvent extends Document {
  sessionId: string;
  visitorId: string;
  userId?: string; // set once a visitor logs in — links anonymous + known activity

  eventType: AnalyticsEventType;

  page?: string;
  pageTitle?: string;

  // click / CTA
  element?: string;
  elementText?: string;
  ctaId?: string;

  // product
  productId?: string;
  productName?: string;
  productCategory?: string;
  productPrice?: number;

  // search / filter
  searchQuery?: string;
  searchResultsCount?: number;
  filterType?: string;   // e.g. "shape", "color", "price_range"
  filterValue?: string;

  // cart / checkout / revenue
  orderId?: string;
  quantity?: number;
  value?: number;        // monetary value of the event (cart total, order total, item price)
  currency?: string;
  checkoutStep?: string; // "shipping" | "payment" | "review"

  // acquisition (Phase 5)
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    sessionId: { type: String, required: true, index: true },
    visitorId: { type: String, required: true, index: true },
    userId: { type: String, index: true },

    eventType: { type: String, required: true, index: true },

    page: { type: String, index: true },
    pageTitle: String,

    element: String,
    elementText: String,
    ctaId: { type: String, index: true },

    productId: { type: String, index: true },
    productName: String,
    productCategory: { type: String, index: true },
    productPrice: Number,

    searchQuery: { type: String, index: true },
    searchResultsCount: Number,
    filterType: String,
    filterValue: String,

    orderId: { type: String, index: true },
    quantity: Number,
    value: Number,
    currency: { type: String, default: "USD" },
    checkoutStep: String,

    utmSource: String,
    utmMedium: String,
    utmCampaign: String,

    metadata: { type: Schema.Types.Mixed, default: {} },

    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Compound indexes for the aggregations you'll actually run later
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ productId: 1, eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ visitorId: 1, timestamp: -1 });

// Keep raw events 2 years, roll up into daily aggregates before that (see Phase 3 note below)
AnalyticsEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 }
);

const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema);

export default AnalyticsEvent;