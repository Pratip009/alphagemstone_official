'use client';

/**
 * AdminOrderShipping — ShipEngine label + tracking panel
 * Drop into the admin order detail to:
 *   • See the rate the customer selected at checkout
 *   • Purchase the ShipEngine label with one click
 *   • View tracking number, print label PDF, live-track the package
 */

import React, { useState } from 'react';
import {
  Package, Printer, MapPin, CheckCircle, AlertCircle,
  ExternalLink, RefreshCw, Clock, Truck,
} from 'lucide-react';

export interface OrderShippingData {
  _id:                        string;
  shippingCarrier?:           string | null;
  shippingService?:           string | null;
  shippingRateId?:            string | null;
  shippingRate?:              number;
  shippingEstimatedDelivery?: string | null;
  shippingEstimatedDays?:     number | null;
  trackingNumber?:            string | null;
  trackingUrl?:               string | null;
  labelId?:                   string | null;
  labelUrl?:                  string | null;
  shippedAt?:                 string | null;
  status:                     string;
  paymentStatus:              string;
}

interface TrackingEvent {
  timestamp:   string;
  description: string;
  location:    string;
}

interface TrackingInfo {
  carrier:           string;
  trackingNumber:    string;
  status:            string;
  currentLocation:   string;
  lastUpdate:        string;
  estimatedDelivery: string | null;
  events:            TrackingEvent[];
  deliveredAt?:      string;
}

interface Props {
  order:     OrderShippingData;
  onUpdate?: (updated: Partial<OrderShippingData>) => void;
}

