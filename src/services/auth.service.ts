import User, { IUser } from '@/models/User';
import { signToken } from '@/lib/jwt';

// ─── Shared response shape ─────────────────────────────────────────────────────
// Every endpoint that hands the client a "user" object (signup, login, /me,
// account update) should return exactly this shape so useAuth's context never
// has to guess which fields are present.
export function toPublicUser(user: IUser | (IUser & { _id: unknown })) {
  const anyUser = user as any;
  return {
    id: anyUser._id?.toString?.() ?? anyUser._id,
    name: anyUser.name,
    email: anyUser.email,
    phone: anyUser.phone ?? '',
    avatarUrl: anyUser.avatarUrl ?? '',
    address: {
      line1: anyUser.address?.line1 ?? '',
      line2: anyUser.address?.line2 ?? '',
      city: anyUser.address?.city ?? '',
      state: anyUser.address?.state ?? '',
      postalCode: anyUser.address?.postalCode ?? '',
      country: anyUser.address?.country ?? '',
    },
    role: anyUser.role,
  };
}

// ─── Signup ───────────────────────────────────────────────────────────────────
export async function signup(name: string, email: string, password: string) {
  const existing = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existing) {
    throw new Error('Email already registered');
  }

  const user = new User({ name, email, password, role: 'user' });
  await user.save();

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { token, user: toPublicUser(user) };
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: toPublicUser(user),
  };
}

// ─── Get user by ID ───────────────────────────────────────────────────────────
export async function getUserById(id: string): Promise<IUser | null> {
  return User.findById(id).lean() as unknown as IUser | null;
}