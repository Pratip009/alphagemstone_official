import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import '@/lib/registerModels';
import { sendSignupOtp } from '@/services/otp.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { emailSchema } from '@/lib/validation';

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }
    const { name, email, password } = parsed.data;
    await sendSignupOtp(name, email, password);
    return successResponse({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('[signup-otp]', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to send code.', 400);
  }
}