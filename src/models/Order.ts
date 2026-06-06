import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface IShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

// ─── FedEx shipment data (label generation) ───────────────────────────────────
export interface IFedExShipment {
  trackingNumber: string;
  labelBase64: string;
  labelFormat: string;
  shipmentId: string;
  serviceType: string;
  estimatedDelivery?: string;
  createdAt: Date;
}

// ─── Multi-carrier shipping fields ───────────────────────────────────────────
export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  subtotal: number;
  shippingCost: number;
  tax: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  paymentMethod: 'paypal' | 'cod';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paypalOrderId?: string;
  paypalPaymentId?: string;
  paypalPayerId?: string;
  notes?: string;
  // ─── FedEx label (legacy — kept for existing shipped orders) ──────────────
  fedex?: IFedExShipment;
  // ─── Multi-carrier shipping (new) ─────────────────────────────────────────
  shippingCarrier?: 'FedEx' | 'USPS' | 'UPS' | null;
  shippingService?: string | null;        // e.g. "Priority Mail", "UPS Ground"
  shippingServiceCode?: string | null;    // carrier internal code
  shippingRate?: number;                  // quoted shipping cost in USD
  shippingEstimatedDays?: number | null;
  shippingEstimatedDelivery?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shippedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: String,
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: String,
  },
  { _id: false }
);

// ─── FedEx sub-schema (legacy label storage) ──────────────────────────────────
const FedExShipmentSchema = new Schema<IFedExShipment>(
  {
    trackingNumber: { type: String, required: true },
    labelBase64: { type: String, required: true },
    labelFormat: { type: String, default: 'PDF' },
    shipmentId: { type: String, required: true },
    serviceType: { type: String, required: true },
    estimatedDelivery: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [OrderItemSchema], required: true },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['paypal', 'cod'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paypalOrderId: String,
    paypalPaymentId: String,
    paypalPayerId: String,
    notes: String,
    // ─── FedEx label (legacy) ────────────────────────────────────────────────
    fedex: { type: FedExShipmentSchema, default: undefined },
    // ─── Multi-carrier shipping ───────────────────────────────────────────────
    shippingCarrier: {
      type: String,
      enum: ['FedEx', 'USPS', 'UPS', null],
      default: null,
    },
    shippingService: { type: String, default: null },
    shippingServiceCode: { type: String, default: null },
    shippingRate: { type: Number, default: 0 },
    shippingEstimatedDays: { type: Number, default: null },
    shippingEstimatedDelivery: { type: String, default: null },
    trackingNumber: { type: String, default: null, index: true },
    trackingUrl: { type: String, default: null },
    shippedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paypalOrderId: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'fedex.trackingNumber': 1 });   // legacy
OrderSchema.index({ trackingNumber: 1 });            // multi-carrier

const Order = (() => {
  if (mongoose.models && mongoose.models.Order) {
    return mongoose.models.Order as mongoose.Model<IOrder>;
  }
  return mongoose.model<IOrder>('Order', OrderSchema);
})();

export default Order;