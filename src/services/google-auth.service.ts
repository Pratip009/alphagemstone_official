import { Resend } from 'resend';
import User, { IUser } from '@/models/User';
import Otp from '@/models/Otp';
import { signToken } from '@/lib/jwt';
import { welcomeEmailHtml } from '@/lib/email-templates';
import { GoogleAuthError, GoogleProfile } from '@/lib/google-oauth';
import { resolveAuthProviders, toPublicUser } from '@/services/auth.service';

const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

function sessionFor(user: IUser) {
  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  return { token, user: toPublicUser(user), isNewUser: false };
}

function sendWelcomeEmail(email: string, name: string) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  void resend.emails
    .send({ from: FROM, to: email, subject: 'Welcome to Alpha Gemstone', html: welcomeEmailHtml(name) })
    .catch((err) => console.error('[google-auth] welcome email failed', err));
}

/** Fills in profile gaps from Google without overwriting anything the user set. */
function fillProfileGaps(user: IUser, profile: GoogleProfile) {
  if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
  if (!user.name?.trim()) user.name = profile.name;
}

function addProvider(user: IUser, provider: 'password' | 'google') {
  const current = resolveAuthProviders(user);
  user.authProviders = current.includes(provider) ? current : [...current, provider];
}

/**
 * Sign in or sign up with a verified Google profile.
 *
 * Resolution order:
 *   1. A user already linked to this Google account (by `sub`) → sign in.
 *      Matching on `sub`, not email, means changing the Gmail address on
 *      the Google side never locks anyone out.
 *   2. A user with the same email → link Google to that account, then sign
 *      in. So someone who registered with email + password and later clicks
 *      "Continue with Google" lands in the same account, with their orders,
 *      cart, wishlist and memos intact — no duplicate accounts.
 *   3. Nobody → create a new Google account.
 */
export async function signInWithGoogle(profile: GoogleProfile) {
  // Google has proven control of the address only when email_verified is
  // true. Without it we must not create or merge anything by email —
  // otherwise an unverified Google email could take over an existing
  // account. (Every @gmail.com address is verified; this mostly bites
  // Workspace domains or accounts created with a third-party email.)
  if (!profile.emailVerified) {
    throw new GoogleAuthError('google_unverified');
  }

  // 1. Already linked
  const linked = await User.findOne({ googleId: profile.sub }).select('+googleId');
  if (linked) {
    const before = { avatar: linked.avatarUrl, name: linked.name };
    fillProfileGaps(linked, profile);
    if (linked.avatarUrl !== before.avatar || linked.name !== before.name) await linked.save();
    return sessionFor(linked);
  }

  // 2. Existing account with this email
  const existing = await User.findOne({ email: profile.email })
    .collation({ locale: 'en', strength: 2 })
    .select('+googleId +password');

  if (existing) {
    if (existing.googleId && existing.googleId !== profile.sub) {
      // The email is already tied to a *different* Google account (e.g. a
      // Workspace address that was deleted and recreated). Don't silently
      // swap which Google identity controls this account.
      throw new GoogleAuthError('google_conflict');
    }

    existing.googleId = profile.sub;
    addProvider(existing, 'google');

    // Pre-account-takeover guard. If this account was created WITHOUT
    // proving ownership of the email (legacy /api/auth/signup route), whoever
    // created it may not be the real owner — but they would know its
    // password. Now that Google has proven who actually owns the address,
    // drop that password so only the verified owner can get in. They can
    // set a new one any time through "Forgot password".
    if (existing.emailVerified === false) {
      existing.password = undefined;
      existing.authProviders = resolveAuthProviders(existing).filter((p) => p !== 'password');
      if (!existing.authProviders.includes('google')) existing.authProviders.push('google');
    }
    existing.emailVerified = true;
    fillProfileGaps(existing, profile);

    try {
      await existing.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        // This Google account got linked to someone else between our two
        // queries (double-clicked callback, two tabs). Retry the lookup.
        const winner = await User.findOne({ googleId: profile.sub });
        if (winner) return sessionFor(winner);
      }
      throw err;
    }
    return sessionFor(existing);
  }

  // 3. Brand-new account
  try {
    const created = await User.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.sub,
      authProviders: ['google'],
      emailVerified: true,
      avatarUrl: profile.picture ?? '',
      role: 'user',
    });

    // A half-finished email signup for the same address is now moot.
    void Otp.deleteMany({ email: profile.email, purpose: 'signup' }).catch(() => {});
    sendWelcomeEmail(profile.email, profile.name);

    return { ...sessionFor(created), isNewUser: true };
  } catch (err: any) {
    if (err?.code === 11000) {
      // Race: the same person finished an email signup, or a second Google
      // callback, a moment earlier. Run the resolution again — it will now
      // hit step 1 or 2.
      const again = await User.findOne({ googleId: profile.sub });
      if (again) return sessionFor(again);
      const byEmail = await User.findOne({ email: profile.email }).collation({ locale: 'en', strength: 2 });
      if (byEmail) return signInWithGoogle(profile);
    }
    throw err;
  }
}

/**
 * Connect a Google account to the currently signed-in user (from the
 * Account page). The Google email does not have to match the account email.
 */
export async function linkGoogleToUser(userId: string, profile: GoogleProfile) {
  const user = await User.findById(userId).select('+googleId');
  if (!user) throw new GoogleAuthError('google_link_requires_login');

  const owner = await User.findOne({ googleId: profile.sub }).select('_id');
  if (owner && owner._id.toString() !== user._id.toString()) {
    throw new GoogleAuthError('google_in_use');
  }
  if (user.googleId && user.googleId !== profile.sub) {
    throw new GoogleAuthError('google_conflict');
  }

  user.googleId = profile.sub;
  addProvider(user, 'google');
  if (profile.emailVerified && profile.email === user.email) user.emailVerified = true;
  fillProfileGaps(user, profile);

  try {
    await user.save();
  } catch (err: any) {
    if (err?.code === 11000) throw new GoogleAuthError('google_in_use');
    throw err;
  }
  return sessionFor(user);
}

/**
 * Disconnect Google. Refused when Google is the only way into the account —
 * the user must set a password first, or they'd be locked out.
 */
export async function unlinkGoogleFromUser(userId: string) {
  const user = await User.findById(userId).select('+googleId +password');
  if (!user) throw new Error('User not found');

  const providers = resolveAuthProviders(user);
  if (!user.googleId && !providers.includes('google')) {
    return toPublicUser(user);
  }
  if (!user.password) {
    throw new Error('Set a password before disconnecting Google, otherwise you would not be able to sign in.');
  }

  user.googleId = undefined;
  user.authProviders = providers.filter((p) => p !== 'google');
  if (!user.authProviders.includes('password')) user.authProviders.push('password');
  await user.save();
  return toPublicUser(user);
}
