 USPS + UPS Shipping Integration Guide

This document covers everything needed to integrate USPS and UPS alongside your existing FedEx setup.

---

## What's included in this PR

| File | Purpose |
|------|---------|
| `src/types/shipping.ts` | Shared types (ShippingRate, TrackingInfo, etc.) |
| `src/services/usps.service.ts` | USPS rates, tracking, address validation |
| `src/services/ups.service.ts` | UPS rates, tracking, address validation (OAuth 2.0) |
| `src/services/shipping.aggregator.ts` | Parallel multi-carrier rate fetcher |
| `src/app/api/shipping/usps/rates/route.ts` | POST /api/shipping/usps/rates |
| `src/app/api/shipping/usps/track/route.ts` | POST /api/shipping/usps/track |
| `src/app/api/shipping/usps/validate-address/route.ts` | POST /api/shipping/usps/validate-address |
| `src/app/api/shipping/ups/rates/route.ts` | POST /api/shipping/ups/rates |
| `src/app/api/shipping/ups/track/route.ts` | POST /api/shipping/ups/track |
| `src/app/api/shipping/ups/validate-address/route.ts` | POST /api/shipping/ups/validate-address |
| `src/app/api/shipping/rates/route.ts` | POST /api/shipping/rates (all carriers, auth required) |
| `src/app/api/shipping/track/route.ts` | POST /api/shipping/track (auto-detects carrier) |
| `src/components/shipping/ShippingRateSelector.tsx` | Checkout UI component |
| `src/components/shipping/OrderTracking.tsx` | Order detail tracking UI |
| `src/models/ORDER_SHIPPING_FIELDS.ts` | Schema fields to add to Order model |
| `SHIPPING_ENV_VARS.md` | Env var reference |

---

## Step-by-step integration

### 1. Add env vars

Copy from `SHIPPING_ENV_VARS.md` into `.env.local`:

```
USPS_USER_ID=...
USPS_BASE_URL=https://secure.shippingapis.com/ShippingAPI.dll

UPS_CLIENT_ID=...
UPS_CLIENT_SECRET=...
UPS_ACCOUNT_NUMBER=...
UPS_BASE_URL=https://wwwcie.ups.com   # swap to onlinetools.ups.com for prod
```

### 2. Update your FedEx service (one-time type alignment)

Your `fedex.service.ts` should export functions matching these signatures so the aggregator can call them:

```ts
// Ensure these exports exist in src/services/fedex.service.ts:
export async function getFedExRates(origin, destination, pkg): Promise<ShippingRate[]>
export async function trackFedExPackage(trackingNumber: string): Promise<TrackingInfo>
```

If your existing function names are different, either rename them or add re-exports:
```ts
// at the bottom of fedex.service.ts
export { getShippingRates as getFedExRates, trackPackage as trackFedExPackage };
```

### 3. Update Order model

Open `src/models/Order.ts` and add the fields from `src/models/ORDER_SHIPPING_FIELDS.ts`.
These store which carrier/service was selected at checkout and the tracking number once shipped.

### 4. Add shipping selector to checkout page

```tsx
// src/app/(shop)/checkout/page.tsx
import ShippingRateSelector from "@/components/shipping/ShippingRateSelector";
import { STORE_ORIGIN, DEFAULT_PACKAGE } from "@/lib/shipping-config";

// Inside your checkout form:
const [selectedShipping, setSelectedShipping] = useState(null);

<ShippingRateSelector
  origin={STORE_ORIGIN}
  destination={shippingAddress}   // from form state
  package={DEFAULT_PACKAGE}       // or calculate from cart weight
  onSelect={setSelectedShipping}
/>
```

Then include the selected rate when creating the order:

