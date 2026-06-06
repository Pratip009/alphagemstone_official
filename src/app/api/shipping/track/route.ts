/**
 * POST /api/shipping/track
 * Universal tracking endpoint — auto-detects carrier from tracking number format
 * and routes to the appropriate carrier service.
 *
 * Body: { "trackingNumber": "1Z999AA10123456784" }
 *    or { "trackingNumber": "...", "carrier": "ups" }  ← force a specific carrier
 */

import { NextRequest } from "next/server";
import { trackUspsPackage } from "@/services/usps.service";
import { trackUpsPackage } from "@/services/ups.service";
import { apiError, apiSuccess } from "@/lib/api-response";

// Minimal carrier detection heuristics
// ─────────────────────────────────────
// UPS:  starts with 1Z, 18 alphanum
// USPS: starts with 9, 20-22 digits; or starts with 7X, EA, EC, CP (intl)
// FedEx: 12 or 15 digits; or 20-22 digits starting with 96/98
function detectCarrier(tn: string): "ups" | "usps" | "fedex" | null {
  if (/^1Z[0-9A-Z]{16}$/i.test(tn)) return "ups";
  if (/^9[0-9]{19,21}$/.test(tn)) return "usps";
  if (/^(7[0-9]{19}|[A-Z]{2}[0-9]{9}US)$/.test(tn)) return "usps";
  if (/^(96|98)[0-9]{18,20}$/.test(tn)) return "fedex";
  if (/^[0-9]{12}$/.test(tn) || /^[0-9]{15}$/.test(tn)) return "fedex";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { trackingNumber, carrier: forceCarrier } = await req.json();

    if (!trackingNumber?.trim()) return apiError("trackingNumber is required", 400);

    const tn = trackingNumber.trim().toUpperCase();
    const carrier = forceCarrier?.toLowerCase() ?? detectCarrier(tn);

    if (!carrier) {
      return apiError(
        "Could not detect carrier from tracking number. Provide a 'carrier' field: 'ups', 'usps', or 'fedex'.",
        400
      );
    }

    switch (carrier) {
      case "ups": {
        const tracking = await trackUpsPackage(tn);
        return apiSuccess(tracking);
      }
      case "usps": {
        const tracking = await trackUspsPackage(tn);
        return apiSuccess(tracking);
      }
      case "fedex": {
  const { trackFedExShipment } = await import("@/services/fedex.service");
  const tracking = await trackFedExShipment(tn);
  return apiSuccess(tracking);
}
      default:
        return apiError(`Unknown carrier: ${carrier}`, 400);
    }
  } catch (err: any) {
    console.error("[shipping/track]", err);
    return apiError(err.message ?? "Tracking failed", 500);
  }
}
