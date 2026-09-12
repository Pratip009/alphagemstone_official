import mongoose, { Schema, Document, Types } from "mongoose";

export type DropshipOrderStatus =
  | "pending_payment"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type DropshipPaymentStatus = "pending" | "completed" | "failed";

export interface IDropshipOrder extends Document {
  application: Types.ObjectId;
  sellerBusinessName?: string;
  sellerEmail: string;

  // What the seller is ordering — always a real catalog product, so the
  // price charged is never something the seller (or a tampered request)
  // can supply. Name/image/price are snapshotted at order time so the
  // order stays accurate even if the catalog listing changes later.
  product: Types.ObjectId;
  productName: string;
  productImage?: string;
  unitPrice: number;
  quantity: number;
  amount: number; // unitPrice * quantity — what the seller pays Alpha
  specifications?: string; // free-text note only (carat/color prefs etc.) — never affects price

  // Where Alpha ships it — the seller's end customer
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;

  shippingMethod?: string;
  specialInstructions?: string;

  status: DropshipOrderStatus;
  paymentStatus: DropshipPaymentStatus;
  paypalOrderId?: string;
  paypalPaymentId?: string;
  // Whether this order is currently holding reserved stock (decremented at
  // submission time, before payment) — mirrors Order.stockReserved so an
  // abandoned/cancelled unpaid order can safely release its hold exactly
  // once, never double-crediting stock back.
  stockReserved: boolean;

  trackingNumber?: string;
  trackingUrl?: string;
  adminNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const DropshipOrderSchema = new Schema<IDropshipOrder>(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: "DropshipApplication",
      required: true,
      index: true,
    },
    sellerBusinessName: { type: String, trim: true },
    sellerEmail: { type: String, required: true, trim: true, lowercase: true },

    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    productImage: { type: String, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    amount: { type: Number, required: true, min: 0 },
    specifications: { type: String, trim: true },

    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerPhone: { type: String, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "United States" },

    shippingMethod: { type: String, trim: true },
    specialInstructions: { type: String, trim: true },

    // Orders start life unable to be fulfilled until payment completes —
    // adminUpdateOrder (service layer) enforces that processing/shipped/
    // delivered can never be set while paymentStatus !== 'completed'.
    status: {
      type: String,
      enum: ["pending_payment", "processing", "shipped", "delivered", "cancelled"],
      default: "pending_payment",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paypalOrderId: { type: String, trim: true },
    paypalPaymentId: { type: String, trim: true },
    stockReserved: { type: Boolean, default: false },

    trackingNumber: { type: String, trim: true },
    trackingUrl: { type: String, trim: true },
    adminNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

DropshipOrderSchema.index({ status: 1, createdAt: -1 });
DropshipOrderSchema.index({ application: 1, createdAt: -1 });
DropshipOrderSchema.index({ paypalOrderId: 1 });

export default mongoose.models.DropshipOrder ||
  mongoose.model<IDropshipOrder>("DropshipOrder", DropshipOrderSchema);
