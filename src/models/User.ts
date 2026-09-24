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

// ─── Sign-in methods ───────────────────────────────────────────────────────────
// 'password' = email + password (the OTP-verified signup flow)
// 'google'   = Sign in with Google (OpenID Connect)
// A user can have one or both. Documents created before this field existed
// have no `authProviders` at all — treat that as ['password'] (see
// resolveAuthProviders in auth.service.ts), because a password used to be
// mandatory for every account.
export const AUTH_PROVIDERS = ['password', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  /** Absent for Google-only accounts. `select: false` — never loaded by default. */
  password?: string;
  /** Google's stable account id (`sub` claim). `select: false`. */
  googleId?: string;
  authProviders: AuthProvider[];
  /**
   * true  → ownership of `email` was proven (signup OTP, Google, password reset OTP)
   * false → account was created without proving it (legacy /api/auth/signup)
   * undefined → pre-existing document; treated as verified
   */
  emailVerified?: boolean;
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

// bcrypt hash of a random string; only used for constant-time comparisons.
const DUMMY_HASH = '$2a$12$5egyYS79oVdokszJojztd./P3FXzUs2ZB6bt6y76NbY7q8BaPpVvC';

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
      // Google-only accounts have no password. Every other account must.
      required: [
        function (this: IUser) {
          return !this.googleId;
        },
        'Password is required',
      ],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    googleId: {
      type: String,
      trim: true,
      select: false,
      // No default: the partial unique index below only covers documents
      // where the field actually exists.
    },
    authProviders: {
      type: [{ type: String, enum: AUTH_PROVIDERS }],
      default: undefined,
    },
    emailVerified: {
      type: Boolean,
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
        delete (ret as Record<string, unknown>).googleId;
        return ret;
      },
    },
  }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  // Google-only accounts have no hash to compare against. Still run a
  // bcrypt compare against a dummy hash so the response time doesn't reveal
  // which kind of account an email belongs to.
  if (!this.password) {
    await bcrypt.compare(candidatePassword, DUMMY_HASH);
    return false;
  }
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

// One Google account can belong to at most one user. Partial (rather than
// sparse) so documents without the field are ignored entirely.
UserSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: 'string' } },
    name: 'googleId_unique',
  }
);

const User = (() => {
  if (mongoose.models && mongoose.models.User) {
    return mongoose.models.User as mongoose.Model<IUser>;
  }
  return mongoose.model<IUser>('User', UserSchema);
})();

export default User;