/**
 * POST /api/shipping/usps/track
 * Track a USPS shipment by tracking number.
 *
 * Body: { "trackingNumber": "9400111899223482392269" }
 */

import { NextRequest } from "next/server";
import { trackUspsPackage } from "@/services/usps.service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { trackingNumber } = await req.json();
    if (!trackingNumber?.trim()) return apiError("trackingNumber is required", 400);

    const tracking = await trackUspsPackage(trackingNumber.trim());
    return apiSuccess(tracking);
  } catch (err: any) {
    console.error("[USPS track]", err);
    return apiError(err.message ?? "Failed to track USPS package", 500);
  }
}
