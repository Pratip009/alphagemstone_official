'use client';

/**
 * OrderTracking component — customer-facing
 * Shows live FedEx tracking on the customer's order detail page.
 *
 * Usage:
 *   import OrderTracking from '@/components/OrderTracking';
 *   <OrderTracking orderId={order._id.toString()} trackingNumber={order.fedex?.trackingNumber} />
 */

import { useState } from 'react';

interface TrackingEvent {
  timestamp: string;
  eventType: string;
  description: string;
  location?: string;
}

interface TrackingData {
  trackingNumber: string;
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackingEvent[];
}

interface Props {
  orderId: string;
  trackingNumber?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  OD: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Out for Delivery' },
  DL: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
  IT: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Transit' },
  PU: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Picked Up' },
  OC: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Order Created' },
};

export default function OrderTracking({ orderId, trackingNumber }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  async function loadTracking() {
    if (data) { setOpened(o => !o); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Could not load tracking');
      setData(json.data);
      setOpened(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (!trackingNumber) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <p className="font-medium">Your order is being prepared for shipment.</p>
        <p className="text-xs mt-1 text-amber-600">
          A tracking number will appear here once your label is generated. Check back soon.
        </p>
      </div>
    );
  }

  const statusStyle = data ? (STATUS_STYLES[data.status] ?? STATUS_STYLES['IT']) : null;

  return (
    <div className="space-y-4">
      {/* Tracking number + toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">FedEx Tracking</p>
          <p className="font-mono text-sm font-semibold text-gray-800">{trackingNumber}</p>
        </div>
        <button
          onClick={loadTracking}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : opened ? 'Hide Updates' : 'Track Package'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Status badge */}
      {data && statusStyle && (
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
          {data.statusDescription || statusStyle.label}
        </span>
      )}

      {/* Delivery date */}
      {data && (data.estimatedDelivery || data.actualDelivery) && (
        <p className="text-sm text-gray-600">
          {data.actualDelivery
            ? `✅ Delivered on ${new Date(data.actualDelivery).toLocaleDateString()}`
            : `📦 Estimated delivery: ${new Date(data.estimatedDelivery!).toLocaleDateString()}`}
        </p>
      )}

      {/* Timeline */}
      {opened && data && data.events.length > 0 && (
        <ol className="relative border-l border-gray-200 space-y-4 ml-3 pt-2">
          {data.events.map((event, i) => (
            <li key={i} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-400" />
              <p className="text-xs text-gray-400">
                {new Date(event.timestamp).toLocaleString()}
                {event.location && ` · ${event.location}`}
              </p>
              <p className="text-sm text-gray-700">{event.description}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}