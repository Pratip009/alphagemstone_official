import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { signup } from '@/services/auth.service';
import { errorResponse } from '@/lib/api-response';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { emailSchema } from '@/lib/validation';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const ipLimit = await rateLimit(req, { id: 'signup-ip', limit: 5, windowSec: 600 });
    if (!ipLimit.success) return rateLimitResponse(ipLimit);

    await connectDB();
    const body = await req.json();

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const { name, email, password } = parsed.data;
    const result = await signup(name, email, password);

    const response = NextResponse.json(
      { success: true, data: { user: result.user } },
      { status: 201 }
    );

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
    return response;
  } catch (err) {
    console.error('[signup]', err);
    return errorResponse('Could not create account. Please try again.', 500);
  }
}