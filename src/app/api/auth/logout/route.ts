import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, data: { message: 'Logged out' } });

  // Clearing an httpOnly cookie can only be done from the server — this is
  // why logout must be a real request instead of `document.cookie = ...`
  // on the client (which can't touch httpOnly cookies at all).
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