export default function AdminOrderShipping({ order, onUpdate }: Props) {
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  const [labelUrl,       setLabelUrl]       = useState(order.labelUrl ?? '');
  const [shippedAt,      setShippedAt]      = useState(order.shippedAt ?? '');
  const [labelId,        setLabelId]        = useState(order.labelId ?? '');

  const [labelLoading,   setLabelLoading]   = useState(false);
  const [trackLoading,   setTrackLoading]   = useState(false);
  const [trackOpen,      setTrackOpen]      = useState(false);
  const [tracking,       setTracking]       = useState<TrackingInfo | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState<string | null>(null);
  const [trackCooldown,  setTrackCooldown]  = useState(0); // seconds remaining

  const [manualTracking,   setManualTracking]   = useState('');
  const [manualCarrier,    setManualCarrier]    = useState('');
  const [manualLoading,    setManualLoading]    = useState(false);

  const labelPurchased = Boolean(trackingNumber);
  const canPurchase    = order.paymentStatus === 'completed' && Boolean(order.shippingRateId) && !labelPurchased;

  // Auth is via the httpOnly cookie (credentials: 'include' below), not a header.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // ── Purchase label ────────────────────────────────────────────────────────
  async function handlePurchaseLabel() {
    setLabelLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res  = await fetch(`/api/admin/orders/${order._id}/purchase-label`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Failed to purchase label');

      const updated = data.data?.order ?? data.data ?? {};
      const tn = updated.trackingNumber ?? '';
      const lu = updated.labelUrl       ?? '';
      const sa = updated.shippedAt      ?? new Date().toISOString();
      const li = updated.labelId        ?? '';

      setTrackingNumber(tn);
      setLabelUrl(lu);
      setShippedAt(sa);
      setLabelId(li);
      setSuccess('Label purchased — order marked as shipped. Customer notified by email.');
      onUpdate?.({ trackingNumber: tn, labelUrl: lu, shippedAt: sa, labelId: li, status: 'shipped' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLabelLoading(false);
    }
  }

  // ── Live tracking ─────────────────────────────────────────────────────────
  async function handleTrack() {
    if (tracking) { setTrackOpen(o => !o); return; }
    setTrackLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/shipping/track', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ trackingNumber }),
      });
      const data = await res.json();

      if (res.status === 429) {
        // Start a 60-second countdown
        let secs = 60;
        setTrackCooldown(secs);
        const timer = setInterval(() => {
          secs -= 1;
          setTrackCooldown(secs);
          if (secs <= 0) clearInterval(timer);
        }, 1000);
        throw new Error(data.error ?? 'Rate limited — please wait 60 seconds.');
      }

      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Failed to fetch tracking');
      setTracking(data.data);
      setTrackOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTrackLoading(false);
    }
  }

  // ── Refresh tracking (clears cache hit, re-fetches) ───────────────────────
  async function handleRefreshTrack() {
    setTracking(null);
    setTrackOpen(false);
    await handleTrack();
  }

  // ── Save manual tracking ──────────────────────────────────────────────────
  async function handleSaveManualTracking() {
    if (!manualTracking.trim()) return;
    setManualLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res  = await fetch(`/api/admin/orders/${order._id}`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          trackingNumber:  manualTracking.trim(),
          shippingCarrier: manualCarrier.trim() || undefined,
          status: order.status === 'paid' || order.status === 'processing' ? 'shipped' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Failed to save tracking');

      const tn = manualTracking.trim();
      const carrier = manualCarrier.trim();
      setTrackingNumber(tn);
      setManualTracking('');
      setManualCarrier('');
      setSuccess('Tracking number saved. Order marked as shipped.');
      onUpdate?.({ trackingNumber: tn, ...(carrier ? { shippingCarrier: carrier } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#ede9e1] bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede9e1] bg-[#faf9f7]">
        <div className="flex items-center gap-2">
          <Truck size={14} className="text-[#c9a84c]" strokeWidth={2} />
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-[#1a1714]">
            Shipment
          </span>
        </div>
        {labelPurchased && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.62rem] font-semibold"
            style={{ background: '#edf7ed', color: '#2d6b2d', border: '1px solid #80c880' }}>
            <CheckCircle size={9} strokeWidth={2.5} /> Label Purchased
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">

        {/* ── Feedback banners ── */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" strokeWidth={2} />
            <p className="text-[0.75rem] text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
            <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" strokeWidth={2} />
            <p className="text-[0.75rem] text-green-700">{success}</p>
          </div>
        )}

        {/* ── Rate summary ── */}
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#a09a90] font-semibold mb-3">
            Selected Rate
          </p>
          {order.shippingRateId ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                { label: 'Carrier',      value: order.shippingCarrier },
                { label: 'Service',      value: order.shippingService },
                { label: 'Quoted cost',  value: order.shippingRate != null ? `$${order.shippingRate.toFixed(2)}` : null },
                { label: 'Est. delivery',value: order.shippingEstimatedDelivery ?? (order.shippingEstimatedDays ? `${order.shippingEstimatedDays} days` : null) },
                { label: 'Rate ID',      value: order.shippingRateId, mono: true, muted: true },
              ].filter(r => r.value).map(({ label, value, mono, muted }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[0.6rem] uppercase tracking-widest text-[#a09a90]">{label}</span>
                  <span className={`text-[0.75rem] font-medium ${muted ? 'font-mono text-[0.65rem] text-[#b0a898]' : 'text-[#1a1714]'} ${mono ? 'font-mono' : ''}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.75rem] text-[#c4bdb2] italic">
              No shipping rate was selected at checkout.
            </p>
          )}
        </div>

        {/* ── Label / tracking info (post-purchase) ── */}
        {labelPurchased && (
          <div className="rounded-lg border border-[#ede9e1] bg-[#faf9f7] p-4 space-y-3">
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#a09a90] font-semibold">
              Label Details
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                { label: 'Tracking #',    value: trackingNumber, mono: true, highlight: true },
                { label: 'Label ID',      value: labelId,        mono: true },
                { label: 'Purchased at',  value: shippedAt ? new Date(shippedAt).toLocaleString() : null },
              ].filter(r => r.value).map(({ label, value, mono, highlight }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[0.6rem] uppercase tracking-widest text-[#a09a90]">{label}</span>
                  <span className={`text-[0.75rem] font-medium ${mono ? 'font-mono' : ''} ${highlight ? 'text-[#1a1714]' : 'text-[#5a5249]'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-2.5">
          {!labelPurchased && (
            <button
              onClick={handlePurchaseLabel}
              disabled={labelLoading || !canPurchase}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1a1714' }}
            >
              <Package size={13} strokeWidth={2} />
              {labelLoading ? 'Purchasing…' : 'Purchase Label'}
            </button>
          )}

          {labelUrl && (
            <a
              href={labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold border transition-colors hover:bg-[#faf9f7]"
              style={{ borderColor: '#ede9e1', color: '#5a5249' }}
            >
              <Printer size={13} strokeWidth={2} /> Print Label
            </a>
          )}

          {trackingNumber && (
            <button
              onClick={handleTrack}
              disabled={trackLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold border transition-colors hover:bg-[#faf9f7] disabled:opacity-40"
              style={{ borderColor: '#ede9e1', color: '#5a5249' }}
            >
              {trackLoading
                ? <><RefreshCw size={13} strokeWidth={2} className="animate-spin" /> Loading…</>
                : <><MapPin size={13} strokeWidth={2} /> {trackOpen ? 'Hide Tracking' : 'Live Tracking'}</>
              }
            </button>
          )}

          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold border transition-colors hover:bg-[#faf9f7]"
              style={{ borderColor: '#ede9e1', color: '#5a5249' }}
            >
              <ExternalLink size={13} strokeWidth={2} /> Carrier Site
            </a>
          )}
        </div>

        {/* ── Manual tracking entry (for orders without ShipEngine rate) ── */}
        {!labelPurchased && !order.shippingRateId && (
          <div className="rounded-lg border border-[#ede9e1] bg-[#faf9f7] p-4 space-y-3">
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#a09a90] font-semibold">
              Enter Tracking Manually
            </p>
            <p className="text-[0.68rem] text-[#8a8278]">
              No ShipEngine rate was stored for this order. Enter a tracking number from your carrier portal to mark it as shipped.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tracking number…"
                  value={manualTracking}
                  onChange={e => setManualTracking(e.target.value)}
                  className="flex-1 text-[0.75rem] px-3 py-2 rounded-lg border border-[#ede9e1] outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 bg-white placeholder:text-[#c4bdb2]"
                />
                <input
                  type="text"
                  placeholder="Carrier (optional)…"
                  value={manualCarrier}
                  onChange={e => setManualCarrier(e.target.value)}
                  className="w-32 text-[0.75rem] px-3 py-2 rounded-lg border border-[#ede9e1] outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 bg-white placeholder:text-[#c4bdb2]"
                />
              </div>
              <button
                onClick={handleSaveManualTracking}
                disabled={manualLoading || !manualTracking.trim()}
                className="self-start flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#1a1714' }}
              >
                <Package size={13} strokeWidth={2} />
                {manualLoading ? 'Saving…' : 'Save & Mark Shipped'}
              </button>
            </div>
          </div>
        )}

        {/* ── Warnings ── */}
        {!order.shippingRateId && !labelPurchased && (
          <p className="text-[0.7rem] text-amber-600 flex items-center gap-1.5">
            <AlertCircle size={12} strokeWidth={2} />
            No shipping rate selected at checkout — ask customer to re-checkout, or enter tracking manually.
          </p>
        )}
        {order.paymentStatus !== 'completed' && !labelPurchased && (
          <p className="text-[0.7rem] text-red-500 flex items-center gap-1.5">
            <AlertCircle size={12} strokeWidth={2} />
            Payment not completed — label cannot be purchased until payment is captured.
          </p>
        )}

        {/* ── Live tracking timeline ── */}
        {trackOpen && tracking && (
          <div className="rounded-lg border border-[#ede9e1] bg-[#faf9f7] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.72rem] font-semibold text-[#1a1714]">
                {tracking.status}
              </span>
              {tracking.estimatedDelivery && !tracking.deliveredAt && (
                <span className="text-[0.65rem] text-[#a09a90] flex items-center gap-1">
                  <Clock size={10} /> Est. {tracking.estimatedDelivery}
                </span>
              )}
              {tracking.deliveredAt && (
                <span className="text-[0.65rem] text-green-600 flex items-center gap-1 font-semibold">
                  <CheckCircle size={10} /> Delivered {tracking.deliveredAt}
                </span>
              )}
            </div>

            {tracking.currentLocation && (
              <p className="text-[0.7rem] text-[#6b6560] flex items-center gap-1.5">
                <MapPin size={11} strokeWidth={1.8} className="text-[#c9a84c]" />
                {tracking.currentLocation}
              </p>
            )}

            {tracking.events.length > 0 && (
              <ol className="relative border-l border-[#ede9e1] space-y-3 ml-2 pt-1">
                {tracking.events.slice(0, 8).map((ev, i) => (
                  <li key={i} className="ml-4">
                    <div className="absolute -left-1.5 mt-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#c9a84c]" />
                    <p className="text-[0.6rem] text-[#a09a90]">
                      {ev.timestamp}{ev.location && ` · ${ev.location}`}
                    </p>
                    <p className="text-[0.72rem] font-medium text-[#1a1714]">{ev.description}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}