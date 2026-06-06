/**
 * POST /api/shipping/rates
 * Aggregate shipping rates from all enabled carriers (FedEx, USPS, UPS) in parallel.
 * Returns rates grouped by carrier plus a flat sorted list.
 *
 * Body:
 * {
 *   "origin": { "street1": "...", "city": "...", "state": "NY", "postalCode": "10001", "country": "US" },
 *   "destination": { "street1": "...", "city": "...", "state": "CA", "postalCode": "90012", "country": "US" },
 *   "package": { "weightLbs": 1.5, "lengthIn": 10, "widthIn": 8, "heightIn": 4, "declaredValueUsd": 500 },
 *   "carriers": ["fedex", "usps", "ups"]   // optional — defaults to all three
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "byCarrier": { "fedex": [...], "usps": [...], "ups": [...] },
 *     "all": [/* sorted cheapest first *\/],
 *     "errors": [{ "carrier": "FedEx", "message": "..." }]
 *   }
 * }
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getAllCarrierRates } from "@/services/shipping.aggregator";
import { withAuth } from "@/middleware/auth.middleware";
import type { ShippingRate } from "@/types/shipping";

async function handler(req: NextRequest) {
  try {
    const { origin, destination, package: pkg, carriers } = await req.json();

    if (!origin?.postalCode || !destination?.postalCode || !pkg?.weightLbs) {
      return apiError(
        "origin.postalCode, destination.postalCode, and package.weightLbs are required",
        400
      );
    }

    const { fedex, usps, ups, errors } = await getAllCarrierRates(origin, destination, pkg);

    // Apply carrier filter if provided
    const enabledCarriers: string[] = Array.isArray(carriers)
      ? carriers.map((c: string) => c.toLowerCase())
      : ["fedex", "usps", "ups"];

    const byCarrier = {
      fedex: enabledCarriers.includes("fedex") ? fedex : [],
      usps: enabledCarriers.includes("usps") ? usps : [],
      ups: enabledCarriers.includes("ups") ? ups : [],
    };

    const all: ShippingRate[] = [
      ...byCarrier.fedex,
      ...byCarrier.usps,
      ...byCarrier.ups,
    ].sort((a, b) => a.rate - b.rate);

    return apiSuccess({ byCarrier, all, errors });
  } catch (err: any) {
    console.error("[shipping/rates]", err);
    return apiError(err.message ?? "Failed to fetch shipping rates", 500);
  }
}

// Require authentication — only logged-in users (at checkout) can fetch rates
export const POST = withAuth(handler);
