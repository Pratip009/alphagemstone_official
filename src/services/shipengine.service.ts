/**
 * ShipStation V2 API Service
 * ───────────────────────────
 * All ShipStation V2 REST API interactions live here:
 *   getShipEngineRates        — fetch rates for a shipment
 *   trackShipEnginePackage    — track by label ID (V2 has no carrier_code+tracking_number
 *                                endpoint yet — see note below)
 *   purchaseLabelFromRate     — buy a label using a rate ID
 *   validateShipEngineAddress — validate/normalize an address
 *
 * Docs: https://docs.shipstation.com
 * Base URL: https://api.shipstation.com/v2
 *
 * Required env var: SHIPSTATION_API_KEY
 *   Generate this from your ShipStation.com account (Settings → API Keys → V2 API Key),
 *   NOT from app.shipengine.com — those are separate accounts.
 * Optional env var: SHIPSTATION_CARRIER_IDS (comma-separated carrier IDs from dashboard)
 *
 * Function names are kept identical to the old ShipEngine version so
 * src/services/order.service.ts doesn't need any changes.
 */

import type {
  ShippingAddress,
  PackageDimensions,
  ShippingRate,
  TrackingInfo,
  TrackingEvent,
} from '@/types/shipping';

const SHIPSTATION_BASE_URL = 'https://api.shipstation.com/v2';

// ─── Low-level fetch helper ────────────────────────────────────────────────────

function getApiKey(): string {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  if (!apiKey) {
    throw new Error(
      'SHIPSTATION_API_KEY is not set. Add it to your .env.local file. ' +
      'Generate a V2 API key at https://www.shipstation.com (Settings → API Keys).'
    );
  }
  return apiKey;
}

async function shipstationFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SHIPSTATION_BASE_URL}${path}`, {
      ...options,
      headers: {
        'API-Key': getApiKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (err: any) {
    throw new Error(`ShipStation request failed (network error): ${err?.message ?? err}`);
  }

  const raw = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  if (!res.ok) {
    const message =
      body?.errors?.[0]?.message ??
      body?.message ??
      (typeof body === 'string' && body) ??
      `ShipStation API error (status ${res.status})`;

    if (res.status === 401 || body?.errors?.[0]?.error_code === 'invalid_billing_plan') {
      throw new Error(
        `ShipStation rejected the request — your account/API key likely lacks access ` +
        `to this feature (billing plan restriction). Message: ${message}. ` +
        `Check https://www.shipstation.com account settings for plan/feature access.`
      );
    }
    throw new Error(`ShipStation request failed: ${message}`);
  }

  return body as T;
}

// ─── Address mapper ───────────────────────────────────────────────────────────

function toShipStationAddress(addr: ShippingAddress) {
  return {
    name: addr.fullName ?? '',
    phone: addr.phone ?? '',
    company_name: addr.company ?? '',
    address_line1: addr.street1,
    address_line2: addr.street2 ?? '',
    city_locality: addr.city,
    state_province: addr.state,
    postal_code: addr.postalCode,
    country_code: (addr.country ?? 'US').toUpperCase(),
    address_residential_indicator: (
      addr.residential === true ? 'yes' :
      addr.residential === false ? 'no' : 'unknown'
    ) as 'unknown' | 'yes' | 'no',
  };
}

// ─── Get Rates ────────────────────────────────────────────────────────────────

interface ShipStationRate {
  rate_id: string;
  rate_type: string;
  carrier_id: string;
  carrier_code?: string;
  carrier_friendly_name?: string;
  carrier_nickname?: string;
  service_type?: string;
  service_code?: string;
  shipping_amount?: { currency: string; amount: number };
  delivery_days?: number | null;
  estimated_delivery_date?: string | null;
  guaranteed_service?: boolean;
  negotiated_rate?: boolean;
  error_messages?: unknown[];
}

interface RatesResponse {
  rate_response?: { rates?: ShipStationRate[] };
  rates?: ShipStationRate[];
}

