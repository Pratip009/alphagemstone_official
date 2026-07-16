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
 *
 * Visual identity: classic airmail envelope. A diagonal red/blue stripe
 * frame wraps the card (the signature element), rows read like torn ticket
 * stubs (dashed perforation + punched notches), and selecting a rate stamps
 * a rotated postmark onto that row. Needs Space Grotesk, Inter and
 * JetBrains Mono loaded globally (see note at bottom of file).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const CARRIER_CODES: Record<string, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FDX',
  dhl: 'DHL',
  dhlexpress: 'DHL',
  ontrac: 'OT',
  canadapost: 'CP',
  purolator: 'PLR',
  amazon: 'AMZ',
};

function initials(carrier: string) {
  const key = carrier.replace(/[^A-Za-z]/g, '').toLowerCase();
  if (CARRIER_CODES[key]) return CARRIER_CODES[key];
  return key.slice(0, 3).toUpperCase() || '—';
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
  const lastPickedRef = useRef<{ carrier: string; serviceCode?: string } | null>(null);

  // Serialize the shipping context so we only refetch when its *content*
  // changes, not whenever the parent re-renders and passes new object
  // references for the same origin/destination/package.
  const paramsKey = useMemo(
    () => JSON.stringify({ origin, destination, package: pkg }),
    [origin, destination, pkg]
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Keep a selection highlighted whenever the rate list changes:
  //  - if the currently selected rateId still exists in the new list, leave it alone
  //  - else try to restore the equivalent carrier + service (a genuine
  //    refetch reissues new rateIds even for the "same" option)
  //  - else fall back to the cheapest rate (rates arrive cheapest-first)
  useEffect(() => {
    if (!rates.length) return;
    if (selected && rates.some((r) => r.rateId === selected)) return;

    const prev = lastPickedRef.current;
    const restored = prev
      ? rates.find((r) => r.carrier === prev.carrier && r.serviceCode === prev.serviceCode)
      : null;

    handleSelect(restored ?? rates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates]);

  function handleSelect(rate: ShippingRate) {
    setSelected(rate.rateId);
    lastPickedRef.current = { carrier: rate.carrier, serviceCode: rate.serviceCode };
    onSelect(rate);
  }

  // Relative speed (0 = slowest, 1 = fastest) across the returned rates,
  // used to position the plane marker on each row's route line.
  const speedByRateId = useMemo(() => {
    const days = rates.map((r) => r.estimatedDays ?? 999);
    const min = Math.min(...days);
    const max = Math.max(...days);
    const span = max - min || 1;
    const map: Record<string, number> = {};
    rates.forEach((r) => {
      const d = r.estimatedDays ?? 999;
      map[r.rateId] = 1 - (d - min) / span;
    });
    return map;
  }, [rates]);

  // Deterministic decorative barcode bars (stable across renders per rate count)
  const barcodeBars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      w: [1, 1, 2, 1, 3][i % 5],
      h: 10 + ((i * 7) % 10),
    })),
    []
  );

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`ss-scope ${className}`}>
        <div className="ss-frame">
          <div className="ss-card p-5">
            <div className="mb-4 flex items-center gap-2.5" style={{ color: 'var(--ss-ink-soft)' }}>
              <span className="ss-spinner" />
              <span className="ss-mono text-[11px] uppercase tracking-[0.14em]">Fetching carriers…</span>
            </div>
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ss-shimmer h-16 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <ScopedStyles />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className={`ss-scope ${className}`}>
        <div className="rounded-2xl border border-dashed p-5" style={{ borderColor: '#E7B4B4', background: '#FBEEEE' }}>
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
              <path d="M3 12 Q7 8 11 12 T19 12" stroke="#B4433D" strokeWidth="1.6" strokeDasharray="2 3" strokeLinecap="round" />
              <circle cx="19" cy="12" r="2" fill="#B4433D" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#8A2F2A', fontFamily: 'var(--ss-display)' }}>
                Route unavailable
              </p>
              <p className="mt-0.5 text-xs" style={{ color: '#A6443E' }}>{error}</p>
              <button
                onClick={fetchRates}
                className="ss-mono mt-3 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition-colors hover:bg-white"
                style={{ borderColor: '#D79A98', color: '#8A2F2A' }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
        <ScopedStyles />
      </div>
    );
  }

  if (!rates.length) return null;

  // ── Rate list ──────────────────────────────────────────────────────────────

  return (
    <div className={`ss-scope ${className}`}>
      <div className="mb-3.5 flex items-baseline justify-between px-0.5">
        <h3 className="ss-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--ss-ink-soft)' }}>
          Shipping method
        </h3>
        <span className="ss-mono text-[11px]" style={{ color: 'var(--ss-ink-soft)' }}>
          {rates.length} option{rates.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="ss-frame">
        <div className="ss-card">
          <div className="flex items-center justify-between px-[18px] pb-3 pt-4">
            <span className="ss-display text-[15px] font-bold" style={{ letterSpacing: '-0.01em', color: 'var(--ss-ink)' }}>
              Choose <span style={{ color: 'var(--ss-blue)' }}>delivery</span>
            </span>
            <span className="flex h-5 items-end gap-[2px] opacity-50">
              {barcodeBars.map((b, i) => (
                <span key={i} style={{ width: b.w, height: b.h, background: 'var(--ss-ink)', display: 'block' }} />
              ))}
            </span>
          </div>

          <div className="ss-rows">
            {rates.map((rate, idx) => {
              const isSelected = selected === rate.rateId;
              const speed = Math.max(8, (speedByRateId[rate.rateId] ?? 0) * 100);

              return (
                <label
                  key={rate.rateId}
                  className="ss-row relative flex cursor-pointer items-center gap-3.5 px-[18px] py-[15px] transition-colors"
                  style={{
                    borderTop: idx === 0 ? 'none' : '1px dashed var(--ss-line)',
                    background: isSelected ? 'var(--ss-blue-soft)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="shippingRate"
                    value={rate.rateId}
                    checked={isSelected}
                    onChange={() => handleSelect(rate)}
                    className="sr-only"
                  />

                  <span
                    className="ss-mono flex h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] px-1.5 text-[10px] font-bold transition-all"
                    style={{
                      background: isSelected ? 'var(--ss-blue)' : 'var(--ss-surface)',
                      borderColor: isSelected ? 'var(--ss-blue)' : 'var(--ss-line)',
                      color: isSelected ? '#fff' : 'var(--ss-ink-soft)',
                      boxShadow: isSelected ? '0 0 0 4px var(--ss-blue-soft)' : 'none',
                    }}
                  >
                    {initials(rate.carrier)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="ss-display truncate text-[15px] font-semibold" style={{ letterSpacing: '-0.01em', color: 'var(--ss-ink)' }}>
                      {rate.service}
                    </p>
                    <p
                      className="mt-0.5 truncate text-[12px] transition-colors"
                      style={{ color: isSelected ? 'var(--ss-blue)' : 'var(--ss-ink-soft)', fontWeight: isSelected ? 600 : 400 }}
                    >
                      {rate.carrier}
                      {rate.estimatedDelivery
                        ? ` · Arrives ${rate.estimatedDelivery}`
                        : rate.estimatedDays
                        ? ` · ${rate.estimatedDays} day${rate.estimatedDays !== 1 ? 's' : ''} transit`
                        : ''}
                    </p>

                    <div className="relative mt-[9px] h-[3px] w-[120px] max-w-full overflow-hidden rounded-full" style={{ background: 'var(--ss-line)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${speed}%`, background: isSelected ? 'var(--ss-blue)' : 'var(--ss-ink-soft)' }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="ss-mono text-[18px] font-bold tabular-nums" style={{ letterSpacing: '-0.02em', color: 'var(--ss-ink)' }}>
                      ${rate.rate.toFixed(2)}
                    </p>
                    <div className="mt-[5px] flex flex-col items-end gap-1">
                      {rate.guaranteed && (
                        <span className="ss-mono rounded-full px-2 py-[2.5px] text-[9.5px] font-bold uppercase tracking-wide" style={{ background: 'var(--ss-success-soft)', color: 'var(--ss-success)' }}>
                          Guaranteed
                        </span>
                      )}
                      {rate.negotiatedRate && (
                        <span className="ss-mono rounded-full px-2 py-[2.5px] text-[9.5px] font-bold uppercase tracking-wide" style={{ background: 'var(--ss-violet-soft)', color: 'var(--ss-violet)' }}>
                          Negotiated
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <ScopedStyles />
    </div>
  );
}

function ScopedStyles() {
  return (
    <style jsx global>{`
      .ss-scope {
        --ss-paper: #fffdf9;
        --ss-surface: #fffdf9;
        --ss-ink: #17181d;
        --ss-ink-soft: #6b6d76;
        --ss-line: #ece7dd;
        --ss-red: #e4483b;
        --ss-blue: #1f3e93;
        --ss-blue-soft: #eaeefb;
        --ss-success: #157a55;
        --ss-success-soft: #e6f4ee;
        --ss-violet: #7c5cfc;
        --ss-violet-soft: #f1eeff;
        --ss-display: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
        --ss-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      }
      .ss-mono { font-family: var(--ss-mono); }
      .ss-display { font-family: var(--ss-display); }

      /* Airmail envelope frame — signature element */
      .ss-frame {
        padding: 7px;
        border-radius: 20px;
        background: repeating-linear-gradient(
          -45deg,
          var(--ss-red) 0 14px, var(--ss-paper) 14px 20px,
          var(--ss-blue) 20px 34px, var(--ss-paper) 34px 40px
        );
      }
      .ss-card { background: var(--ss-paper); border-radius: 14px; overflow: hidden; }

      /* Scrollable rate list instead of growing the page */
      .ss-rows {
        max-height: 308px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--ss-line) transparent;
      }
      .ss-rows::-webkit-scrollbar { width: 8px; }
      .ss-rows::-webkit-scrollbar-track { background: transparent; }
      .ss-rows::-webkit-scrollbar-thumb {
        background: var(--ss-line);
        border-radius: 9999px;
        border: 2px solid var(--ss-paper);
      }
      .ss-rows::-webkit-scrollbar-thumb:hover { background: var(--ss-blue); }

      .ss-row:hover { background: #faf8f3; }
      .ss-row:has(input:checked):hover { background: var(--ss-blue-soft); }
      .ss-row:focus-within { outline: 2px solid var(--ss-blue); outline-offset: -2px; }

      .ss-spinner {
        height: 14px; width: 14px; border-radius: 9999px;
        border: 2px solid var(--ss-line);
        border-top-color: var(--ss-blue);
        animation: ss-spin 0.7s linear infinite;
      }
      @keyframes ss-spin { to { transform: rotate(360deg); } }

      .ss-shimmer {
        background: linear-gradient(90deg, #f5f6fa 25%, #eceefa 37%, #f5f6fa 63%);
        background-size: 400% 100%;
        animation: ss-shimmer 1.4s ease-in-out infinite;
      }
      @keyframes ss-shimmer {
        0% { background-position: 100% 50%; }
        100% { background-position: 0 50%; }
      }

      @media (prefers-reduced-motion: reduce) {
        .ss-spinner, .ss-shimmer { animation: none; }
      }
    `}</style>
  );
}

/**
 * Fonts: add once to your root layout (e.g. app/layout.tsx) —
 *
 *   import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
 *   const display = Space_Grotesk({ subsets: ['latin'], variable: '--ss-display' });
 *   const body    = Inter({ subsets: ['latin'] });
 *   const mono    = JetBrains_Mono({ subsets: ['latin'], variable: '--ss-mono' });
 *
 * or load via <link> in <head> if you're not on next/font.
 */