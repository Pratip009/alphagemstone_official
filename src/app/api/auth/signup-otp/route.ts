import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { sendSignupOtp } from '@/services/otp.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { emailSchema, firstZodErrorMessage } from '@/lib/validation';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name (at least 2 characters).')
    .max(100, 'Name is too long.'),
  email: emailSchema,
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(100, 'Password is too long.'),
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
    const { name, email, password } = parsed.data;
    await sendSignupOtp(name, email, password);
    return successResponse({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('[signup-otp]', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Could not send the verification code. Please try again.',
      400
    );
  }
}