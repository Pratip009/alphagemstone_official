/**
 * POST /api/shipping/usps/validate-address
 * Validate and standardise a US address using USPS.
 *
 * Body: { "address": { "street1": "...", "city": "...", "state": "NY", "postalCode": "10001", "country": "US" } }
 */

import { NextRequest } from "next/server";
import { validateUspsAddress } from "@/services/usps.service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address?.street1 || !address?.postalCode) {
      return apiError("address.street1 and address.postalCode are required", 400);
    }
    const result = await validateUspsAddress(address);
    return apiSuccess(result);
  } catch (err: any) {
    console.error("[USPS validate-address]", err);
    return apiError(err.message ?? "Address validation failed", 500);
  }
}
