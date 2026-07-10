/**
 * ShipEngine Service
 * ──────────────────
 * All ShipEngine SDK interactions live here:
 *   getShipEngineRates        — fetch rates for a shipment
 *   trackShipEnginePackage    — track by tracking number + carrier code
 *   purchaseLabelFromRate     — buy a label using a rate ID
 *   validateShipEngineAddress — validate/normalize an address
 *
 * Required env var: SHIPENGINE_API_KEY (sandbox keys start with "TEST_")
 * Optional env var: SHIPENGINE_CARRIER_IDS (comma-separated carrier IDs from dashboard)
 */

import ShipEngine from 'shipengine';
import type {
  ShippingAddress,
  PackageDimensions,
  ShippingRate,
  TrackingInfo,
  TrackingEvent,
} from '@/types/shipping';

// ─── Client singleton ─────────────────────────────────────────────────────────

function getClient(): InstanceType<typeof ShipEngine> {
  const apiKey = process.env.SHIPENGINE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'SHIPENGINE_API_KEY is not set. Add it to your .env.local file.'
    );
  }
  return new ShipEngine({ apiKey, retries: 2, timeout: 30_000 });
}

// ─── Address mapper ───────────────────────────────────────────────────────────

function toShipEngineAddress(addr: ShippingAddress) {
  return {
    name:          addr.fullName   ?? '',
    phone:         addr.phone      ?? '',
    companyName:   addr.company    ?? '',
    addressLine1:  addr.street1,
    addressLine2:  addr.street2    ?? '',
    cityLocality:  addr.city,
    stateProvince: addr.state,
    postalCode:    addr.postalCode,
    // ShipEngine requires a strict Country code union — cast after normalising to uppercase
    countryCode:   (addr.country ?? 'US').toUpperCase() as 'US' & string,
    // Default to 'unknown'; ShipEngine uses this to optimise routing and rates
    addressResidentialIndicator: (
      addr.residential === true  ? 'yes' :
      addr.residential === false ? 'no'  : 'unknown'
    ) as 'unknown' | 'yes' | 'no',
  };
}

// ─── Get Rates ────────────────────────────────────────────────────────────────

export async function getShipEngineRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<ShippingRate[]> {
  const client = getClient();

  const carrierIds = await resolveCarrierIds(client);

  const shipment = {
    shipFrom: toShipEngineAddress(origin),
    shipTo:   toShipEngineAddress(destination),
    packages: [
      {
        weight: {
          value: pkg.weightLbs,
          unit:  'pound',
        },
        dimensions: {
          length: pkg.lengthIn,
          width:  pkg.widthIn,
          height: pkg.heightIn,
          unit:   'inch',
        },
        ...(pkg.declaredValueUsd
          ? { insuredValue: { currency: 'usd' as const, amount: pkg.declaredValueUsd } }
          : {}),
      },
    ],
  };

  const payload = carrierIds.length > 0
    ? { shipment, rateOptions: { carrierIds } }
    : { shipment };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  try {
    result = await client.getRatesWithShipmentDetails(payload as any);
  } catch (err: any) {
    // shipengine-js throws an unhelpful TypeError ("reading 'name'") when the
    // API returns an error_type it doesn't recognize — this happens when the
    // ShipEngine account/API key lacks access to the Rates API (billing plan
    // restriction). Surface something actionable instead of a raw crash.
    const raw = err?.message ?? String(err);
    if (raw.includes("reading 'name'") || raw.includes('undefined')) {
      throw new Error(
        'ShipEngine rejected the rate request — your account/API key likely ' +
        'lacks access to the Rates API (billing plan restriction). ' +
        'Check https://app.shipengine.com/settings for plan/feature access.'
      );
    }
    throw new Error(`ShipEngine rate request failed: ${raw}`);
  }

  const rates: ShippingRate[] = (result.rateResponse?.rates ?? [])
    .filter(
      (r: any) =>
        r.rateType === 'shipment' &&
        (!r.errorMessages || r.errorMessages.length === 0)
    )
    .map((r: any): ShippingRate => ({
      carrier:          r.carrierFriendlyName ?? r.carrierId ?? 'Unknown',
      carrierId:        r.carrierId           ?? '',
      service:          r.serviceType         ?? r.serviceCode ?? '',
      serviceCode:      r.serviceCode         ?? '',
      rateId:           r.rateId              ?? '',
      rate:             r.shippingAmount?.amount ?? 0,
      currency:         'USD',
      estimatedDays:    r.deliveryDays        ?? null,
      estimatedDelivery: r.estimatedDeliveryDate
        ? new Date(r.estimatedDeliveryDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month:   'short',
            day:     'numeric',
          })
        : null,
      guaranteed:    r.guaranteedService ?? false,
      negotiatedRate: r.negotiatedRate   ?? false,
    }))
    .sort((a: { rate: number; }, b: { rate: number; }) => a.rate - b.rate);

  return rates;
}

// ─── Rate-limit-aware fetch with exponential backoff ─────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isTooManyRequests =
        err?.message?.toLowerCase().includes('too many requests') ||
        err?.code === 'rate_limit_exceeded' ||
        err?.statusCode === 429;

      if (!isTooManyRequests || attempt === maxRetries) break;

      // Exponential back-off: 2 s, 4 s, 8 s …
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

// ─── Track Package ────────────────────────────────────────────────────────────

