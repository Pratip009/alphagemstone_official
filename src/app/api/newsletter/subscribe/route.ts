import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { subscribeEmail } from '@/services/newsletter.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid email address', 400);
    }

    const { alreadySubscribed } = await subscribeEmail(parsed.data.email);

    if (alreadySubscribed) {
      return errorResponse('You are already subscribed.', 409);
    }

    return successResponse({ message: 'Successfully subscribed.' }, 201);
  } catch (err) {
    console.error('[POST /api/newsletter/subscribe]', err);
    return errorResponse('Something went wrong. Please try again.', 500);
  }
}
