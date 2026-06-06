'use client';

/**
 * AdminOrderFedEx component
 * Drop this into your existing admin order detail page.
 *
 * Shows:
 *   - FedEx tracking number + estimated delivery (if label exists)
 *   - "Generate / Regenerate Label" button
 *   - "Print Label" button (opens PDF in new tab)
 *   - Live tracking timeline
 *
 * Usage:
 *   import AdminOrderFedEx from '@/components/admin/AdminOrderFedEx';
 *   <AdminOrderFedEx orderId={order._id.toString()} fedex={order.fedex} />
 */

import { useState } from 'react';

interface FedExShipment {
  trackingNumber: string;
  serviceType: string;
  estimatedDelivery?: string;
  createdAt: string;
  labelBase64?: string;
}

interface TrackingEvent {
  timestamp: string;
  eventType: string;
  description: string;
  location?: string;
}

interface TrackingData {
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackingEvent[];
}

interface Props {
  orderId: string;
  fedex?: FedExShipment;
}

export default function AdminOrderFedEx({ orderId, fedex: initialFedex }: Props) {
  const [fedex, setFedex] = useState<FedExShipment | undefined>(initialFedex);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Generate / Regenerate label ──────────────────────────────────────────
  async function handleGenerateLabel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fedex-label`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to generate label');
      setFedex(data.data?.order?.fedex);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // ─── Fetch live tracking ───────────────────────────────────────────────────
  async function handleTrack() {
    setTrackLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to fetch tracking');
      setTracking(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTrackLoading(false);
    }
  }

  // ─── Print label (open PDF in new tab) ────────────────────────────────────
  function handlePrint() {
    window.open(`/api/admin/orders/${orderId}/fedex-label/download`, '_blank');
  }

  const statusColor: Record<string, string> = {
    OD: 'text-blue-600',
    DL: 'text-green-600',
    IT: 'text-yellow-600',
    PU: 'text-purple-600',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <h3 className="text-lg font-semibold text-gray-800">FedEx Shipping</h3>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Current label info ── */}
      {fedex ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Tracking #</span>
            <span className="font-mono font-medium text-gray-900">{fedex.trackingNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Service</span>
            <span className="text-gray-900">{fedex.serviceType.replace(/_/g, ' ')}</span>
          </div>
          {fedex.estimatedDelivery && (
            <div className="flex justify-between">
              <span className="text-gray-500">Est. Delivery</span>
              <span className="text-gray-900">
                {new Date(fedex.estimatedDelivery).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Label Created</span>
            <span className="text-gray-900">{new Date(fedex.createdAt).toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No shipping label generated yet.</p>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleGenerateLabel}
          disabled={loading}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : fedex ? 'Regenerate Label' : 'Generate Label'}
        </button>

        {fedex && (
          <>
            <button
              onClick={handlePrint}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Print Label
            </button>
            <button
              onClick={handleTrack}
              disabled={trackLoading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {trackLoading ? 'Loading…' : 'Live Tracking'}
            </button>
          </>
        )}
      </div>

      {/* ── Tracking timeline ── */}
      {tracking && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-semibold ${statusColor[tracking.status] ?? 'text-gray-700'}`}
            >
              {tracking.statusDescription}
            </span>
            {tracking.estimatedDelivery && (
              <span className="text-xs text-gray-500">
                Est. {new Date(tracking.estimatedDelivery).toLocaleDateString()}
              </span>
            )}
            {tracking.actualDelivery && (
              <span className="text-xs text-green-600 font-medium">
                Delivered {new Date(tracking.actualDelivery).toLocaleDateString()}
              </span>
            )}
          </div>

          <ol className="relative border-l border-gray-200 space-y-4 ml-3">
            {tracking.events.map((event, i) => (
              <li key={i} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-indigo-400" />
                <p className="text-xs text-gray-400">
                  {new Date(event.timestamp).toLocaleString()}
                  {event.location && ` · ${event.location}`}
                </p>
                <p className="text-sm font-medium text-gray-700">{event.description}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}