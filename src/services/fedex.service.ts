/**
 * fedex.service.ts
 * Core FedEx Ship API v1 wrapper.
 * Handles: OAuth token, rate quotes, shipment creation (label), and tracking.
 *
 * FedEx API docs: https://developer.fedex.com/api/en-us/catalog.html
 */

import type { ShippingRate, ShippingAddress, PackageDimensions, TrackingInfo } from '@/types/shipping';

const FEDEX_BASE_URL =
  process.env.FEDEX_MODE === 'production'
    ? 'https://apis.fedex.com'
    : 'https://apis-sandbox.fedex.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FedExAddress {
  streetLines: string[];
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
}

export interface FedExContact {
  personName: string;
  phoneNumber: string;
}

export interface FedExParty {
  contact: FedExContact;
  address: FedExAddress;
  accountNumber?: { value: string };
}

export interface FedExPackage {
  /** Weight in LB */
  weight: number;
  /** Dimensions in IN */
  length?: number;
  width?: number;
  height?: number;
  /** Declared value in USD */
  declaredValue?: number;
}

export interface CreateShipmentParams {
  recipient: FedExParty;
  packages: FedExPackage[];
  /** FedEx service type. Defaults to FEDEX_GROUND */
  serviceType?: string;
  /** Order reference for your records */
  customerReference?: string;
  /** USD value for insurance / declared value */
  insuredValue?: number;
}

export interface ShipmentResult {
  trackingNumber: string;
  labelBase64: string;       // PDF or PNG label, base64-encoded
  labelFormat: string;       // 'PDF' | 'PNG'
  shipmentId: string;
  serviceType: string;
  estimatedDelivery?: string;
}

export interface TrackingResult {
  trackingNumber: string;
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  timestamp: string;
  eventType: string;
  description: string;
  location?: string;
}

// ─── FedEx service code → human label ────────────────────────────────────────

const FEDEX_SERVICE_NAMES: Record<string, string> = {
  FEDEX_GROUND:             'FedEx Ground',
  FEDEX_2_DAY:              'FedEx 2Day',
  FEDEX_2_DAY_AM:           'FedEx 2Day AM',
  PRIORITY_OVERNIGHT:       'FedEx Priority Overnight',
  STANDARD_OVERNIGHT:       'FedEx Standard Overnight',
  FIRST_OVERNIGHT:          'FedEx First Overnight',
  FEDEX_EXPRESS_SAVER:      'FedEx Express Saver',
  SMART_POST:               'FedEx SmartPost',
  GROUND_HOME_DELIVERY:     'FedEx Home Delivery',
  FEDEX_FREIGHT_PRIORITY:   'FedEx Freight Priority',
};

// ─── Token Cache ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${FEDEX_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.FEDEX_CLIENT_ID!,
      client_secret: process.env.FEDEX_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FedEx auth failed: ${res.status} — ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token as string;
  // Expire 60 s before actual expiry to avoid edge cases
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ─── Shipper (your business) ──────────────────────────────────────────────────

function getShipper(): FedExParty {
  return {
    contact: {
      personName: process.env.FEDEX_SHIPPER_NAME!,
      phoneNumber: process.env.FEDEX_SHIPPER_PHONE!,
    },
    address: {
      streetLines: [process.env.FEDEX_SHIPPER_STREET!],
      city: process.env.FEDEX_SHIPPER_CITY!,
      stateOrProvinceCode: process.env.FEDEX_SHIPPER_STATE!,
      postalCode: process.env.FEDEX_SHIPPER_ZIP!,
      countryCode: process.env.FEDEX_SHIPPER_COUNTRY ?? 'US',
    },
    accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER! },
  };
}

// ─── Rate Quotes ──────────────────────────────────────────────────────────────

/**
 * Get FedEx rate quotes for a shipment.
 * Uses the "LIST" rate type (retail rates) — switch to "ACCOUNT" for
 * negotiated rates if your FedEx account has them.
 */
export async function getFedExRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<ShippingRate[]> {
  const token = await getAccessToken();

  const body = {
    accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER! },
    requestedShipment: {
      shipper: {
        address: {
          streetLines: [origin.street1],
          city: origin.city,
          stateOrProvinceCode: origin.state,
          postalCode: origin.postalCode,
          countryCode: origin.country,
        },
      },
      recipient: {
        address: {
          streetLines: [destination.street1],
          city: destination.city,
          stateOrProvinceCode: destination.state,
          postalCode: destination.postalCode,
          countryCode: destination.country,
          residential: true,
        },
      },
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      rateRequestType: ['LIST'],
      requestedPackageLineItems: [
        {
          weight: { units: 'LB', value: Math.max(0.1, pkg.weightLbs) },
          dimensions: {
            length: Math.ceil(pkg.lengthIn),
            width: Math.ceil(pkg.widthIn),
            height: Math.ceil(pkg.heightIn),
            units: 'IN',
          },
          ...(pkg.declaredValueUsd
            ? { declaredValue: { amount: pkg.declaredValueUsd, currency: 'USD' } }
            : {}),
        },
      ],
    },
  };

  const res = await fetch(`${FEDEX_BASE_URL}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FedEx rates failed: ${res.status} — ${text}`);
  }

  const data = await res.json();
  const ratedShipments: any[] =
    data.output?.rateReplyDetails ?? [];

  return ratedShipments
    .map((s: any): ShippingRate | null => {
      const serviceType: string = s.serviceType ?? '';
      const detail = s.ratedShipmentDetails?.[0];
      const rate = parseFloat(detail?.totalNetCharge ?? '0');
      const transitDays: number | null =
        s.operationalDetail?.transitTime
          ? parseInt(s.operationalDetail.transitTime.replace(/\D/g, ''), 10) || null
          : null;
      const commitDate: string | null =
        s.operationalDetail?.deliveryDate ?? null;

      if (!serviceType || isNaN(rate)) return null;

      return {
        carrier: 'FedEx',
        service: FEDEX_SERVICE_NAMES[serviceType] ?? serviceType.replace(/_/g, ' '),
        serviceCode: serviceType,
        rate,
        currency: 'USD',
        estimatedDays: transitDays,
        estimatedDelivery: commitDate ?? (transitDays ? `${transitDays} business day(s)` : null),
        guaranteed: !!s.commit?.label,
      };
    })
    .filter((r): r is ShippingRate => r !== null)
    .sort((a, b) => a.rate - b.rate);
}

