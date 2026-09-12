import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export type DropshipApplicationStatus = "pending" | "approved" | "rejected";

export const DROPSHIP_SELLING_CHANNELS = [
  "Own Website / Online Store",
  "eBay",
  "Etsy",
  "Amazon",
  "Walmart Marketplace",
  "Facebook / Instagram",
  "Google Shopping",
  "Other",
] as const;

export interface IDropshipApplication extends Document {
  fullName: string;
  businessName?: string;
  email: string;
  phone?: string;
  website?: string;
  sellingChannels: string[];
  message?: string;
  status: DropshipApplicationStatus;
  // Lets Balu instantly cut off a seller's portal access (fraud, dispute,
  // no longer participating, etc.) without deleting their history. Checked
  // on every portal load and every order/payment action.
  active: boolean;
  portalToken: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DropshipApplicationSchema = new Schema<IDropshipApplication>(
  {
    fullName: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    sellingChannels: { type: [String], default: [] },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    active: { type: Boolean, default: true },
    // Unique, unguessable token — doubles as the seller's no-login access
    // key to their dropship portal once approved. Generated up-front (not
    // only on approval) so we never need a second write just to add it.
    // 24 random bytes (192 bits) as hex — this is the seller's entire
    // credential, so it must never be guessable or enumerable.
    portalToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

DropshipApplicationSchema.index({ status: 1, createdAt: -1 });
DropshipApplicationSchema.index({ email: 1 });

export default mongoose.models.DropshipApplication ||
  mongoose.model<IDropshipApplication>(
    "DropshipApplication",
    DropshipApplicationSchema
  );