export async function getShipEngineRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<ShippingRate[]> {
  const carrierIds = await resolveCarrierIds();

  if (carrierIds.length === 0) {
    throw new Error(
      'No carriers are connected to this ShipStation account. ' +
      'Add at least one carrier in your ShipStation account settings, ' +
      'or set SHIPSTATION_CARRIER_IDS in your .env.local.'
    );
  }

  const payload = {
    shipment: {
      validate_address: 'no_validation',
      ship_from: toShipStationAddress(origin),
      ship_to: toShipStationAddress(destination),
      packages: [
        {
          weight: { value: pkg.weightLbs, unit: 'pound' },
          dimensions: {
            length: pkg.lengthIn,
            width: pkg.widthIn,
            height: pkg.heightIn,
            unit: 'inch',
          },
          ...(pkg.declaredValueUsd
            ? { insured_value: { currency: 'usd', amount: pkg.declaredValueUsd } }
            : {}),
        },
      ],
    },
    rate_options: { carrier_ids: carrierIds },
  };

  const result = await shipstationFetch<RatesResponse | ShipStationRate[]>('/rates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const rawRates: ShipStationRate[] = Array.isArray(result)
    ? result
    : (result.rate_response?.rates ?? result.rates ?? []);

  const rates: ShippingRate[] = rawRates
    .filter((r) => r.rate_type === 'shipment' && (!r.error_messages || r.error_messages.length === 0))
    .map((r): ShippingRate => ({
      carrier: r.carrier_friendly_name ?? r.carrier_id ?? 'Unknown',
      carrierId: r.carrier_id ?? '',
      service: r.service_type ?? r.service_code ?? '',
      serviceCode: r.service_code ?? '',
      rateId: r.rate_id ?? '',
      rate: r.shipping_amount?.amount ?? 0,
      currency: 'USD',
      estimatedDays: r.delivery_days ?? null,
      estimatedDelivery: r.estimated_delivery_date
        ? new Date(r.estimated_delivery_date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : null,
      guaranteed: r.guaranteed_service ?? false,
      negotiatedRate: r.negotiated_rate ?? false,
    }))
    .sort((a, b) => a.rate - b.rate);

  return rates;
}

// ─── Retry helper for 429s ────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 2000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isTooManyRequests =
        err?.message?.toLowerCase().includes('too many requests') ||
        err?.message?.toLowerCase().includes('rate_limit_exceeded') ||
        err?.statusCode === 429;

      if (!isTooManyRequests || attempt === maxRetries) break;

      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

// ─── Track Package ────────────────────────────────────────────────────────────
//
// IMPORTANT: As of this writing, ShipStation's V2 API only exposes tracking via
// GET /v2/labels/{label_id}/track — there is no confirmed carrier_code +
// tracking_number endpoint in V2 yet (V1 had one at api.shipengine.com/v1/tracking).
// This means callers now need the ShipStation label_id, not just a tracking number.
//
// If your order flow only stores trackingNumber today, you'll need to also store
// labelId at purchase time (see purchaseLabelFromRate below) and pass that here
// instead. Check https://docs.shipstation.com/tracking for any newer endpoint
// before relying on this.

interface ShipStationTrackEvent {
  occurred_at?: string;
  description?: string;
  city_locality?: string;
  state_province?: string;
  country_code?: string;
}

interface ShipStationTrackResponse {
  tracking_number?: string;
  status_description?: string;
  status_code?: string;
  estimated_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  events?: ShipStationTrackEvent[];
}

export async function trackShipEnginePackage(labelId: string): Promise<TrackingInfo> {
  const result = await withRetry(() =>
    shipstationFetch<ShipStationTrackResponse>(`/labels/${labelId}/track`)
  );

  const events: TrackingEvent[] = (result.events ?? []).map((e) => ({
    timestamp: e.occurred_at ? new Date(e.occurred_at).toLocaleString('en-US') : '',
    description: e.description ?? '',
    location: [e.city_locality, e.state_province, e.country_code].filter(Boolean).join(', '),
  }));

  return {
    carrier: '', // not returned by the track endpoint directly; pull from the label if needed
    trackingNumber: result.tracking_number ?? '',
    status: result.status_description ?? result.status_code ?? 'Unknown',
    currentLocation: events[0]?.location ?? 'Unknown',
    lastUpdate: events[0]?.timestamp ?? 'Unknown',
    estimatedDelivery: result.estimated_delivery_date
      ? new Date(result.estimated_delivery_date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null,
    events,
    deliveredAt: result.actual_delivery_date
      ? new Date(result.actual_delivery_date).toLocaleString('en-US')
      : undefined,
  };
}

// ─── Purchase Label ───────────────────────────────────────────────────────────

interface ShipStationLabelResponse {
  label_id: string;
  tracking_number: string;
  carrier_id: string;
  service_code: string;
  ship_date: string;
  label_download?: { pdf?: string; png?: string; zpl?: string; href?: string };
}

export async function purchaseLabelFromRate(rateId: string): Promise<{
  labelId: string;
  trackingNumber: string;
  labelUrl: string;
  carrierId: string;
  serviceCode: string;
  shipDate: string;
}> {
  const label = await shipstationFetch<ShipStationLabelResponse>(`/labels/rates/${rateId}`, {
    method: 'POST',
    body: JSON.stringify({ label_format: 'pdf', label_layout: '4x6' }),
  });

  return {
    labelId: label.label_id ?? '',
    trackingNumber: label.tracking_number ?? '',
    labelUrl: label.label_download?.pdf ?? label.label_download?.href ?? '',
    carrierId: label.carrier_id ?? '',
    serviceCode: label.service_code ?? '',
    shipDate: label.ship_date ?? '',
  };
}

// ─── Validate Address ─────────────────────────────────────────────────────────

interface ShipStationAddressValidationResult {
  status: string; // "verified" | "warning" | "error" | "unverified"
  messages?: (string | { message?: string })[];
  matched_address?: {
    name?: string;
    company_name?: string;
    address_line1?: string;
    address_line2?: string;
    city_locality?: string;
    state_province?: string;
    postal_code?: string;
    country_code?: string;
  };
}

export async function validateShipEngineAddress(addr: ShippingAddress): Promise<{
  valid: boolean;
  normalized?: ShippingAddress;
  messages: string[];
}> {
  const [result] = await shipstationFetch<ShipStationAddressValidationResult[]>('/addresses/validate', {
    method: 'POST',
    body: JSON.stringify([toShipStationAddress(addr)]),
  }) as unknown as ShipStationAddressValidationResult[];

  const valid = result.status === 'verified';
  const messages = (result.messages ?? []).map((m) => (typeof m === 'string' ? m : m.message ?? String(m)));

  let normalized: ShippingAddress | undefined;
  if (valid && result.matched_address) {
    const n = result.matched_address;
    normalized = {
      fullName: n.name ?? addr.fullName,
      company: n.company_name ?? addr.company,
      street1: n.address_line1 ?? addr.street1,
      street2: n.address_line2 ?? addr.street2,
      city: n.city_locality ?? addr.city,
      state: n.state_province ?? addr.state,
      postalCode: n.postal_code ?? addr.postalCode,
      country: n.country_code ?? addr.country,
    };
  }

  return { valid, normalized, messages };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ShipStationCarrier {
  carrier_id: string;
  friendly_name?: string;
}

let _cachedCarrierIds: string[] | null = null;

async function resolveCarrierIds(): Promise<string[]> {
  const fromEnv = (process.env.SHIPSTATION_CARRIER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  if (_cachedCarrierIds !== null) return _cachedCarrierIds;

  const data = await shipstationFetch<{ carriers: ShipStationCarrier[] }>('/carriers');
  _cachedCarrierIds = (data.carriers ?? []).map((c) => c.carrier_id).filter(Boolean);

  return _cachedCarrierIds;
}