import { NextResponse } from 'next/server';

/**
 * Single source of truth for the session cookies.
 *
 *   auth_token  — httpOnly JWT, the actual credential
 *   has_session — readable hint so useAuth only calls /api/auth/me when a
 *                 session probably exists (avoids a 401 on every page load
 *                 for logged-out visitors)
 *
 * Previously this block was copy-pasted into login, signup and
 * verify-signup; the Google callback would have been a fourth copy.
 */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // keep in sync with JWT_EXPIRES_IN

const secure = process.env.NODE_ENV === 'production';

export function setSessionCookies(response: NextResponse, token: string): NextResponse {
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  });
  response.cookies.set('has_session', '1', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  });
  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('has_session', '', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
