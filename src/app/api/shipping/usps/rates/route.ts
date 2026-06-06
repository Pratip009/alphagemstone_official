/**
 * POST /api/shipping/usps/rates
 * Get USPS shipping rate quotes for a shipment.
 *
 * Body:
 * {
 *   "origin": { "postalCode": "10001", "city": "New York", "state": "NY", "street1": "...", "country": "US" },
 *   "destination": { "postalCode": "90210", "city": "Beverly Hills", "state": "CA", "street1": "...", "country": "US" },
 *   "package": { "weightLbs": 1.5, "lengthIn": 10, "widthIn": 8, "heightIn": 4 }
 * }
 */

import { NextRequest } from "next/server";
import { getUspsRates } from "@/services/usps.service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { origin, destination, package: pkg } = await req.json();

    if (!origin?.postalCode || !destination?.postalCode || !pkg?.weightLbs) {
      return apiError("origin.postalCode, destination.postalCode, and package.weightLbs are required", 400);
    }

    const rates = await getUspsRates(origin, destination, pkg);
    return apiSuccess({ carrier: "USPS", count: rates.length, rates });
  } catch (err: any) {
    console.error("[USPS rates]", err);
    return apiError(err.message ?? "Failed to fetch USPS rates", 500);
  }
}
