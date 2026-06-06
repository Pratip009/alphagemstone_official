/**
 * POST /api/shipping/ups/validate-address
 * Validate and standardise an address using UPS Address Validation API.
 *
 * Body: { "address": { "street1": "...", "city": "...", "state": "CA", "postalCode": "90210", "country": "US" } }
 */

import { NextRequest } from "next/server";
import { validateUpsAddress } from "@/services/ups.service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address?.street1 || !address?.postalCode) {
      return apiError("address.street1 and address.postalCode are required", 400);
    }
    const result = await validateUpsAddress(address);
    return apiSuccess(result);
  } catch (err: any) {
    console.error("[UPS validate-address]", err);
    return apiError(err.message ?? "UPS address validation failed", 500);
  }
}
