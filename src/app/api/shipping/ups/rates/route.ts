/**
 * POST /api/shipping/ups/rates
 * Get UPS shipping rate quotes for a shipment.
 *
 * Body:
 * {
 *   "origin": { "street1": "100 Enterprise Way", "city": "New York", "state": "NY", "postalCode": "10001", "country": "US" },
 *   "destination": { "street1": "450 Main St", "city": "Los Angeles", "state": "CA", "postalCode": "90012", "country": "US" },
 *   "package": { "weightLbs": 2, "lengthIn": 12, "widthIn": 9, "heightIn": 5, "declaredValueUsd": 500 }
 * }
 */

import { NextRequest } from "next/server";
import { getUpsRates } from "@/services/ups.service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { origin, destination, package: pkg } = await req.json();

    if (!origin?.postalCode || !destination?.postalCode || !pkg?.weightLbs) {
      return apiError(
        "origin.postalCode, destination.postalCode, and package.weightLbs are required",
        400
      );
    }

    const rates = await getUpsRates(origin, destination, pkg);
    return apiSuccess({ carrier: "UPS", count: rates.length, rates });
  } catch (err: any) {
    console.error("[UPS rates]", err);
    return apiError(err.message ?? "Failed to fetch UPS rates", 500);
  }
}
