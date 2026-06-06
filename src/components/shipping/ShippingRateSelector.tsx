"use client";

/**
 * ShippingRateSelector
 * ─────────────────────
 * Drop-in checkout component that:
 *  1. Fetches rates from all carriers (POST /api/shipping/rates)
 *  2. Displays them grouped by carrier with logos, prices & ETA
 *  3. Calls onSelect(rate) when the user picks one
 *
 * Usage in your checkout page:
 *
 *   <ShippingRateSelector
 *     origin={STORE_ORIGIN}
 *     destination={shippingAddress}
 *     package={packageDims}
 *     onSelect={(rate) => setSelectedShipping(rate)}
 *   />
 */

import { useState, useEffect, useCallback } from "react";
import type { ShippingRate, ShippingAddress, PackageDimensions } from "@/types/shipping";

// ─── Carrier logos (inline SVG text / emoji fallbacks) ──────────────────────

const CARRIER_COLORS: Record<string, string> = {
  FedEx: "#4D148C",
  USPS: "#333366",
  UPS:  "#351C15",
};

const CARRIER_ACCENT: Record<string, string> = {
  FedEx: "#FF6600",
  USPS: "#CC0000",
  UPS:  "#FFB500",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ShippingRateSelectorProps {
  origin: ShippingAddress;
  destination: ShippingAddress;
  package: PackageDimensions;
  onSelect: (rate: ShippingRate) => void;
  selectedServiceCode?: string;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShippingRateSelector({
  origin,
  destination,
  package: pkg,
  onSelect,
  selectedServiceCode,
  className = "",
}: ShippingRateSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byCarrier, setByCarrier] = useState<{
    fedex: ShippingRate[];
    usps: ShippingRate[];
    ups: ShippingRate[];
  } | null>(null);
  const [carrierErrors, setCarrierErrors] = useState<{ carrier: string; message: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(selectedServiceCode ?? null);

  const fetchRates = useCallback(async () => {
    if (!destination.postalCode) return;
    setLoading(true);
    setError(null);

    try {
      const token =
typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ origin, destination, package: pkg }),
      });

      const json = await res.json();

      if (!json.success) throw new Error(json.error ?? "Failed to fetch rates");

      setByCarrier(json.data.byCarrier);
      setCarrierErrors(json.data.errors ?? []);
    } catch (err: any) {
      setError(err.message ?? "Could not load shipping rates");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, pkg]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  function handleSelect(rate: ShippingRate) {
    const key = `${rate.carrier}-${rate.service}`;
    setSelected(key);
    onSelect(rate);
  }

  const allRates: ShippingRate[] = byCarrier
    ? [...byCarrier.fedex, ...byCarrier.usps, ...byCarrier.ups]
    : [];

  // ── Render states ─────────────────────────────────────────────────────────

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

  if (!byCarrier || allRates.length === 0) return null;

  const carriers = [
    { key: "fedex" as const, label: "FedEx", rates: byCarrier.fedex },
    { key: "usps" as const, label: "USPS", rates: byCarrier.usps },
    { key: "ups" as const, label: "UPS", rates: byCarrier.ups },
  ].filter((c) => c.rates.length > 0);

  return (
    <div className={`space-y-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">
        Shipping Method
      </h3>

      {/* Carrier error notices */}
      {carrierErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-700">
            {carrierErrors.map((e) => e.carrier).join(", ")} rates unavailable. Other carriers shown.
          </p>
        </div>
      )}

      {carriers.map(({ key, label, rates }) => (
        <div key={key}>
          {/* Carrier header */}
          <div
            className="mb-2 flex items-center gap-2 rounded-t-lg px-3 py-2"
            style={{ backgroundColor: CARRIER_COLORS[label] }}
          >
            <span
              className="text-xs font-bold tracking-widest"
              style={{ color: CARRIER_ACCENT[label] }}
            >
              {label}
            </span>
          </div>

          {/* Rate options */}
          <div className="divide-y divide-gray-100 rounded-b-lg border border-gray-200">
            {rates.map((rate) => {
              const rateKey = `${rate.carrier}-${rate.service}`;
              const isSelected = selected === rateKey;

              return (
                <label
                  key={rateKey}
                  className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
                    isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingRate"
                      value={rateKey}
                      checked={isSelected}
                      onChange={() => handleSelect(rate)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{rate.service}</p>
                      {rate.estimatedDelivery && (
                        <p className="text-xs text-gray-500">{rate.estimatedDelivery}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      ${rate.rate.toFixed(2)}
                    </p>
                    {rate.guaranteed && (
                      <p className="text-xs text-green-600">Guaranteed</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
