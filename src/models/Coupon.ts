import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  code: string;
  discountPercent: number;  // percentage off subtotal (e.g. 10 = 10%)
  minPurchase: number;      // minimum subtotal to use
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
  usedByOrderId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    email:           { type: String, required: true, lowercase: true, trim: true, index: true },
    code:            { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, default: 10 },
    minPurchase:     { type: Number, required: true, default: 200 },
    expiresAt:       { type: Date, required: true },
    isUsed:          { type: Boolean, default: false },
    usedAt:          { type: Date, default: null },
    usedByOrderId:   { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

CouponSchema.index({ email: 1, isUsed: 1 });
CouponSchema.index({ expiresAt: 1 });

const Coupon = (() => {
  if (mongoose.models && mongoose.models.Coupon) {
    return mongoose.models.Coupon as mongoose.Model<ICoupon>;
  }
  return mongoose.model<ICoupon>('Coupon', CouponSchema);
})();

export default Coupon;