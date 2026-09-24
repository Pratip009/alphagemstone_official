import User, { IUser, AuthProvider, AUTH_PROVIDERS } from '@/models/User';
import { signToken } from '@/lib/jwt';

// ─── Sign-in methods ───────────────────────────────────────────────────────────
// Accounts created before Google sign-in existed have no `authProviders`
// field; every one of them was created with a password, so that's the
// correct fallback. Works on hydrated docs and `.lean()` objects alike.
export function resolveAuthProviders(user: { authProviders?: unknown }): AuthProvider[] {
  const raw = Array.isArray(user.authProviders) ? user.authProviders : [];
  const valid = raw.filter((p): p is AuthProvider => (AUTH_PROVIDERS as readonly string[]).includes(p as string));
  return valid.length ? Array.from(new Set(valid)) : ['password'];
}

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
    // Lets the UI show "Sign-in methods" and decide whether Google can be
    // disconnected, without ever exposing the Google id or password hash.
    authProviders: resolveAuthProviders(anyUser),
    hasPassword: resolveAuthProviders(anyUser).includes('password'),
    googleLinked: resolveAuthProviders(anyUser).includes('google'),
  };
}

// ─── Signup ───────────────────────────────────────────────────────────────────
// Legacy direct signup (no email verification). The site's signup page uses
// the OTP flow (signup-otp → verify-signup) instead. Accounts made here are
// flagged `emailVerified: false`, which matters for Google sign-in: if the
// real owner of the address later signs in with Google, the unverified
// password is discarded (see google-auth.service.ts).
export async function signup(name: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail })
    .collation({ locale: 'en', strength: 2 })
    .lean();
  if (existing) {
    throw new Error('Email already registered');
  }

  let user;
  try {
    user = new User({
      name,
      email: normalizedEmail,
      password,
      role: 'user',
      authProviders: ['password'],
      emailVerified: false,
    });
    await user.save();
  } catch (err: any) {
    // Race-condition guard: two concurrent signups for the same email can
    // both pass the findOne check above before either has saved. The
    // unique index catches it at write time — surface it as the same
    // friendly message rather than a raw duplicate-key error.
    if (err?.code === 11000) {
      throw new Error('Email already registered');
    }
    throw err;
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { token, user: toPublicUser(user) };
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .collation({ locale: 'en', strength: 2 })
    .select('+password');
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