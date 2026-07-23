/**
 * shipping-config.ts
 * ──────────────────
 * Store origin address and default package dimensions.
 * These are used as defaults when fetching rates at checkout.
 *
 * Override any value via environment variables in .env.local.
 */

import type { ShippingAddress, PackageDimensions } from '@/types/shipping';

export const STORE_ORIGIN: ShippingAddress = {
  fullName:   'Alpha Gemstone Fulfilment',
  street1:    process.env.STORE_STREET1  ?? '123 Diamond Way',
  city:       process.env.STORE_CITY     ?? 'New York',
  state:      process.env.STORE_STATE    ?? 'NY',
  postalCode: process.env.STORE_POSTAL   ?? '10001',
  country:    process.env.STORE_COUNTRY  ?? 'US',
  phone:      process.env.STORE_PHONE    ?? '2125550100',
};

export const DEFAULT_PACKAGE: PackageDimensions = {
  weightLbs:        parseFloat(process.env.DEFAULT_WEIGHT_LBS     ?? '0.5'),
  lengthIn:         parseFloat(process.env.DEFAULT_LENGTH_IN       ?? '6'),
  widthIn:          parseFloat(process.env.DEFAULT_WIDTH_IN        ?? '4'),
  heightIn:         parseFloat(process.env.DEFAULT_HEIGHT_IN       ?? '2'),
  declaredValueUsd: parseFloat(process.env.DEFAULT_DECLARED_VALUE  ?? '500'),
  description:      'Gemstone jewellery',
};