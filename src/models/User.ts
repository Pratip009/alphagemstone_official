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
// Memo is not something every customer gets by default — shipping a loose
// one-of-a-kind stone to an unverified buyer on trust is how the business
// loses money. This is a lightweight KYC/trade-vetting layer gating access
// to the memo feature (see src/services/memo.service.ts).
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

  // ── Memo trade-vetting fields ──────────────────────────────────────────
  // Gates whether this user may request a memo at all (see
  // POST /api/memos, which rejects unless memoStatus === 'approved').
  memoStatus: MemoUserStatus;
  // Max total retail value this user may hold on memo at once, summed
  // across all their outstanding (non-terminal) memos. Set by an admin at
  // approval time — see PUT /api/admin/memo-eligibility/[userId].
  memoCreditLimit: number;
  // Collected at application time (POST /api/memo-eligibility/apply).
  memoBusinessName?: string;
  memoResaleCertNumber?: string;
  memoReferences?: string;
  memoApprovedAt?: Date | null;
  memoApprovedBy?: mongoose.Types.ObjectId | null;
  // Set when an admin suspends memo privileges — e.g. after a force-convert
  // on a non-returned item. Cleared on re-approval.
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
      unique: true,
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
    // Cloudinary secure_url for the current avatar. Safe to expose to the client.
    avatarUrl: {
      type: String,
      default: '',
    },
    // Cloudinary public_id for the current avatar — kept off the wire (select: false)
    // so it never leaks to the client; only used server-side to delete the old
    // asset when the avatar is replaced or removed.
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

    // ── Memo trade-vetting fields ────────────────────────────────────────
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

const User = (() => {
  if (mongoose.models && mongoose.models.User) {
    return mongoose.models.User as mongoose.Model<IUser>;
  }
  return mongoose.model<IUser>('User', UserSchema);
})();

export default User;