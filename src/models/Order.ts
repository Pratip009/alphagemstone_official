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
  // ─── ShipEngine shipping selection (stored at checkout) ───────────────────
  shippingCarrier?: string | null;          // e.g. "UPS", "USPS", "FedEx"
  shippingService?: string | null;          // e.g. "UPS Ground", "Priority Mail"
  shippingServiceCode?: string | null;      // ShipEngine service code
  shippingRateId?: string | null;           // ShipEngine rate ID — used to purchase label
  shippingRate?: number;                    // quoted cost in USD
  shippingEstimatedDays?: number | null;
  shippingEstimatedDelivery?: string | null;
  // ─── Post-purchase label info (set after label is bought) ─────────────────
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  labelId?: string | null;                 
  labelUrl?: string | null;                
  shippedAt?: Date | null;
  deliveredAt?: Date | null;                
  deliveryNotifiedAt?: Date | null;
  // ─── Coupon ───────────────────────────────────────────────────────────────
  appliedCouponCode?: string | null;
  couponDiscount?: number;
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
    // ─── ShipEngine shipping ──────────────────────────────────────────────────
    shippingCarrier:           { type: String, default: null },
    shippingService:           { type: String, default: null },
    shippingServiceCode:       { type: String, default: null },
    shippingRateId:            { type: String, default: null },
    shippingRate:              { type: Number, default: 0 },
    shippingEstimatedDays:     { type: Number, default: null },
    shippingEstimatedDelivery: { type: String, default: null },
    trackingNumber:            { type: String, default: null, index: true },
    trackingUrl:               { type: String, default: null },
    labelId:                   { type: String, default: null },
    labelUrl:                  { type: String, default: null },
    shippedAt:                 { type: Date, default: null },
    deliveredAt:               { type: Date, default: null },
    deliveryNotifiedAt:        { type: Date, default: null },
    // ─── Coupon ───────────────────────────────────────────────────────────────
    appliedCouponCode: { type: String, default: null },
    couponDiscount:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paypalOrderId: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ trackingNumber: 1 });

const Order = (() => {
  if (mongoose.models && mongoose.models.Order) {
    return mongoose.models.Order as mongoose.Model<IOrder>;
  }
  return mongoose.model<IOrder>('Order', OrderSchema);
})();

export default Order;