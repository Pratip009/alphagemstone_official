import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// ─── Memo trade-vetting status ─────────────────────────────────────────────────
export const MEMO_USER_STATUSES = ['none', 'pending', 'approved', 'suspended'] as const;
export type MemoUserStatus = (typeof MEMO_USER_STATUSES)[number];

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  address?: IUserAddress;
  role: 'admin' | 'user';

  memoStatus: MemoUserStatus;
  memoCreditLimit: number;
  memoBusinessName?: string;
  memoResaleCertNumber?: string;
  memoReferences?: string;
  memoApprovedAt?: Date | null;
  memoApprovedBy?: mongoose.Types.ObjectId | null;
  memoSuspendedReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema<IUserAddress>(
  {
    line1: { type: String, trim: true, maxlength: 200, default: '' },
    line2: { type: String, trim: true, maxlength: 200, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 100, default: '' },
    postalCode: { type: String, trim: true, maxlength: 20, default: '' },
    country: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      // NOTE: uniqueness is enforced by the explicit collated index below
      // (`email_unique_ci`), not by `unique: true` here — a second,
      // case-sensitive unique index on the same field would let
      // "user@x.com" and "User@x.com" coexist as two separate accounts.
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number is too long'],
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    avatarPublicId: {
      type: String,
      default: '',
      select: false,
    },
    address: {
      type: AddressSchema,
      default: () => ({}),
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },

    memoStatus: {
      type: String,
      enum: { values: MEMO_USER_STATUSES, message: 'Invalid memoStatus: {VALUE}' },
      default: 'none',
    },
    memoCreditLimit: {
      type: Number,
      default: 0,
      min: [0, 'memoCreditLimit cannot be negative'],
    },
    memoBusinessName: {
      type: String,
      trim: true,
      maxlength: [200, 'memoBusinessName cannot exceed 200 characters'],
    },
    memoResaleCertNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'memoResaleCertNumber cannot exceed 100 characters'],
    },
    memoReferences: {
      type: String,
      trim: true,
      maxlength: [1000, 'memoReferences cannot exceed 1000 characters'],
    },
    memoApprovedAt: {
      type: Date,
      default: null,
    },
    memoApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    memoSuspendedReason: {
      type: String,
      trim: true,
      maxlength: [500, 'memoSuspendedReason cannot exceed 500 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        delete (ret as Record<string, unknown>).password;
        delete (ret as Record<string, unknown>).avatarPublicId;
        return ret;
      },
    },
  }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.index({ role: 1 });
UserSchema.index({ memoStatus: 1 });

// Case-insensitive unique index on email. The schema already lowercases
// email before save, but a case-sensitive unique index (the default) can
// diverge from that if any document was ever inserted a different way
// (a migration script, `insertOne` bypassing the schema, manual DB edit,
// etc.) — that divergence is exactly the kind of thing that produces
// "this email is already registered" for an email that looks new, or the
// reverse. Explicit unique index kept in sync with the collation used by
// every lookup query in auth.service.ts / otp.service.ts.
UserSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 }, name: 'email_unique_ci' }
);

const User = (() => {
  if (mongoose.models && mongoose.models.User) {
    return mongoose.models.User as mongoose.Model<IUser>;
  }
  return mongoose.model<IUser>('User', UserSchema);
})();

export default User;