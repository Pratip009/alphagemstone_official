/**
 * shipping-config.ts
 * ──────────────────
 * Centralised shipping constants used across checkout and rate-fetch logic.
 *
 * STORE_ORIGIN   – the warehouse / fulfilment address that all shipments leave from.
 * DEFAULT_PACKAGE – default box dimensions used when calculating rates at checkout
 *                   (overridden per-order if you store per-product weights later).
 *
 * Update the values below to match your actual warehouse address and
 * typical package size before going live.
 */

import type { ShippingAddress, PackageDimensions } from '@/types/shipping';

// ─── Store / warehouse origin address ────────────────────────────────────────
// Replace with your real fulfilment address.
export const STORE_ORIGIN: ShippingAddress = {
  fullName: 'Alpha Imports Fulfilment',
  street1: process.env.STORE_STREET1 ?? '123 Diamond Way',
  city: process.env.STORE_CITY     ?? 'New York',
  state: process.env.STORE_STATE   ?? 'NY',
  postalCode: process.env.STORE_POSTAL ?? '10001',
  country: process.env.STORE_COUNTRY  ?? 'US',
  phone: process.env.STORE_PHONE     ?? '2125550100',
};

// ─── Default package dimensions ───────────────────────────────────────────────
// Gemstone / jewellery orders are typically small and light.
// Adjust weightLbs and dimensions to reflect your average shipment.
export const DEFAULT_PACKAGE: PackageDimensions = {
  weightLbs: parseFloat(process.env.DEFAULT_WEIGHT_LBS  ?? '0.5'),
  lengthIn:  parseFloat(process.env.DEFAULT_LENGTH_IN   ?? '6'),
  widthIn:   parseFloat(process.env.DEFAULT_WIDTH_IN    ?? '4'),
  heightIn:  parseFloat(process.env.DEFAULT_HEIGHT_IN   ?? '2'),
  declaredValueUsd: parseFloat(process.env.DEFAULT_DECLARED_VALUE ?? '500'),
  description: 'Gemstone jewellery',
};