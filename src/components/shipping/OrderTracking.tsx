"use client";

/**
 * OrderTracking
 * ─────────────
 * Shows live tracking info for an order. Calls the universal
 * POST /api/shipping/track endpoint.
 *
 * Usage on the order detail page:
 *   <OrderTracking trackingNumber={order.trackingNumber} carrier={order.shippingCarrier} />
 */

import { useState, useEffect } from "react";
import type { TrackingInfo } from "@/types/shipping";

const STATUS_COLOR: Record<string, string> = {
  Delivered: "text-green-600 bg-green-50 border-green-200",
  "In Transit": "text-blue-600 bg-blue-50 border-blue-200",
  "Out for Delivery": "text-orange-600 bg-orange-50 border-orange-200",
  Exception: "text-red-600 bg-red-50 border-red-200",
};

function defaultColor(status: string) {
  for (const [k, v] of Object.entries(STATUS_COLOR)) {
    if (status.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "text-gray-600 bg-gray-50 border-gray-200";
}

interface OrderTrackingProps {
  trackingNumber: string;
  carrier?: string;
  trackingUrl?: string;
  className?: string;
}

export default function OrderTracking({
  trackingNumber,
  carrier,
  trackingUrl,
  className = "",
}: OrderTrackingProps) {
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/shipping/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ trackingNumber, carrier }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? "Tracking failed");
        setTracking(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [trackingNumber, carrier]);

  if (loading) {
    return (
      <div className={`animate-pulse rounded-xl border border-gray-200 p-5 ${className}`}>
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-4 ${className}`}>
        <p className="text-sm text-red-600">Could not load tracking: {error}</p>
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-medium text-red-700 underline"
          >
            Track on {carrier ?? "carrier"} website →
          </a>
        )}
      </div>
    );
  }

  if (!tracking) return null;

  const statusClass = defaultColor(tracking.status);

  return (
    <div className={`rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {tracking.carrier} Tracking
          </p>
          <p className="mt-0.5 font-mono text-sm text-gray-700">{trackingNumber}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}
        >
          {tracking.status}
        </span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 border-b border-gray-100 px-5 py-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500">Current Location</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">
            {tracking.currentLocation || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last Update</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">{tracking.lastUpdate || "—"}</p>
        </div>
        {tracking.estimatedDelivery && (
          <div>
            <p className="text-xs text-gray-500">Est. Delivery</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800">{tracking.estimatedDelivery}</p>
          </div>
        )}
      </div>

      {/* Event timeline */}
      {tracking.events.length > 0 && (
        <div className="px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tracking History
          </p>
          <ol className="relative border-l border-gray-200">
            {tracking.events.map((evt, i) => (
              <li key={i} className="mb-4 ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-gray-300" />
                <p className="text-sm font-medium text-gray-800">{evt.description}</p>
                <p className="text-xs text-gray-500">
                  {evt.location && <span>{evt.location} · </span>}
                  {evt.timestamp}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* External link */}
      {trackingUrl && (
        <div className="border-t border-gray-100 px-5 py-3">
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            View full tracking on {tracking.carrier} website →
          </a>
        </div>
      )}
    </div>
  );
}
