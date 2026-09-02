import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { sendForgotPasswordOtp } from '@/services/otp.service';
import { successResponse } from '@/lib/api-response';
import { emailSchema } from '@/lib/validation';

const schema = z.object({ email: emailSchema });

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return successResponse({ message: 'If an account exists with that email, a code has been sent.' });
    }
    await sendForgotPasswordOtp(parsed.data.email);
  } catch (err) {
    console.error('[forgot-password]', err);
  }
  return successResponse({ message: 'If an account exists with that email, a code has been sent.' });
}