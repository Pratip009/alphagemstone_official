import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import Otp from '@/models/Otp';
import User from '@/models/User';
import { signToken } from '@/lib/jwt';
import { otpEmailHtml, welcomeEmailHtml } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
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
      ? 'Your Alpha Gemstone verification code'
      : 'Reset your Alpha Gemstone password';

  if (!process.env.RESEND_API_KEY) {
    // Fail loudly instead of letting `resend.emails.send` throw an opaque
    // auth error further down — this is the #1 cause of "OTP never
    // arrives" reports and is easy to miss because signup still appears
    // to "work" up until this call.
    throw new Error(
      'Email service is not configured (missing RESEND_API_KEY). Verification codes cannot be sent.'
    );
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: email,
      subject,
      html: otpEmailHtml(otp, purpose),
    });

    // The Resend SDK often resolves successfully even when delivery was
    // rejected (e.g. sandbox `onboarding@resend.dev` can only deliver to
    // the account owner's own verified address until a custom domain is
    // verified) — the failure shows up in `result.error`, not a thrown
    // exception. Surface it instead of silently telling the user "code
    // sent" when nothing was actually delivered.
    if (result?.error) {
      console.error('[sendOtpEmail] Resend rejected the send:', result.error);
      const isSandboxRestriction =
        FROM.endsWith('@resend.dev') ||
        /only send testing emails|verify a domain/i.test(result.error.message ?? '');
      throw new Error(
        isSandboxRestriction
          ? 'Email could not be delivered: the sending domain is not verified with Resend yet, so codes can only reach the account\'s own test address. Verify a domain and set EMAIL_FROM to an address on it.'
          : `Email could not be delivered: ${result.error.message ?? 'unknown error'}`
      );
    }
  } catch (err) {
    console.error('[sendOtpEmail] Resend threw an error:', err instanceof Error ? err.message : err);
    throw err;
  }
}

// ─── Signup OTP ───────────────────────────────────────────────────────────────

export async function sendSignupOtp(
  name: string,
  email: string,
  password: string
): Promise<void> {
  // Normalize defensively even though the API layer (zod `emailSchema`)
  // already trims + lowercases — this function is also reachable from
  // scripts/tests that may not go through that layer.
  const normalizedEmail = email.trim().toLowerCase();

  // Collation strength 2 makes this comparison case-insensitive AND
  // accent-insensitive at the query level, independent of whatever the
  // stored casing happens to be. Without this, a document written before
  // the schema's `lowercase: true` was added (or inserted by a script
  // that bypassed it) could sit in the collection with mixed case and
  // silently evade a plain `{ email: normalizedEmail }` match in one
  // direction while still colliding with it via the unique index in the
  // other — i.e. exactly the "I deleted it but it still says it exists"
  // (or the reverse: "it lets me register a duplicate") symptom.
  const existing = await User.findOne({ email: normalizedEmail })
    .collation({ locale: 'en', strength: 2 })
    .lean();
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
  const normalizedEmail = email.trim().toLowerCase();

  const record = await Otp.findOne({
    email: normalizedEmail,
    purpose: 'signup',
    verified: false,
  }).select('+otp +pendingPassword');

  if (!record) throw new Error('No pending verification found. Please request a new code.');
  if (!record.pendingName) throw new Error('Signup data is missing. Please start over.');
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
  let result;
  try {
    result = await User.collection.insertOne({
      name: record.pendingName,
      email: normalizedEmail,
      password: record.pendingPassword,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    // E11000 = duplicate key. Can happen if two verify requests for the
    // same pending OTP race each other (e.g. a double-click or a client
    // retry), or if an account with this email was created through some
    // other path in the split second between the "does this exist"
    // check at OTP-send time and this insert. Either way, surface a
    // clear, actionable message instead of a raw Mongo error string.
    if (err?.code === 11000) {
      await Otp.deleteOne({ _id: record._id });
      throw new Error(
        'An account with this email already exists. Try logging in instead.'
      );
    }
    throw err;
  }

  const token = signToken({
    userId: result.insertedId.toString(),
    email: normalizedEmail,
    role: 'user',
  });

  await Otp.deleteOne({ _id: record._id });

  // Send welcome email — fires after account is fully created, exactly once.
  // Using void to not block the response on email delivery.
  void resend.emails.send({
    from: FROM,
    to: normalizedEmail,
    subject: `Welcome to Alpha Gemstone`,
    html: welcomeEmailHtml(record.pendingName),
  });

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
  const normalizedEmail = email.trim().toLowerCase();

  await checkRateLimit(normalizedEmail, 'reset_password');

  const userExists = await User.findOne({ email: normalizedEmail })
    .collation({ locale: 'en', strength: 2 })
    .lean();
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
  const normalizedEmail = email.trim().toLowerCase();

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

  const user = await User.findOne({ email: normalizedEmail })
    .collation({ locale: 'en', strength: 2 })
    .select('+password');
  if (!user) throw new Error('Account not found.');

  user.password = newPassword; // pre-save hook will hash this
  await user.save();

  await Otp.deleteOne({ _id: record._id });
}