import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { sendForgotPasswordOtp } from '@/services/otp.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { emailSchema, firstZodErrorMessage } from '@/lib/validation';

const schema = z.object({ email: emailSchema });

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Safe to be specific here — "please enter a valid email address" is
      // a format complaint, not an existence check, so it doesn't leak
      // whether any account uses that address.
      return errorResponse(firstZodErrorMessage(parsed.error), 400);
    }
    await sendForgotPasswordOtp(parsed.data.email);
  } catch (err) {
    console.error('[forgot-password]', err);
  }
  return successResponse({ message: 'If an account exists with that email, a code has been sent.' });
}