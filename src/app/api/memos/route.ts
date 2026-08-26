import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createMemoRequest, listMemosForUser, MemoError } from '@/services/memo.service';
import { MEMO_MAX_DAYS } from '@/lib/memo.constants';

const shippingAddressSchema = z.object({
  fullName: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().min(1),
});

const createMemoSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .min(1),
  durationDays: z.number().int().min(1).max(MEMO_MAX_DAYS),
  shippingAddress: shippingAddressSchema,
  termsAccepted: z.literal(true),
});

export const POST = withAuth(async (req: NextRequest & { user: { userId: string } }) => {
  try {
    const rate = await rateLimit(req, {
      id: 'memo-create',
      limit: 5,
      windowSec: 3600,
      extraKey: req.user.userId,
      scope: 'key',
    });
    if (!rate.success) return rateLimitResponse(rate);

    const body = await req.json();
    const parsed = createMemoSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid request', 400, parsed.error.flatten().fieldErrors);
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    const memo = await createMemoRequest({
      userId: req.user.userId,
      items: parsed.data.items,
      durationDays: parsed.data.durationDays,
      shippingAddress: parsed.data.shippingAddress,
      termsAccepted: parsed.data.termsAccepted,
      ip,
      userAgent,
    });

    return successResponse(memo, 201);
  } catch (err) {
    if (err instanceof MemoError) return errorResponse(err.message, err.status);
    console.error('POST /api/memos error:', err);
    return errorResponse('Failed to create memo request', 500);
  }
});

export const GET = withAuth(async (req: NextRequest & { user: { userId: string } }) => {
  try {
    const memos = await listMemosForUser(req.user.userId);
    return successResponse(memos, 200);
  } catch (err) {
    console.error('GET /api/memos error:', err);
    return errorResponse('Failed to fetch memos', 500);
  }
});