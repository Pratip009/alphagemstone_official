import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/lib/api-response';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { applyForDropship, DropshipError } from '@/services/dropship.service';

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  businessName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  website: z.string().optional(),
  sellingChannels: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rate = await rateLimit(req, {
      id: 'dropship-apply',
      limit: 5,
      windowSec: 3600,
    });
    if (!rate.success) return rateLimitResponse(rate);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'Invalid request',
        422,
        parsed.error.flatten().fieldErrors
      );
    }

    const application = await applyForDropship(parsed.data);
    return successResponse(
      { status: application.status },
      201
    );
  } catch (err) {
    if (err instanceof DropshipError) return errorResponse(err.message, err.status);
    console.error('POST /api/dropship/apply error:', err);
    return errorResponse('Failed to submit application', 500);
  }
}
