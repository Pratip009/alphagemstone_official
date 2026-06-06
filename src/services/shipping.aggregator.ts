/**
 * Shipping Aggregator Service
 * Calls FedEx, USPS, and UPS in parallel and returns a merged rate list.
 * Import this in checkout / shipping-rate API routes.
 */

import { AllCarrierRates, ShippingAddress, PackageDimensions, ShippingRate } from "@/types/shipping";
import {getFedExRates} from "@/services/fedex.service";
import { getUspsRates } from "@/services/usps.service";
import { getUpsRates } from "@/services/ups.service";

// ─── getAllCarrierRates ───────────────────────────────────────────────────────

/**
 * Fetches rates from all three carriers concurrently.
 * Individual carrier failures are captured in `errors[]` without aborting
 * the others — the frontend can show partial results gracefully.
 */
export async function getAllCarrierRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<AllCarrierRates> {
  const [fedexResult, uspsResult, upsResult] = await Promise.allSettled([
    getFedExRates(origin, destination, pkg),
    getUspsRates(origin, destination, pkg),
    getUpsRates(origin, destination, pkg),
  ]);

  const result: AllCarrierRates = { fedex: [], usps: [], ups: [], errors: [] };

  if (fedexResult.status === "fulfilled") {
    result.fedex = fedexResult.value;
  } else {
    result.errors.push({ carrier: "FedEx", message: fedexResult.reason?.message ?? "Unknown error" });
    console.error("[shipping] FedEx rate error:", fedexResult.reason);
  }

  if (uspsResult.status === "fulfilled") {
    result.usps = uspsResult.value;
  } else {
    result.errors.push({ carrier: "USPS", message: uspsResult.reason?.message ?? "Unknown error" });
    console.error("[shipping] USPS rate error:", uspsResult.reason);
  }

  if (upsResult.status === "fulfilled") {
    result.ups = upsResult.value;
  } else {
    result.errors.push({ carrier: "UPS", message: upsResult.reason?.message ?? "Unknown error" });
    console.error("[shipping] UPS rate error:", upsResult.reason);
  }

  return result;
}

/**
 * Returns a flat, sorted list of all available rates across carriers.
 * Useful for a "cheapest option" or "fastest option" UI.
 */
export async function getFlatRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<{ rates: ShippingRate[]; errors: { carrier: string; message: string }[] }> {
  const { fedex, usps, ups, errors } = await getAllCarrierRates(origin, destination, pkg);
  const rates = [...fedex, ...usps, ...ups].sort((a, b) => a.rate - b.rate);
  return { rates, errors };
}
