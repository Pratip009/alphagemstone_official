import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export interface ICart extends Document {
  _id: mongoose.Types.ObjectId;
  // Exactly one of user/guestId is set — see the pre-validate check below.
  user?: mongoose.Types.ObjectId;
  guestId?: string;
  items: ICartItem[];
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    // sparse+unique so many docs can have user: undefined (guest carts)
    // without tripping the unique index — same for guestId below.
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    guestId: { type: String, unique: true, sparse: true },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

CartSchema.pre('validate', function (next) {
  if (!this.user && !this.guestId) {
    next(new Error('Cart requires either a user or a guestId'));
  } else {
    next();
  }
});


const Cart = (() => {
  if (mongoose.models && mongoose.models.Cart) {
    return mongoose.models.Cart as mongoose.Model<ICart>;
  }
  return mongoose.model<ICart>('Cart', CartSchema);
})();

export default Cart;