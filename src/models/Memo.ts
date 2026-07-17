import mongoose, { Schema, type Document, type Model, Types } from 'mongoose';

export type MemoStatus =
  | 'pending'
  | 'rejected'
  | 'approved'
  | 'shipped'
  | 'with_customer'
  | 'return_requested'
  | 'return_in_transit'
  | 'returned'
  | 'overdue'
  | 'recalled'
  | 'purchased'
  | 'force_converted'
  | 'lost'
  | 'damaged'
  | 'cancelled';

export type MemoActorRole = 'customer' | 'admin' | 'system';

export interface IMemoShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface IMemoItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  itemStatus: MemoStatus;
}

export interface IMemoEvent {
  status: MemoStatus;
  note?: string;
  actedBy: Types.ObjectId | 'system' | 'cron';
  actedByRole: MemoActorRole;
  at: Date;
}

export interface IMemo extends Document {
  user: Types.ObjectId;
  items: IMemoItem[];
  status: MemoStatus;
  totalValue: number;
  requestedDurationDays: number;
  dueAt: Date;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  rejectedReason?: string | null;
  extensionCount: number;
  shippingAddress: IMemoShippingAddress;

  // Outbound leg (seller -> customer)
  outboundCarrier?: string;
  outboundService?: string;
  outboundRateId?: string;
  outboundTrackingNumber?: string;
  outboundTrackingUrl?: string;
  outboundLabelUrl?: string;
  outboundShippedAt?: Date | null;
  outboundDeliveredAt?: Date | null;

  // Return leg (customer -> seller)
  returnCarrier?: string;
  returnRateId?: string;
  returnTrackingNumber?: string;
  returnTrackingUrl?: string;
  returnLabelUrl?: string;
  returnShippedAt?: Date | null;
  returnReceivedAt?: Date | null;

  // Legal / consent trail
  termsVersion: string;
  termsAcceptedAt: Date;
  termsAcceptedIp: string;
  termsAcceptedUserAgent: string;

  // Conversion
  convertedOrderId?: Types.ObjectId | null;

  // Idempotency guards for reminder emails
  dueSoonNotifiedAt?: Date | null;
  overdueNotifiedAt?: Date | null;
  overdueEscalationLevel: number;
  lastEscalationSentAt?: Date | null;

  // Inventory-release audit — set exactly once, by releaseReservation()
  reservationReleasedAt?: Date | null;

  events: IMemoEvent[];

  createdAt: Date;
  updatedAt: Date;
}

const MemoShippingAddressSchema = new Schema<IMemoShippingAddress>(
  {
    fullName: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const MEMO_STATUS_VALUES: MemoStatus[] = [
  'pending',
  'rejected',
  'approved',
  'shipped',
  'with_customer',
  'return_requested',
  'return_in_transit',
  'returned',
  'overdue',
  'recalled',
  'purchased',
  'force_converted',
  'lost',
  'damaged',
  'cancelled',
];

const MemoItemSchema = new Schema<IMemoItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    image: { type: String },
    itemStatus: { type: String, enum: MEMO_STATUS_VALUES, default: 'pending' },
  },
  { _id: false }
);

const MemoEventSchema = new Schema<IMemoEvent>(
  {
    status: { type: String, enum: MEMO_STATUS_VALUES, required: true },
    note: { type: String },
    actedBy: { type: Schema.Types.Mixed, required: true }, // ObjectId | 'system' | 'cron'
    actedByRole: { type: String, enum: ['customer', 'admin', 'system'], required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const MemoSchema = new Schema<IMemo>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [MemoItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    status: { type: String, enum: MEMO_STATUS_VALUES, default: 'pending', required: true },
    totalValue: { type: Number, required: true, min: 0 },
    requestedDurationDays: { type: Number, required: true, min: 1 },
    dueAt: { type: Date, required: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedReason: { type: String, default: null },
    extensionCount: { type: Number, default: 0 },
    shippingAddress: { type: MemoShippingAddressSchema, required: true },

    outboundCarrier: String,
    outboundService: String,
    outboundRateId: String,
    outboundTrackingNumber: String,
    outboundTrackingUrl: String,
    outboundLabelUrl: String,
    outboundShippedAt: { type: Date, default: null },
    outboundDeliveredAt: { type: Date, default: null },

    returnCarrier: String,
    returnRateId: String,
    returnTrackingNumber: String,
    returnTrackingUrl: String,
    returnLabelUrl: String,
    returnShippedAt: { type: Date, default: null },
    returnReceivedAt: { type: Date, default: null },

    termsVersion: { type: String, required: true },
    termsAcceptedAt: { type: Date, required: true },
    termsAcceptedIp: { type: String, required: true },
    termsAcceptedUserAgent: { type: String, required: true },

    convertedOrderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },

    dueSoonNotifiedAt: { type: Date, default: null },
    overdueNotifiedAt: { type: Date, default: null },
    overdueEscalationLevel: { type: Number, default: 0 },
    lastEscalationSentAt: { type: Date, default: null },

    reservationReleasedAt: { type: Date, default: null },

    events: { type: [MemoEventSchema], default: [] },
  },
  { timestamps: true }
);

MemoSchema.index({ user: 1, createdAt: -1 });
MemoSchema.index({ status: 1 });
MemoSchema.index({ dueAt: 1 });
MemoSchema.index({ 'items.product': 1 });

export const Memo: Model<IMemo> =
  (mongoose.models.Memo as Model<IMemo>) || mongoose.model<IMemo>('Memo', MemoSchema);

export default Memo;
