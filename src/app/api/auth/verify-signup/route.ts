import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { verifySignupOtp } from '@/services/otp.service';
import { errorResponse } from '@/lib/api-response';
import { setSessionCookies } from '@/lib/auth-cookies';
import { emailSchema, firstZodErrorMessage } from '@/lib/validation';

const schema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6, 'Please enter the full 6-digit code.'),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        firstZodErrorMessage(parsed.error),
        400,
        parsed.error.flatten().fieldErrors
      );
    }
    const { email, otp } = parsed.data;
    const result = await verifySignupOtp(email, otp);

    const response = NextResponse.json({ success: true, data: { user: result.user } }, { status: 201 });
    setSessionCookies(response, result.token);
    return response;
  } catch (err) {
    console.error('[verify-signup]', err);
    return errorResponse(err instanceof Error ? err.message : 'Verification failed.', 400);
  }
}