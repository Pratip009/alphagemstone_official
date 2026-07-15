/**
 * POST /api/shipping/track
 * Tracks a package via ShipStation V2.
 *
 * Body: { "labelId": "se-1234567" }
 *   ShipStation V2 only supports tracking lookups by label_id — there is no
 *   carrier_code + tracking_number endpoint. Pass the order's stored
 *   `labelId` (set when the shipping label was purchased), not its
 *   customer-facing tracking number.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { trackShipEnginePackage } from '@/services/shipengine.service';

export async function POST(req: NextRequest) {
  try {
    const { labelId } = await req.json();

    if (!labelId?.trim()) {
      return apiError('labelId is required', 400);
    }

    const tracking = await trackShipEnginePackage(labelId.trim());

    return apiSuccess(tracking);
  } catch (err: any) {
    console.error('[shipping/track]', err);

    // Surface a friendly message for rate-limit errors instead of a raw 500
    const isTooManyRequests =
      err?.message?.toLowerCase().includes('too many requests') ||
      err?.statusCode === 429;

    const message = isTooManyRequests
      ? 'The carrier is temporarily rate-limiting tracking requests. Please wait a moment and try again.'
      : (err.message ?? 'Tracking failed');

    const status = isTooManyRequests ? 429 : 500;
    return apiError(message, status);
  }
}