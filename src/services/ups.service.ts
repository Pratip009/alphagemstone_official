/**
 * UPS Shipping Service
 * Uses UPS Developer API v2 (OAuth 2.0 + REST JSON)
 * Register at: https://developer.ups.com/
 *
 * Required env vars:
 *   UPS_CLIENT_ID=your_client_id
 *   UPS_CLIENT_SECRET=your_client_secret
 *   UPS_ACCOUNT_NUMBER=your_shipper_account_number   (6-char alphanumeric)
 *   UPS_BASE_URL=https://onlinetools.ups.com          (prod)
 *            or  https://wwwcie.ups.com               (sandbox/CIE)
 *
 * UPS_BASE_URL defaults to CIE (sandbox) if not set — set to
 * https://onlinetools.ups.com when going live.
 */

import { ShippingRate, ShippingAddress, PackageDimensions, TrackingInfo } from "@/types/shipping";

const UPS_BASE_URL = process.env.UPS_BASE_URL ?? "https://wwwcie.ups.com";
const UPS_CLIENT_ID = process.env.UPS_CLIENT_ID ?? "";
const UPS_CLIENT_SECRET = process.env.UPS_CLIENT_SECRET ?? "";
const UPS_ACCOUNT_NUMBER = process.env.UPS_ACCOUNT_NUMBER ?? "";

// ─── UPS service code → human label map ─────────────────────────────────────

const UPS_SERVICE_NAMES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "07": "UPS Worldwide Express",
  "08": "UPS Worldwide Expedited",
  "11": "UPS Standard",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early AM",
  "54": "UPS Worldwide Express Plus",
  "59": "UPS 2nd Day Air AM",
  "65": "UPS Worldwide Saver",
};

