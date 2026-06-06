/**
 * POST /api/shipping/ups/track
 * Track a UPS shipment by tracking number.
 *
 * Body: { "trackingNumber": "1Z999AA10123456784" }
 */

import { NextRequest } from "next/server";
import { trackUpsPackage } from "@/services/ups.service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { trackingNumber } = await req.json();
    if (!trackingNumber?.trim()) return apiError("trackingNumber is required", 400);

    const tracking = await trackUpsPackage(trackingNumber.trim());
    return apiSuccess(tracking);
  } catch (err: any) {
    console.error("[UPS track]", err);
    return apiError(err.message ?? "Failed to track UPS package", 500);
  }
}
