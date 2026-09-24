import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth-cookies';

export async function POST() {
  const response = NextResponse.json({ success: true, data: { message: 'Logged out' } });

  // Clearing an httpOnly cookie can only be done from the server — this is
  // why logout must be a real request instead of `document.cookie = ...`
  // on the client (which can't touch httpOnly cookies at all).
  //
  // Google sessions use exactly the same cookies, so this signs out
  // email/password and Google users alike. It deliberately does NOT sign
  // the user out of their Google account itself.
  return clearSessionCookies(response);
}
