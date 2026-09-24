import { NextRequest, NextResponse } from 'next/server';
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE_SEC,
  GoogleFlowMode,
  GoogleFlowOrigin,
  buildAuthorizationUrl,
  createFlowSecrets,
  isGoogleAuthConfigured,
  resolveRedirectUri,
  signStateCookie,
} from '@/lib/google-oauth';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { rateLimit } from '@/lib/rate-limit';
import { extractTokenFromCookie, verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google?redirect=/checkout&from=login
 * GET /api/auth/google?mode=link&from=account          (connect from Account page)
 *
 * Starts the Google OpenID Connect flow: stores state / nonce / PKCE
 * verifier in a short-lived signed httpOnly cookie, then redirects to
 * Google's account chooser. This is a plain link target — no JS needed.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode: GoogleFlowMode = params.get('mode') === 'link' ? 'link' : 'signin';
  const fromParam = params.get('from');
  const from: GoogleFlowOrigin =
    mode === 'link' ? 'account' : fromParam === 'signup' ? 'signup' : 'login';
  const redirect = safeRedirectPath(params.get('redirect'), mode === 'link' ? '/account' : '/');

  const bounce = (code: string) => {
    const url = new URL(from === 'account' ? '/account' : `/${from}`, req.nextUrl.origin);
    url.searchParams.set('error', code);
    if (from !== 'account' && redirect !== '/') url.searchParams.set('redirect', redirect);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!isGoogleAuthConfigured()) return bounce('google_unavailable');

  const limit = await rateLimit(req, { id: 'google-start', limit: 20, windowSec: 300 });
  if (!limit.success) return bounce('google_rate_limited');

  // Linking needs an existing session; check now so the user isn't sent
  // through Google only to be rejected at the end.
  let loginHint: string | undefined;
  if (mode === 'link') {
    const token = extractTokenFromCookie(req);
    try {
      if (!token) throw new Error('no session');
      loginHint = verifyToken(token).email;
    } catch {
      return NextResponse.redirect(new URL('/login?redirect=/account', req.nextUrl.origin), { status: 303 });
    }
  }

  const { state, nonce, verifier, challenge } = createFlowSecrets();
  const redirectUri = resolveRedirectUri(req.nextUrl.origin);

  const authUrl = buildAuthorizationUrl({ redirectUri, state, nonce, challenge, loginHint });

  const response = NextResponse.redirect(authUrl, { status: 303 });
  response.cookies.set(
    GOOGLE_STATE_COOKIE,
    signStateCookie({ state, verifier, nonce, redirect, redirectUri, mode, from }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // Must be Lax (not Strict): the callback is a top-level navigation
      // coming *from* accounts.google.com, and Strict cookies wouldn't be
      // sent with it.
      sameSite: 'lax',
      maxAge: GOOGLE_STATE_MAX_AGE_SEC,
      path: '/api/auth/google',
    }
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
