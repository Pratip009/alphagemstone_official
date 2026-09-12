import { NextRequest } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse } from '@/lib/api-response';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getDropshipShippingRates, DropshipError } from '@/services/dropship.service';

const schema = z.object({
  street1: z.string().min(2, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'A valid 2-letter state/province code is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().optional(),
});

/**
 * POST /api/dropship/portal/[token]/shipping-rates
 * Body: destination address
 * → Live ShipEngine rates (same origin/package defaults as normal customer
 *   checkout), each including the fee-inclusive cost the seller will pay.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const rate = await rateLimit(req, {
      id: 'dropship-shipping-rates',
      limit: 60,
      windowSec: 3600,
      extraKey: token,
      scope: 'key',
    });
    if (!rate.success) return rateLimitResponse(rate);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid address', 422, parsed.error.flatten().fieldErrors);
    }

    const rates = await getDropshipShippingRates(token, parsed.data);
    return successResponse({ rates });
  } catch (err) {
    if (err instanceof DropshipError) return errorResponse(err.message, err.status);
    console.error('POST /api/dropship/portal/[token]/shipping-rates error:', err);
    return errorResponse('Failed to fetch shipping rates', 500);
  }
}