// ─── OAuth token cache (in-memory; acceptable for server-side Next.js) ───────

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getUpsAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const credentials = Buffer.from(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(`${UPS_BASE_URL}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`UPS OAuth failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  _tokenCache = {
    token: data.access_token,
    // subtract 60 s as safety buffer
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return _tokenCache.token;
}

async function upsRequest<T>(path: string, body: object, token: string): Promise<T> {
  const res = await fetch(`${UPS_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      transId: `gmstone-${Date.now()}`,
      transactionSrc: "gmstone-shop",
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  const json = await res.json();

  if (!res.ok) {
    const errMsg =
      json?.response?.errors?.[0]?.message ??
      json?.Fault?.detail?.Errors?.ErrorDetail?.PrimaryErrorCode?.Description ??
      `HTTP ${res.status}`;
    throw new Error(`UPS API error: ${errMsg}`);
  }

  return json as T;
}

// ─── Rates ───────────────────────────────────────────────────────────────────

export async function getUpsRates(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions
): Promise<ShippingRate[]> {
  const token = await getUpsAccessToken();

  const weightLbs = Math.ceil(pkg.weightLbs); // UPS wants whole lbs for ground

  const requestBody = {
    RateRequest: {
      Request: {
        SubVersion: "1703",
        RequestOption: "Shop", // "Shop" = get all service rates in one call
        TransactionReference: { CustomerContext: "gmstone-rate-shop" },
      },
      PickupType: { Code: "01" }, // Daily pickup
      CustomerClassification: { Code: "01" }, // Rates associated with shipper number
      Shipment: {
        Shipper: {
          Name: "GMStone Shop",
          ShipperNumber: UPS_ACCOUNT_NUMBER,
          Address: {
            AddressLine: [origin.street1],
            City: origin.city,
            StateProvinceCode: origin.state,
            PostalCode: origin.postalCode,
            CountryCode: origin.country,
          },
        },
        ShipTo: {
          Name: destination.fullName ?? "Customer",
          Address: {
            AddressLine: [destination.street1],
            City: destination.city,
            StateProvinceCode: destination.state,
            PostalCode: destination.postalCode,
            CountryCode: destination.country,
            ResidentialAddressIndicator: "",
          },
        },
        ShipFrom: {
          Name: "GMStone Shop",
          Address: {
            AddressLine: [origin.street1],
            City: origin.city,
            StateProvinceCode: origin.state,
            PostalCode: origin.postalCode,
            CountryCode: origin.country,
          },
        },
        Package: {
          PackagingType: { Code: "02" }, // Customer Supplied Package
          Dimensions: {
            UnitOfMeasurement: { Code: "IN" },
            Length: String(Math.ceil(pkg.lengthIn)),
            Width: String(Math.ceil(pkg.widthIn)),
            Height: String(Math.ceil(pkg.heightIn)),
          },
          PackageWeight: {
            UnitOfMeasurement: { Code: "LBS" },
            Weight: String(Math.max(1, weightLbs)),
          },
          ...(pkg.declaredValueUsd
            ? {
                PackageServiceOptions: {
                  DeclaredValue: {
                    CurrencyCode: "USD",
                    MonetaryValue: pkg.declaredValueUsd.toFixed(2),
                  },
                },
              }
            : {}),
        },
      },
    },
  };

  type UpsRateResponse = {
    RateResponse?: {
      RatedShipment?: Array<{
        Service: { Code: string };
        TotalCharges: { CurrencyCode: string; MonetaryValue: string };
        GuaranteedDelivery?: { BusinessDaysInTransit: string; DeliveryByTime: string };
        TimeInTransit?: { PickupDate: string; ServiceSummary: { EstimatedArrival: { Arrival: { Date: string; Time: string } } } };
        RatedShipmentAlert?: Array<{ Code: string; Description: string }>;
      }>;
    };
  };

  const data = await upsRequest<UpsRateResponse>("/api/rating/v2403/Shop", requestBody, token);

  const shipments = data?.RateResponse?.RatedShipment ?? [];

  return shipments
    .map((s): ShippingRate => {
      const serviceCode = s.Service?.Code;
      const rate = parseFloat(s.TotalCharges?.MonetaryValue ?? "0");
      const transitDays = s.GuaranteedDelivery?.BusinessDaysInTransit
        ? parseInt(s.GuaranteedDelivery.BusinessDaysInTransit, 10)
        : null;

      return {
        carrier: "UPS",
        service: UPS_SERVICE_NAMES[serviceCode] ?? `UPS Service ${serviceCode}`,
        serviceCode,
        rate,
        currency: "USD",
        estimatedDays: transitDays,
        estimatedDelivery: transitDays ? `${transitDays} business day(s)` : null,
        guaranteed: !!s.GuaranteedDelivery,
      };
    })
    .sort((a, b) => a.rate - b.rate);
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export async function trackUpsPackage(trackingNumber: string): Promise<TrackingInfo> {
  const token = await getUpsAccessToken();

  const res = await fetch(
    `${UPS_BASE_URL}/api/track/v1/details/${trackingNumber}?locale=en_US&returnSignature=false`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        transId: `gmstone-track-${Date.now()}`,
        transactionSrc: "gmstone-shop",
      },
      next: { revalidate: 0 },
    }
  );

  const json = await res.json();

  if (!res.ok) {
    const msg =
      json?.response?.errors?.[0]?.message ??
      json?.trackResponse?.shipment?.[0]?.warnings?.[0]?.message ??
      `HTTP ${res.status}`;
    throw new Error(`UPS tracking error: ${msg}`);
  }

  const shipment = json?.trackResponse?.shipment?.[0];
  const pkg = shipment?.package?.[0];

  if (!pkg) throw new Error("UPS: no package data in tracking response");

  const statusDescription = pkg.currentStatus?.description ?? "Unknown";
  const statusCode = pkg.currentStatus?.code ?? "";

  const deliveryDate = pkg.deliveryDate?.find((d: any) => d.type === "DEL")?.date ?? null;
  const scheduledDelivery = pkg.deliveryDate?.find((d: any) => d.type === "SCH")?.date ?? null;

  const activities = (pkg.activity ?? []).map((act: any) => ({
    timestamp: `${act.date ?? ""} ${act.time ?? ""}`.trim(),
    description: act.status?.description ?? "",
    location: [act.location?.address?.city, act.location?.address?.stateProvince]
      .filter(Boolean)
      .join(", "),
    signedBy: act.status?.code === "D" ? (pkg.deliveryInformation?.receivedBy ?? undefined) : undefined,
  }));

  return {
    carrier: "UPS",
    trackingNumber,
    status: statusDescription,
    currentLocation: activities[0]?.location ?? "",
    lastUpdate: activities[0]?.timestamp ?? "",
    estimatedDelivery: scheduledDelivery ?? deliveryDate ?? null,
    deliveredAt: deliveryDate ?? undefined,
    signedBy: pkg.deliveryInformation?.receivedBy ?? undefined,
    events: activities,
  };
}

// ─── Address Validation ───────────────────────────────────────────────────────

export async function validateUpsAddress(address: ShippingAddress): Promise<{
  valid: boolean;
  corrected?: ShippingAddress;
  quality?: string;
  error?: string;
}> {
  try {
    const token = await getUpsAccessToken();

    type UpsAvResponse = {
      XAVResponse?: {
        Response?: { ResponseStatus?: { Code: string; Description: string } };
        ValidAddressIndicator?: string;
        AmbiguousAddressIndicator?: string;
        NoCandidatesIndicator?: string;
        Candidate?: Array<{
          AddressKeyFormat: {
            AddressLine: string | string[];
            PoliticalDivision2: string;
            PoliticalDivision1: string;
            PostcodePrimaryLow: string;
            CountryCode: string;
          };
        }>;
      };
    };

    const data = await upsRequest<UpsAvResponse>(
      "/api/addressvalidation/v2/3", // level 3 = classification + candidate addresses
      {
        XAVRequest: {
          AddressKeyFormat: {
            ConsigneeName: address.fullName ?? "",
            AddressLine: [address.street1, address.street2].filter(Boolean),
            PoliticalDivision2: address.city,
            PoliticalDivision1: address.state,
            PostcodePrimaryLow: address.postalCode,
            CountryCode: address.country,
          },
        },
      },
      token
    );

    const xav = data?.XAVResponse;

    if (xav?.NoCandidatesIndicator) {
      return { valid: false, error: "Address not found" };
    }

    const candidate = xav?.Candidate?.[0]?.AddressKeyFormat;
    if (!candidate) {
      return { valid: !!xav?.ValidAddressIndicator };
    }

    const lines = Array.isArray(candidate.AddressLine)
      ? candidate.AddressLine
      : [candidate.AddressLine];

    return {
      valid: true,
      quality: xav?.AmbiguousAddressIndicator ? "ambiguous" : "valid",
      corrected: {
        ...address,
        street1: lines[0] ?? address.street1,
        street2: lines[1] ?? undefined,
        city: candidate.PoliticalDivision2 ?? address.city,
        state: candidate.PoliticalDivision1 ?? address.state,
        postalCode: candidate.PostcodePrimaryLow ?? address.postalCode,
      },
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

// ─── Shipment / Label Creation ────────────────────────────────────────────────

export interface UpsShipmentResult {
  trackingNumber: string;
  labelBase64: string;   // base64-encoded GIF/ZPL label
  labelFormat: string;   // "GIF" or "ZPL"
  shipmentId: string;
  serviceType: string;
  serviceCode: string;
  estimatedDelivery: string | null;
  createdAt: string;
  carrier: 'UPS';
}

/**
 * Creates a UPS shipment and generates a shipping label via the UPS Shipping v2403 API.
 * Uses the OAuth token obtained by getUpsAccessToken().
 *
 * Sandbox: set UPS_BASE_URL=https://wwwcie.ups.com
 * Production: set UPS_BASE_URL=https://onlinetools.ups.com
 */
export async function createUpsShipment(
  origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: PackageDimensions,
  options: { serviceCode?: string; customerRef?: string } = {}
): Promise<UpsShipmentResult> {
  const token = await getUpsAccessToken();
  const serviceCode = options.serviceCode ?? '03';  // '03' = UPS Ground

  const body = {
    ShipmentRequest: {
      Request: {
        RequestOption: 'nonvalidate',
        SubVersion: '2205',
        TransactionReference: { CustomerContext: options.customerRef ?? 'order' },
      },
      Shipment: {
        Description: pkg.description ?? 'Gemstone jewellery',
        Shipper: {
          Name: origin.fullName ?? 'Alpha Imports',
          AttentionName: origin.fullName ?? 'Alpha Imports',
          Phone: { Number: (origin.phone ?? '').replace(/\D/g, '') },
          ShipperNumber: UPS_ACCOUNT_NUMBER,
          Address: {
            AddressLine: [origin.street1, origin.street2 ?? ''].filter(Boolean),
            City: origin.city,
            StateProvinceCode: origin.state,
            PostalCode: origin.postalCode,
            CountryCode: origin.country,
          },
        },
        ShipTo: {
          Name: destination.fullName ?? '',
          AttentionName: destination.fullName ?? '',
          Phone: { Number: (destination.phone ?? '').replace(/\D/g, '') },
          Address: {
            AddressLine: [destination.street1, destination.street2 ?? ''].filter(Boolean),
            City: destination.city,
            StateProvinceCode: destination.state,
            PostalCode: destination.postalCode,
            CountryCode: destination.country,
          },
        },
        PaymentInformation: {
          ShipmentCharge: {
            Type: '01',
            BillShipper: { AccountNumber: UPS_ACCOUNT_NUMBER },
          },
        },
        Service: { Code: serviceCode },
        Package: {
          Packaging: { Code: '02' },  // Customer-supplied package
          Dimensions: {
            UnitOfMeasurement: { Code: 'IN' },
            Length: String(pkg.lengthIn),
            Width: String(pkg.widthIn),
            Height: String(pkg.heightIn),
          },
          PackageWeight: {
            UnitOfMeasurement: { Code: 'LBS' },
            Weight: String(pkg.weightLbs),
          },
          ...(pkg.declaredValueUsd
            ? { PackageServiceOptions: { DeclaredValue: { CurrencyCode: 'USD', MonetaryValue: String(pkg.declaredValueUsd) } } }
            : {}),
          ReferenceNumber: { Value: options.customerRef ?? '' },
        },
      },
      LabelSpecification: {
        LabelImageFormat: { Code: 'GIF' },
        HTTPUserAgent: 'Mozilla/4.5',
      },
    },
  };

  const res = await fetch(`${UPS_BASE_URL}/api/shipments/v2403/ship`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      transId: options.customerRef ?? 'order',
      transactionSrc: 'gmstone',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UPS Ship API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const result = data?.ShipmentResponse?.ShipmentResults;

  if (!result) throw new Error('UPS returned unexpected response shape');

  const pkg0 = result.PackageResults?.[0];
  const trackingNumber  = pkg0?.TrackingNumber ?? result.ShipmentIdentificationNumber ?? '';
  const labelBase64     = pkg0?.ShippingLabel?.GraphicImage ?? '';
  const labelFormat     = pkg0?.ShippingLabel?.ImageFormat?.Code ?? 'GIF';
  const shipmentId      = result.ShipmentIdentificationNumber ?? '';

  if (!trackingNumber) throw new Error('UPS did not return a tracking number');

  return {
    trackingNumber,
    labelBase64,
    labelFormat,
    shipmentId,
    serviceCode,
    serviceType: UPS_SERVICE_NAMES[serviceCode] ?? `UPS Service ${serviceCode}`,
    estimatedDelivery: result.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Date ?? null,
    createdAt: new Date().toISOString(),
    carrier: 'UPS',
  };
}