export async function trackShipEnginePackage(
  trackingNumber: string,
  carrierCode?: string
): Promise<TrackingInfo> {
  const client = getClient();

  const resolvedCarrier = carrierCode ?? inferCarrierCode(trackingNumber);

  // Wrap in retry logic to handle ShipEngine "Too Many Requests" (429) errors
  const result: any = await withRetry(() =>
    client.trackUsingCarrierCodeAndTrackingNumber({
      carrierCode:    resolvedCarrier,
      trackingNumber,
    })
  );

  const events: TrackingEvent[] = (result.events ?? []).map((e: any) => ({
    timestamp: e.occurredAt
      ? new Date(e.occurredAt).toLocaleString('en-US')
      : '',
    description: e.description ?? e.eventCode ?? '',
    location:    [e.cityLocality, e.stateProvince, e.countryCode]
      .filter(Boolean)
      .join(', '),
  }));

  return {
    carrier:         result.carrierStatusDescription ?? resolvedCarrier,
    trackingNumber,
    status:          result.statusDescription ?? result.statusCode ?? 'Unknown',
    currentLocation: events[0]?.location ?? 'Unknown',
    lastUpdate:      events[0]?.timestamp ?? 'Unknown',
    estimatedDelivery: result.estimatedDeliveryDate
      ? new Date(result.estimatedDeliveryDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month:   'short',
          day:     'numeric',
        })
      : null,
    events,
    deliveredAt: result.actualDeliveryDate
      ? new Date(result.actualDeliveryDate).toLocaleString('en-US')
      : undefined,
  };
}

// ─── Purchase Label ───────────────────────────────────────────────────────────

export async function purchaseLabelFromRate(rateId: string): Promise<{
  labelId:       string;
  trackingNumber: string;
  labelUrl:      string;
  carrierId:     string;
  serviceCode:   string;
  shipDate:      string;
}> {
  const client = getClient();

  const label: any = await client.createLabelFromRate({ rateId });

  return {
    labelId:        label.labelId        ?? '',
    trackingNumber: label.trackingNumber ?? '',
    labelUrl:       label.labelDownload?.href ?? '',
    carrierId:      label.carrierId      ?? '',
    serviceCode:    label.serviceCode    ?? '',
    shipDate:       label.shipDate       ?? '',
  };
}

// ─── Validate Address ─────────────────────────────────────────────────────────

export async function validateShipEngineAddress(addr: ShippingAddress): Promise<{
  valid:      boolean;
  normalized?: ShippingAddress;
  messages:  string[];
}> {
  const client = getClient();

  const [result]: any[] = await client.validateAddresses([
    toShipEngineAddress(addr),
  ]);

  const valid    = result.status === 'verified';
  const messages = (result.messages ?? []).map((m: any) =>
    typeof m === 'string' ? m : (m.message ?? String(m))
  );

  let normalized: ShippingAddress | undefined;
  if (valid && result.normalizedAddress) {
    const n = result.normalizedAddress as any;
    normalized = {
      fullName:   n.name          ?? addr.fullName,
      company:    n.company       ?? addr.company,
      street1:    n.addressLine1  ?? addr.street1,
      street2:    n.addressLine2  ?? addr.street2,
      city:       n.cityLocality  ?? addr.city,
      state:      n.stateProvince ?? addr.state,
      postalCode: n.postalCode    ?? addr.postalCode,
      country:    n.countryCode   ?? addr.country,
    };
  }

  return { valid, normalized, messages };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns carrier IDs to use for rate requests.
 *
 * Priority:
 *   1. SHIPENGINE_CARRIER_IDS env var (comma-separated) — fastest, no extra API call
 *   2. Auto-fetched from the account via listCarriers() — cached in memory for the
 *      lifetime of the server process so it only hits the API once.
 *
 * ShipEngine's API (and sandbox) requires at least one carrier ID in rate_options;
 * it does NOT fall back to "all carriers" when the field is omitted.
 *
 * Find your carrier IDs at: https://app.shipengine.com/settings/carriers
 */
let _cachedCarrierIds: string[] | null = null;

async function resolveCarrierIds(client: InstanceType<typeof ShipEngine>): Promise<string[]> {
  // 1. Env var takes priority
  const fromEnv = (process.env.SHIPENGINE_CARRIER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  // 2. Return cached value from a previous call
  if (_cachedCarrierIds !== null) return _cachedCarrierIds;

  // 3. Fetch from account and cache
  try {
    const carriers = await client.listCarriers();
    _cachedCarrierIds = (carriers ?? [])
      .map((c: any) => c.carrierId as string)
      .filter(Boolean);

    if (_cachedCarrierIds.length === 0) {
      throw new Error(
        'No carriers are connected to this ShipEngine account. ' +
        'Add at least one carrier at https://app.shipengine.com/settings/carriers ' +
        'or set SHIPENGINE_CARRIER_IDS in your .env.local.'
      );
    }

    return _cachedCarrierIds;
  } catch (err: any) {
    // Re-throw with a clearer message if it's just the empty-list case
    if (err.message?.includes('No carriers')) throw err;
    throw new Error(`Failed to list ShipEngine carriers: ${err.message ?? err}`);
  }
}

/**
 * Infers ShipEngine carrier code from tracking number format.
 * Used as a fallback when caller doesn't provide a carrier code.
 *
 * ShipEngine carrier codes: "ups", "stamps_com" (USPS), "fedex", "dhl_express"
 */
function inferCarrierCode(tn: string): string {
  if (/^1Z[0-9A-Z]{16}$/i.test(tn))             return 'ups';
  if (/^9[0-9]{19,21}$/.test(tn))               return 'stamps_com';
  if (/^(7[0-9]{19}|[A-Z]{2}[0-9]{9}US)$/.test(tn)) return 'stamps_com';
  if (/^(96|98)[0-9]{18,20}$/.test(tn))         return 'fedex';
  if (/^[0-9]{12}$/.test(tn) || /^[0-9]{15}$/.test(tn)) return 'fedex';
  return 'stamps_com';
}