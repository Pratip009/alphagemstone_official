// ─── Shared Shipping Types ────────────────────────────────────────────────────
// Used across FedEx, USPS, and UPS services

export interface ShippingAddress {
  fullName?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;           // 2-letter US state code
  postalCode: string;
  country: string;         // "US"
  phone?: string;
  email?: string;
}

export interface PackageDimensions {
  weightLbs: number;       // total weight in pounds (decimals ok, e.g. 1.5)
  lengthIn: number;        // length in inches
  widthIn: number;         // width in inches
  heightIn: number;        // height in inches
  declaredValueUsd?: number;  // for insurance / declared value
  description?: string;
}

export interface ShippingRate {
  carrier: "FedEx" | "USPS" | "UPS";
  service: string;         // e.g. "Priority Mail", "Ground", "2Day"
  serviceCode?: string;    // carrier internal code
  rate: number;            // in USD
  currency: "USD";
  estimatedDays: number | null;
  estimatedDelivery: string | null;  // human-readable date or range
  transitTime?: string;
  guaranteed?: boolean;
}

export interface TrackingEvent {
  timestamp: string;
  description: string;
  location: string;
  signedBy?: string;
}

export interface TrackingInfo {
  carrier: "FedEx" | "USPS" | "UPS";
  trackingNumber: string;
  status: string;
  currentLocation: string;
  lastUpdate: string;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
  deliveredAt?: string;
  signedBy?: string;
}

// ─── Aggregated rate response ─────────────────────────────────────────────────

export interface AllCarrierRates {
  fedex: ShippingRate[];
  usps: ShippingRate[];
  ups: ShippingRate[];
  errors: { carrier: string; message: string }[];
}
