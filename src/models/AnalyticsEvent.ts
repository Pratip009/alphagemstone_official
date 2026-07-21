import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnalyticsEvent extends Document {
  sessionId: string;
  visitorId: string;

  eventType:
    | "page_view"
    | "click"
    | "session_start"
    | "session_end"
    | "heartbeat";

  page?: string;
  pageTitle?: string;

  element?: string;
  elementText?: string;

  productId?: string;
  productName?: string;

  metadata?: Record<string, unknown>;

  timestamp: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },

    visitorId: {
      type: String,
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      index: true,
    },

    page: {
      type: String,
      index: true,
    },

    pageTitle: String,

    element: String,

    elementText: String,

    productId: {
      type: String,
      index: true,
    },

    productName: String,

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically delete very old raw events after 2 years
AnalyticsEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 }
);

const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema);

export default AnalyticsEvent;