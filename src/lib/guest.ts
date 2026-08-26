import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Identifies an anonymous shopper across requests so their cart survives
// without an account. Mirrors the `auth_token` cookie's shape (httpOnly,
// same-origin only) but carries no PII — just an opaque UUID used as the
// Cart/Order's `guestId` field.
export const GUEST_COOKIE = 'guest_id';
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — long enough to
// survive an abandoned cart being picked back up, short enough that stale
// guest carts don't accumulate forever.

export function extractGuestId(req: NextRequest): string | null {
  return req.cookies.get(GUEST_COOKIE)?.value ?? null;
}

export function generateGuestId(): string {
  return randomUUID();
}

export function attachGuestCookie(res: NextResponse, guestId: string): void {
  res.cookies.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GUEST_COOKIE_MAX_AGE,
    path: '/',
  });
}

// Called on login/signup/verify-signup so a guest_id cookie set while
// browsing doesn't linger (and confuse future withCartAuth calls) once the
// person has a real account. The guest CART itself is merged separately
// (see cart.service.mergeGuestCartIntoUser) before this runs.
export function clearGuestCookie(res: NextResponse): void {
  res.cookies.set(GUEST_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}
