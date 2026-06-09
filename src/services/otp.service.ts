import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import Otp from '@/models/Otp';
import User from '@/models/User';
import { signToken } from '@/lib/jwt';
import { otpEmailHtml } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function checkRateLimit(email: string, purpose: string): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000);
  const count = await Otp.countDocuments({
    email: email.toLowerCase(),
    purpose,
    createdAt: { $gte: windowStart },
  });
  if (count >= RATE_LIMIT_MAX) {
    throw new Error('Too many codes sent. Please wait a moment before requesting another.');
  }
}

async function sendOtpEmail(
  email: string,
  otp: string,
  purpose: 'signup' | 'reset_password'
): Promise<void> {
  const subject =
    purpose === 'signup'
      ? 'Your Alpha Imports verification code'
      : 'Reset your Alpha Imports password';

  await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: otpEmailHtml(otp, purpose),
  });
}

// ─── Signup OTP ───────────────────────────────────────────────────────────────

export async function sendSignupOtp(
  name: string,
  email: string,
  password: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  await checkRateLimit(normalizedEmail, 'signup');

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const passwordHash = await bcrypt.hash(password, 12);

  await Otp.deleteMany({ email: normalizedEmail, purpose: 'signup' });

  await Otp.create({
    email: normalizedEmail,
    otp: otpHash,
    purpose: 'signup',
    pendingName: name,
    pendingPassword: passwordHash,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    verified: false,
    attempts: 0,
  });

  await sendOtpEmail(normalizedEmail, otp, 'signup');
}

export async function verifySignupOtp(
  email: string,
  otp: string
): Promise<{ token: string; user: object }> {
  const normalizedEmail = email.toLowerCase();

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose: 'signup',
    verified: false,
  }).select('+otp +pendingPassword');

  if (!record) throw new Error('No pending verification found. Please request a new code.');
  if (record.expiresAt < new Date()) throw new Error('Code expired. Please request a new one.');
  if (record.attempts >= MAX_ATTEMPTS) throw new Error('Too many wrong attempts. Please request a new code.');

  const isMatch = await bcrypt.compare(otp, record.otp);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const remaining = MAX_ATTEMPTS - record.attempts;
    throw new Error(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many wrong attempts. Please request a new code.'
    );
  }

  record.verified = true;
  await record.save();

  // Insert directly to bypass pre-save hook (password is already bcrypt-hashed)
  const now = new Date();
  const result = await User.collection.insertOne({
    name: record.pendingName,
    email: normalizedEmail,
    password: record.pendingPassword,
    role: 'user',
    createdAt: now,
    updatedAt: now,
  });

  const token = signToken({
    userId: result.insertedId.toString(),
    email: normalizedEmail,
    role: 'user',
  });

  await Otp.deleteOne({ _id: record._id });

  return {
    token,
    user: {
      id: result.insertedId.toString(),
      name: record.pendingName,
      email: normalizedEmail,
      role: 'user',
    },
  };
}

// ─── Forgot Password OTP ──────────────────────────────────────────────────────

export async function sendForgotPasswordOtp(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();

  await checkRateLimit(normalizedEmail, 'reset_password');

  const userExists = await User.findOne({ email: normalizedEmail }).lean();
  if (!userExists) return; // Silent — prevent email enumeration

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  await Otp.deleteMany({ email: normalizedEmail, purpose: 'reset_password' });

  await Otp.create({
    email: normalizedEmail,
    otp: otpHash,
    purpose: 'reset_password',
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    verified: false,
    attempts: 0,
  });

  await sendOtpEmail(normalizedEmail, otp, 'reset_password');
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase();

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose: 'reset_password',
    verified: false,
  }).select('+otp');

  if (!record) throw new Error('No pending reset found. Please request a new code.');
  if (record.expiresAt < new Date()) throw new Error('Code expired. Please request a new one.');
  if (record.attempts >= MAX_ATTEMPTS) throw new Error('Too many wrong attempts. Please request a new code.');

  const isMatch = await bcrypt.compare(otp, record.otp);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const remaining = MAX_ATTEMPTS - record.attempts;
    throw new Error(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many wrong attempts. Please request a new code.'
    );
  }

  record.verified = true;
  await record.save();

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) throw new Error('Account not found.');

  user.password = newPassword; // pre-save hook will hash this
  await user.save();

  await Otp.deleteOne({ _id: record._id });
}