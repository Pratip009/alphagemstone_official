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

const User = (() => {
  if (mongoose.models && mongoose.models.User) {
    return mongoose.models.User as mongoose.Model<IUser>;
  }
  return mongoose.model<IUser>('User', UserSchema);
})();

export default User;