/**
 * POST /api/shipping/track
 * Tracks a package via ShipEngine.
 *
 * Body: { "trackingNumber": "1Z999AA10123456784", "carrierCode": "ups" }
 *   carrierCode is optional — inferred from tracking number format when omitted.
 *
 * Common ShipEngine carrier codes: ups | stamps_com (USPS) | fedex | dhl_express
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { trackShipEnginePackage } from '@/services/shipengine.service';

export async function POST(req: NextRequest) {
  try {
    const { trackingNumber, carrierCode } = await req.json();

    if (!trackingNumber?.trim()) {
      return apiError('trackingNumber is required', 400);
    }

    const tracking = await trackShipEnginePackage(
      trackingNumber.trim(),
      
    );

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