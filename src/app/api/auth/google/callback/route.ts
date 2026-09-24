import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import {
  GOOGLE_STATE_COOKIE,
  GoogleAuthError,
  GoogleFlowOrigin,
  GoogleStatePayload,
  exchangeCodeForIdToken,
  readStateCookie,
  statesMatch,
  verifyGoogleIdToken,
} from '@/lib/google-oauth';
import { setSessionCookies } from '@/lib/auth-cookies';
import { extractTokenFromCookie, verifyToken } from '@/lib/jwt';
import { rateLimit } from '@/lib/rate-limit';
import { linkGoogleToUser, signInWithGoogle } from '@/services/google-auth.service';

export const dynamic = 'force-dynamic';

function clearStateCookie(res: NextResponse) {
  res.cookies.set(GOOGLE_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/auth/google',
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function errorRedirect(req: NextRequest, code: string, from: GoogleFlowOrigin, redirect?: string) {
  const url = new URL(from === 'account' ? '/account' : `/${from}`, req.nextUrl.origin);
  url.searchParams.set('error', code);
  if (from !== 'account' && redirect && redirect !== '/') url.searchParams.set('redirect', redirect);
  return clearStateCookie(NextResponse.redirect(url, { status: 303 }));
}

/**
 * GET /api/auth/google/callback?code=…&state=…
 *
 * Google sends the user back here. Every failure path redirects to a page
 * with a friendly ?error= code — the user never sees raw JSON or a stack
 * trace — and the one-time state cookie is always cleared.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Read the state cookie first so errors land on the page the user came from.
  let flow: GoogleStatePayload;
  try {
    flow = readStateCookie(req.cookies.get(GOOGLE_STATE_COOKIE)?.value);
  } catch {
    // Expired (>10 min on Google's screen), cookies blocked, callback opened
    // in a different browser, or back button pressed after finishing.
    return errorRedirect(req, 'google_state', 'login');
  }

  const fail = (code: string) => errorRedirect(req, code, flow.from, flow.redirect);

  // User pressed "Cancel" on Google's screen, or Google refused.
  const googleError = params.get('error');
  if (googleError) {
    return fail(googleError === 'access_denied' ? 'google_cancelled' : 'google_failed');
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state || !statesMatch(state, flow.state)) {
    return fail('google_state');
  }

  const limit = await rateLimit(req, { id: 'google-callback', limit: 20, windowSec: 300 });
  if (!limit.success) return fail('google_rate_limited');

  try {
    const idToken = await exchangeCodeForIdToken({
      code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
    });
    const profile = await verifyGoogleIdToken(idToken, flow.nonce);

    await connectDB();

    if (flow.mode === 'link') {
      const sessionToken = extractTokenFromCookie(req);
      let userId: string;
      try {
        if (!sessionToken) throw new Error('no session');
        userId = verifyToken(sessionToken).userId;
      } catch {
        return fail('google_link_requires_login');
      }
      const result = await linkGoogleToUser(userId, profile);
      const url = new URL('/account', req.nextUrl.origin);
      url.searchParams.set('linked', 'google');
      const res = NextResponse.redirect(url, { status: 303 });
      setSessionCookies(res, result.token);
      return clearStateCookie(res);
    }

    const result = await signInWithGoogle(profile);
    const target = new URL(flow.redirect || '/', req.nextUrl.origin);
    // New accounts from the signup page land where the email signup sends
    // people (/products), unless a specific redirect was requested.
    if (result.isNewUser && flow.redirect === '/' && flow.from === 'signup') {
      target.pathname = '/products';
    }
    const res = NextResponse.redirect(target, { status: 303 });
    setSessionCookies(res, result.token);
    return clearStateCookie(res);
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      console.warn('[google-callback]', err.code, err.message);
      return fail(err.code);
    }
    console.error('[google-callback] unexpected error', err);
    return fail('google_failed');
  }
}
