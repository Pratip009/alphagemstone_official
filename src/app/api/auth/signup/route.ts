import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { signup } from '@/services/auth.service';
import { errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const { name, email, password } = parsed.data;
    const result = await signup(name, email, password);

    // Only `user` goes in the JSON body. The token is set below as an
    // httpOnly cookie — putting it in the body too would hand any XSS
    // the same plaintext token that httpOnly is meant to keep out of JS.
    const response = NextResponse.json(
      { success: true, data: { user: result.user } },
      { status: 201 }
    );

    response.cookies.set('auth_token', result.token, {
      httpOnly: true,                                    // ✅ fixed: no JS access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[signup]', err);
    // ✅ fixed: generic message to prevent email enumeration
    return errorResponse('Could not create account. Please try again.', 500);
  }
}