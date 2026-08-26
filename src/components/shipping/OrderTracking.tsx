'use client';

/**
 * OrderTracking
 * ─────────────
 * Shows live tracking for an order via POST /api/shipping/track.
 * Handles ShipEngine "Too Many Requests" errors gracefully with
 * a user-friendly message and manual retry button.
 */

import { useState, useEffect, useCallback } from 'react';
import type { TrackingInfo } from '@/types/shipping';

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  delivered:          { bg: '#ecfdf5', text: '#065f46', dot: '#10b981' },
  'in transit':       { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  'out for delivery': { bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  exception:          { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
};

function statusStyle(status: string) {
  const key = Object.keys(STATUS_STYLES).find((k) =>
    status.toLowerCase().includes(k)
  );
  return key ? STATUS_STYLES[key] : { bg: '#f9fafb', text: '#374151', dot: '#9ca3af' };
}

interface OrderTrackingProps {
  trackingNumber: string;
  carrierCode?:   string;
  trackingUrl?:   string;
  className?:     string;
}

export default function OrderTracking({
  trackingNumber,
  carrierCode,
  trackingUrl,
  className = '',
}: OrderTrackingProps) {
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [retryCount, setRetryCount]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsRateLimit(false);
    try {
      const res = await fetch('/api/shipping/track', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackingNumber, carrierCode }),
      });

      const json = await res.json();

      if (res.status === 429 || json.error?.toLowerCase().includes('rate')) {
        setIsRateLimit(true);
        throw new Error('rate_limit');
      }
      if (!json.success) throw new Error(json.error ?? 'Tracking failed');
      setTracking(json.data);
    } catch (err: any) {
      if (err.message !== 'rate_limit') {
        setError(err.message ?? 'Could not load tracking info');
      }
    } finally {
      setLoading(false);
    }
  }, [trackingNumber, carrierCode]);

  useEffect(() => { load(); }, [load, retryCount]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`rounded-2xl overflow-hidden ${className}`}
        style={{ background: 'linear-gradient(135deg, #fafaf9 0%, #f5f0eb 100%)', border: '1px solid #e8e0d5' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#e8e0d5' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: '#e8e0d5' }} />
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded animate-pulse" style={{ background: '#e8e0d5' }} />
              <div className="h-3 w-40 rounded animate-pulse" style={{ background: '#ede8e0' }} />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[80, 60, 70].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: '#d4c9b8' }} />
              <div className="h-3 rounded animate-pulse" style={{ background: '#ede8e0', width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 text-center">
          <p className="text-xs" style={{ color: '#a89880' }}>Fetching live tracking data…</p>
        </div>
      </div>
    );
  }

  // ── Rate Limit ───────────────────────────────────────────────────────────
  if (isRateLimit) {
    return (
      <div className={`rounded-2xl overflow-hidden ${className}`}
        style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
              style={{ background: '#fef3c7' }}>⏳</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>Carrier is busy</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#b45309' }}>
                The shipping carrier is temporarily limiting requests. This usually resolves in a minute.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setRetryCount(c => c + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#92400e', color: '#fff' }}>
              ↻ Try again
            </button>
            {trackingUrl && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium underline-offset-2 hover:underline"
                style={{ color: '#b45309' }}>
                Track on carrier site →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`rounded-2xl overflow-hidden ${className}`}
        style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
              style={{ background: '#fee2e2' }}>⚠️</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>Tracking unavailable</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#b91c1c' }}>
                {error.includes('Tracking failed') || error.includes('business_rules')
                  ? 'Live tracking isn\'t available for this shipment yet. Check back once your package has been picked up by the carrier.'
                  : error}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setRetryCount(c => c + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#991b1b', color: '#fff' }}>
              ↻ Retry
            </button>
            {trackingUrl && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium underline-offset-2 hover:underline"
                style={{ color: '#b91c1c' }}>
                Track on carrier site →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!tracking) return null;

  // ── Tracking card ────────────────────────────────────────────────────────
  const style = statusStyle(tracking.status);

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: '#fff', border: '1px solid #e8e0d5', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #1a1714 0%, #2d2520 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: '#c9a84c' }}>
              {tracking.carrier}
            </p>
            <p className="font-mono text-sm font-medium" style={{ color: '#f5f0eb' }}>
              {trackingNumber}
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide"
            style={{ background: style.bg, color: style.text }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: style.dot }} />
            {tracking.status}
          </span>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-3 divide-x" style={{ borderBottom: '1px solid #e8e0d5' }}>
        {[
          { label: 'Location', value: tracking.currentLocation || '—' },
          { label: 'Last Update', value: tracking.lastUpdate || '—' },
          { label: 'Est. Delivery', value: tracking.estimatedDelivery || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-widest mb-1" style={{ color: '#a89880' }}>{label}</p>
            <p className="text-xs font-medium leading-snug" style={{ color: '#1a1714' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Event timeline */}
      {tracking.events.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest mb-4" style={{ color: '#a89880' }}>
            Tracking History
          </p>
          <ol className="relative space-y-0" style={{ borderLeft: '2px solid #e8e0d5', marginLeft: '7px' }}>
            {tracking.events.map((evt, i) => (
              <li key={i} className="ml-5 pb-4 last:pb-0">
                <div className="absolute -left-[7px] w-3 h-3 rounded-full border-2"
                  style={{
                    background: i === 0 ? '#c9a84c' : '#fff',
                    borderColor: i === 0 ? '#c9a84c' : '#d4c9b8',
                    marginTop: '2px',
                  }} />
                <p className="text-sm font-medium" style={{ color: '#1a1714' }}>{evt.description}</p>
                <p className="text-xs mt-0.5" style={{ color: '#a89880' }}>
                  {evt.location && <span>{evt.location} · </span>}
                  {evt.timestamp}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer */}
      {trackingUrl && (
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #e8e0d5', background: '#fafaf9' }}>
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold hover:underline underline-offset-2 transition-opacity hover:opacity-80"
            style={{ color: '#c9a84c' }}>
            View full tracking on carrier site →
          </a>
          <button onClick={() => setRetryCount(c => c + 1)}
            className="text-xs px-3 py-1 rounded-full transition-all hover:opacity-80 active:scale-95"
            style={{ background: '#f0ebe3', color: '#5a4f3f' }}>
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}