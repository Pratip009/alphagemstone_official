import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { resetPasswordWithOtp } from '@/services/otp.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { emailSchema, firstZodErrorMessage } from '@/lib/validation';

const schema = z.object({
  email: emailSchema,
  otp: z.string().trim().length(6, 'Please enter the full 6-digit code.'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters.')
    .max(100, 'New password is too long.'),
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
    const { email, otp, newPassword } = parsed.data;
    await resetPasswordWithOtp(email, otp, newPassword);
    return successResponse({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('[reset-password]', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Could not reset your password. Please try again.',
      400
    );
  }
}