// ─── Create Shipment (generate label) ────────────────────────────────────────

export async function createFedExShipment(
  params: CreateShipmentParams
): Promise<ShipmentResult> {
  const token = await getAccessToken();
  const shipper = getShipper();
  const serviceType = params.serviceType ?? 'FEDEX_GROUND';

  const requestedPackages = params.packages.map((pkg, i) => {
    const packageItem: Record<string, unknown> = {
      sequenceNumber: i + 1,
      weight: { units: 'LB', value: pkg.weight },
    };

    if (pkg.length && pkg.width && pkg.height) {
      packageItem.dimensions = {
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        units: 'IN',
      };
    }

    if (pkg.declaredValue) {
      packageItem.declaredValue = {
        amount: pkg.declaredValue,
        currency: 'USD',
      };
    }

    return packageItem;
  });

  const body = {
    labelResponseOptions: 'LABEL',
    requestedShipment: {
      shipper,
      recipients: [params.recipient],
      serviceType,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: {
          responsibleParty: {
            accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER! },
          },
        },
      },
      labelSpecification: {
        labelFormatType: 'COMMON2D',
        imageType: 'PDF',
        labelStockType: 'PAPER_4X6',
      },
      requestedPackageLineItems: requestedPackages,
      ...(params.customerReference && {
        customerReferences: [
          { customerReferenceType: 'CUSTOMER_REFERENCE', value: params.customerReference },
        ],
      }),
      ...(params.insuredValue && {
        totalDeclaredValue: { amount: params.insuredValue, currency: 'USD' },
      }),
    },
    accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER! },
  };

  const res = await fetch(`${FEDEX_BASE_URL}/ship/v1/shipments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FedEx shipment creation failed: ${res.status} — ${text}`);
  }

  const data = await res.json();

  const shipment = data.output?.transactionShipments?.[0];
  if (!shipment) throw new Error('FedEx returned no shipment data');

  const piece = shipment.pieceResponses?.[0];
  const trackingNumber: string =
    piece?.trackingNumber ?? shipment.masterTrackingNumber?.trackingNumber;
  const labelBase64: string = piece?.packageDocuments?.[0]?.encodedLabel ?? '';

  return {
    trackingNumber,
    labelBase64,
    labelFormat: 'PDF',
    shipmentId:
      shipment.shipmentAdvisoryDetails?.regulatoryAdvisory?.prohibitions?.[0] ??
      trackingNumber,
    serviceType: shipment.serviceType ?? serviceType,
    estimatedDelivery: shipment.operationalDetail?.deliveryDate,
  };
}

// ─── Track Shipment ───────────────────────────────────────────────────────────

export async function trackFedExShipment(trackingNumber: string): Promise<TrackingResult> {
  const token = await getAccessToken();

  const body = {
    includeDetailedScans: true,
    trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
  };

  const res = await fetch(`${FEDEX_BASE_URL}/track/v1/trackingnumbers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FedEx tracking failed: ${res.status} — ${text}`);
  }

  const data = await res.json();
  const result = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
  if (!result) throw new Error('No tracking result returned');

  const events: TrackingEvent[] = (result.scanEvents ?? []).map(
    (e: Record<string, unknown>) => ({
      timestamp: e.date as string,
      eventType: e.eventType as string,
      description: e.eventDescription as string,
      location: [
        (e.scanLocation as Record<string, string>)?.city,
        (e.scanLocation as Record<string, string>)?.stateOrProvinceCode,
        (e.scanLocation as Record<string, string>)?.countryCode,
      ]
        .filter(Boolean)
        .join(', '),
    })
  );

  return {
    trackingNumber,
    status: result.latestStatusDetail?.code ?? 'UNKNOWN',
    statusDescription: result.latestStatusDetail?.description ?? 'Unknown',
    estimatedDelivery: result.estimatedDeliveryTimeWindow?.window?.ends,
    actualDelivery: result.actualDeliveryTime,
    events,
  };
}

/**
 * trackFedExPackage — normalized wrapper used by the universal tracking route
 * and shipping aggregator. Returns TrackingInfo shape instead of TrackingResult.
 */
// Alias used by shipping.aggregator.ts (camelCase vs PascalCase reconciliation)
export const getFedexRates = getFedExRates;

export async function trackFedExPackage(trackingNumber: string): Promise<TrackingInfo> {
  const result = await trackFedExShipment(trackingNumber);
  return {
    carrier: 'FedEx',
    trackingNumber: result.trackingNumber,
    status: result.statusDescription,
    currentLocation: result.events[0]?.location ?? '',
    lastUpdate: result.events[0]?.timestamp ?? '',
    estimatedDelivery: result.estimatedDelivery ?? null,
    deliveredAt: result.actualDelivery,
    events: result.events.map((e) => ({
      timestamp: e.timestamp,
      description: e.description,
      location: e.location ?? '',
    })),
  };
}