```ts
await fetch("/api/orders", {
  method: "POST",
  body: JSON.stringify({
    shippingAddress,
    paymentMethod: "paypal",
    shippingCarrier: selectedShipping.carrier,
    shippingService: selectedShipping.service,
    shippingServiceCode: selectedShipping.serviceCode,
    shippingRate: selectedShipping.rate,
    shippingEstimatedDays: selectedShipping.estimatedDays,
    shippingEstimatedDelivery: selectedShipping.estimatedDelivery,
  }),
});
```

### 5. Add tracking to order detail page

```tsx
// src/app/(shop)/orders/[id]/page.tsx
import OrderTracking from "@/components/shipping/OrderTracking";

{order.trackingNumber && (
  <OrderTracking
    trackingNumber={order.trackingNumber}
    carrier={order.shippingCarrier}
    trackingUrl={order.trackingUrl}
  />
)}
```

### 6. Admin: set tracking number when shipping

`PUT /api/admin/orders/:id` — send tracking number + optional URL:

```json
{
  "status": "shipped",
  "trackingNumber": "1Z999AA10123456784",
  "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456784"
}
```

---

## API Reference

### POST /api/shipping/rates
Fetch rates from all carriers. Requires `Authorization: Bearer <token>`.

```json
{
  "origin": { "street1": "100 Main St", "city": "New York", "state": "NY", "postalCode": "10001", "country": "US" },
  "destination": { "street1": "450 Rose Ave", "city": "Los Angeles", "state": "CA", "postalCode": "90291", "country": "US" },
  "package": { "weightLbs": 0.5, "lengthIn": 8, "widthIn": 6, "heightIn": 3 }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "byCarrier": {
      "fedex": [{ "carrier": "FedEx", "service": "FedEx Ground", "rate": 9.50, ... }],
      "usps":  [{ "carrier": "USPS", "service": "Priority Mail", "rate": 7.40, ... }],
      "ups":   [{ "carrier": "UPS", "service": "UPS Ground", "rate": 11.20, ... }]
    },
    "all": [ /* sorted cheapest-first */ ],
    "errors": []
  }
}
```

### POST /api/shipping/track
Auto-detects carrier from tracking number format.

```json
{ "trackingNumber": "9400111899223482392269" }
```

Response includes full event history, current location, estimated delivery.

### POST /api/shipping/usps/validate-address
Verify and standardise a US shipping address.

```json
{ "address": { "street1": "123 Main ST", "city": "boston", "state": "MA", "postalCode": "02108", "country": "US" } }
```

Response:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "corrected": { "street1": "123 MAIN ST", "city": "BOSTON", "state": "MA", "postalCode": "02108" }
  }
}
```

---

## Carrier comparison

| | USPS | UPS | FedEx |
|--|------|-----|-------|
| Auth | User ID (XML API) | OAuth 2.0 (REST) | OAuth 2.0 (REST) |
| Rate API | RateV4 (XML) | Rating v2403 (JSON) | Rate Quotes v1 (JSON) |
| Tracking | TrackV2 (XML) | Track v1 (JSON) | Track v1 (JSON) |
| Address Val | Verify (XML) | XAV v2 (JSON) | AV v1 (JSON) |
| Domestic rates | ✅ | ✅ | ✅ |
| International | ✅ (separate API) | ✅ | ✅ |
| Sandbox | staging URL | CIE environment | sandbox URL |

---

## Troubleshooting

**USPS rates returning no results**
- Check `USPS_USER_ID` is correct and registered for RateV4 (not just tracking).
- Package weight must be > 0.
- Both origin and destination must be valid 5-digit US zip codes.

**UPS 401 Unauthorized**
- Client ID / Secret wrong, or token endpoint changed. Check `UPS_BASE_URL`.
- Sandbox credentials only work against `wwwcie.ups.com`, not `onlinetools.ups.com`.

**UPS address validation 403**
- XAV (Address Validation) requires a separate entitlement. Log into your UPS developer account and enable it, or contact UPS support.

**Aggregator returns partial results**
- This is expected — each carrier failure is captured in `errors[]` and the others still return.
- Check server logs for the specific error message.