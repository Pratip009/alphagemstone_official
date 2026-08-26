import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { verifySignupOtp } from '@/services/otp.service';
import { errorResponse } from '@/lib/api-response';
import { extractGuestId, clearGuestCookie } from '@/lib/guest';
import { mergeGuestCartIntoUser } from '@/services/cart.service';

const schema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }
    const { email, otp } = parsed.data;
    const result = await verifySignupOtp(email, otp);

    // Only `user` goes in the JSON body. The token is set below as an
    // httpOnly cookie — putting it in the body too would hand any XSS
    // the same plaintext token that httpOnly is meant to keep out of JS.
    const response = NextResponse.json({ success: true, data: { user: result.user } }, { status: 201 });
    response.cookies.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    response.cookies.set('has_session', '1', {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
});

    // Fold a guest cart (built up before this account existed) into the new
    // user's cart. Never let a merge failure block account creation.
    const guestId = extractGuestId(req);
    if (guestId) {
      try {
        await mergeGuestCartIntoUser(guestId, result.user.id);
      } catch (mergeErr) {
        console.error('[verify-signup] guest cart merge failed:', mergeErr);
      }
      clearGuestCookie(response);
    }

    return response;
  } catch (err) {
    console.error('[verify-signup]', err);
    return errorResponse(err instanceof Error ? err.message : 'Verification failed.', 400);
  }
}