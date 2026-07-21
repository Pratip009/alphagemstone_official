import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnalyticsSession extends Document {
  sessionId: string;
  visitorId: string;

  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;

  duration: number;

  entryPage?: string;
  exitPage?: string;

  pageViews: number;
  eventCount: number;

  device?: {
    type?: string;
    browser?: string;
    os?: string;
    screenWidth?: number;
    screenHeight?: number;
  };

  referrer?: string;
  landingPage?: string;
}

const AnalyticsSessionSchema = new Schema<IAnalyticsSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    visitorId: {
      type: String,
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    endedAt: Date,

    duration: {
      type: Number,
      default: 0,
    },

    entryPage: String,

    exitPage: String,

    pageViews: {
      type: Number,
      default: 0,
    },

    eventCount: {
      type: Number,
      default: 0,
    },

    device: {
      type: {
        type: String,
      },
      browser: String,
      os: String,
      screenWidth: Number,
      screenHeight: Number,
    },

    referrer: String,

    landingPage: String,
  },
  {
    timestamps: true,
  }
);

const AnalyticsSession: Model<IAnalyticsSession> =
  mongoose.models.AnalyticsSession ||
  mongoose.model<IAnalyticsSession>(
    "AnalyticsSession",
    AnalyticsSessionSchema
  );

export default AnalyticsSession;