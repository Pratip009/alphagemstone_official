import User, { IUser } from '@/models/User';
import { signToken } from '@/lib/jwt';

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

  return { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } };
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
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
}

// ─── Get user by ID ───────────────────────────────────────────────────────────
export async function getUserById(id: string): Promise<IUser | null> {
  return User.findById(id).lean() as unknown as IUser | null;
}
