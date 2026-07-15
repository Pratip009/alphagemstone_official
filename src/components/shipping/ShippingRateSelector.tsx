'use client';

/**
 * ShippingRateSelector
 * ─────────────────────
 * Checkout component that:
 *  1. POSTs to /api/shipping/rates to fetch live ShipEngine rates
 *  2. Renders rates sorted cheapest-first (carrier, service, price, ETA)
 *  3. Calls onSelect(rate) so the parent can store the selection
 *
 * Usage:
 *   <ShippingRateSelector
 *     origin={STORE_ORIGIN}
 *     destination={shippingAddress}
 *     package={packageDims}
 *     onSelect={(rate) => setSelectedShipping(rate)}
 *   />
 *
 * Save the entire rate object at checkout:
 *   shippingCarrier, shippingService, shippingServiceCode,
 *   shippingRateId, shippingRate, shippingEstimatedDays, shippingEstimatedDelivery
 */

import { useState, useEffect, useCallback } from 'react';
import type { ShippingRate, ShippingAddress, PackageDimensions } from '@/types/shipping';

interface ShippingRateSelectorProps {
  origin:            ShippingAddress;
  destination:       ShippingAddress;
  package:           PackageDimensions;
  onSelect:          (rate: ShippingRate) => void;
  selectedRateId?:   string;
  selectedServiceCode?: string;
  className?:        string;
}

export default function ShippingRateSelector({
  origin,
  destination,
  package: pkg,
  onSelect,
  selectedRateId,
  selectedServiceCode: _selectedServiceCode,
  className = '',
}: ShippingRateSelectorProps) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [rates,    setRates]    = useState<ShippingRate[]>([]);
  const [selected, setSelected] = useState<string | null>(selectedRateId ?? null);

  const fetchRates = useCallback(async () => {
    if (!destination.postalCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ origin, destination, package: pkg }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? 'Failed to fetch rates');

      setRates(json.data.rates ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Could not load shipping rates');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, pkg]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  function handleSelect(rate: ShippingRate) {
    setSelected(rate.rateId);
    onSelect(rate);
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <span className="text-sm">Fetching shipping rates…</span>
        </div>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-4 ${className}`}>
        <p className="text-sm font-medium text-red-700">Could not load shipping rates</p>
        <p className="mt-1 text-xs text-red-500">{error}</p>
        <button
          onClick={fetchRates}
          className="mt-3 text-xs font-medium text-red-700 underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rates.length) return null;

  // ── Rate list ──────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-800">
        Shipping Method
      </h3>

      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
        {rates.map((rate) => {
          const isSelected = selected === rate.rateId;

          return (
            <label
              key={rate.rateId}
              className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
                isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shippingRate"
                  value={rate.rateId}
                  checked={isSelected}
                  onChange={() => handleSelect(rate)}
                  className="h-4 w-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {rate.service}
                  </p>
                  <p className="text-xs text-gray-500">
                    {rate.carrier}
                    {rate.estimatedDelivery
                      ? ` · Est. ${rate.estimatedDelivery}`
                      : rate.estimatedDays
                      ? ` · ${rate.estimatedDays} day${rate.estimatedDays !== 1 ? 's' : ''}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  ${rate.rate.toFixed(2)}
                </p>
                {rate.guaranteed && (
                  <p className="text-xs text-green-600">Guaranteed</p>
                )}
                {rate.negotiatedRate && (
                  <p className="text-xs text-blue-500">Negotiated</p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}