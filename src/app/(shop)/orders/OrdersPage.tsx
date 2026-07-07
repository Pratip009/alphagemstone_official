'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OrderTracking from '@/components/shipping/OrderTracking';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  CircleDot,
  ChevronDown,
  Tag,
  MapPin,
  CreditCard,
  ExternalLink,
  ShoppingBag,
  Receipt,
  ArrowRight,
  Printer,
  TrendingUp,
  Box,
  CircleCheck,
  Ban,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface Order {
  _id: string;
  totalAmount: number;
  subtotal: number;
  shippingCost: number;
  tax: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  shippingCarrier?: string | null;
  shippingService?: string | null;
  shippingServiceCode?: string | null;
  shippingRate?: number;
  shippingEstimatedDelivery?: string | null;
  shippingEstimatedDays?: number | null;
  shippingRateId?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  labelId?: string | null;
  labelUrl?: string | null;
  shippedAt?: string | null;
  fedex?: { trackingNumber: string; serviceType: string; estimatedDelivery?: string } | null;
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string;
  bg: string;
  text: string;
  border: string;
  Icon: React.ElementType;
}> = {
  pending:    { label: 'Pending',    bg: '#fef9ec', text: '#92400e', border: '#fde68a', Icon: Clock },
  paid:       { label: 'Paid',       bg: '#f0fdf4', text: '#15803d', border: '#86efac', Icon: CircleCheck },
  processing: { label: 'Processing', bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd', Icon: RefreshCw },
  shipped:    { label: 'Shipped',    bg: '#f5f3ff', text: '#6d28d9', border: '#c4b5fd', Icon: Truck },
  delivered:  { label: 'Delivered',  bg: '#f0fdf4', text: '#15803d', border: '#86efac', Icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  bg: '#fef2f2', text: '#dc2626', border: '#fca5a5', Icon: Ban },
  refunded:   { label: 'Refunded',   bg: '#f9fafb', text: '#4b5563', border: '#d1d5db', Icon: RefreshCw },
};

const STEPS = ['pending', 'processing', 'shipped', 'delivered'] as const;
const STEP_LABELS = ['Placed', 'Processing', 'Shipped', 'Delivered'];
const STEP_ICONS: React.ElementType[] = [Receipt, RefreshCw, Truck, CheckCircle2];

// ─── Components ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: '#f9fafb',
    text: '#374151',
    border: '#d1d5db',
    Icon: CircleDot,
  };
  const { Icon } = cfg;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.7rem] font-semibold tracking-wide"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

function ProgressTrack({ status }: { status: string }) {
  const current = STEPS.indexOf(status as typeof STEPS[number]);
  if (current < 0) return null;

  return (
    <div className="relative flex items-start justify-between px-1 pt-1 pb-6">
      {/* Connector line */}
      <div
        className="absolute top-[14px] left-0 right-0 mx-6 h-px"
        style={{ background: '#e5e2db' }}
      />
      {/* Active fill */}
      <div
        className="absolute top-[14px] left-0 h-px mx-6 transition-all duration-700"
        style={{
          background: 'linear-gradient(90deg, #c9a84c, #e8c96a)',
          width: current === 0
            ? '0%'
            : `calc(${(current / (STEPS.length - 1)) * 100}% - 3rem + ${(current / (STEPS.length - 1)) * 3}rem)`,
        }}
      />

      {STEPS.map((step, i) => {
        const done   = i <= current;
        const active = i === current;
        const Icon   = STEP_ICONS[i];
        return (
          <div key={step} className="relative z-10 flex flex-col items-center gap-2" style={{ width: `${100 / STEPS.length}%` }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
              style={{
                background: done ? 'linear-gradient(135deg, #c9a84c 0%, #e8c96a 100%)' : '#fff',
                border: `1.5px solid ${done ? '#c9a84c' : '#d5d0c8'}`,
                boxShadow: active ? '0 0 0 4px rgba(201,168,76,0.15)' : 'none',
              }}
            >
              <Icon
                size={13}
                strokeWidth={2}
                style={{ color: done ? '#fff' : '#b5b0a8' }}
              />
            </div>
            <span
              className="text-[0.6rem] font-semibold tracking-wide text-center leading-tight"
              style={{ color: done ? '#92742a' : '#b5b0a8' }}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ShipmentPanel({ order }: { order: Order }) {
  const [tracking, setTracking] = useState(false);
  const tn     = order.trackingNumber ?? order.fedex?.trackingNumber ?? null;
  const carrier = order.shippingCarrier ?? (order.fedex ? 'FedEx' : null);

  if (!order.shippingRateId && !tn) {
    if (['paid', 'processing'].includes(order.status)) {
      return (
        <div
          className="px-6 py-3.5 flex items-center gap-3"
          style={{ background: '#fffdf5', borderTop: '1px solid #f0ead8' }}
        >
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#c9a84c' }} />
          <p className="text-xs" style={{ color: '#92742a' }}>
            Preparing your shipment — tracking info will appear here once dispatched.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ borderTop: '1px solid #ede9e0' }}>
      <div className="px-6 py-4" style={{ background: '#fafaf8' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {carrier && (
              <span
                className="text-[0.65rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md"
                style={{ background: '#1a1814', color: '#c9a84c', letterSpacing: '0.12em' }}
              >
                {carrier}
              </span>
            )}
            {order.shippingService && (
              <span className="text-xs" style={{ color: '#9c9690' }}>{order.shippingService}</span>
            )}
            {tn && (
              <div className="flex items-center gap-1.5">
                <Tag size={11} style={{ color: '#c9a84c' }} />
                <span className="font-mono text-[0.7rem] font-medium" style={{ color: '#5c5852' }}>{tn}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.labelUrl && (
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-75"
                style={{ background: '#ede9e0', color: '#5c5852' }}
              >
                <Printer size={12} /> Label
              </a>
            )}
            {tn && (
              <button
                onClick={() => setTracking(t => !t)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-95"
                style={
                  tracking
                    ? { background: '#1a1814', color: '#c9a84c' }
                    : { background: '#c9a84c', color: '#fff' }
                }
              >
                <Truck size={12} />
                {tracking ? 'Close tracking' : 'Track package'}
              </button>
            )}
          </div>
        </div>

        {(order.shippingEstimatedDelivery || order.shippedAt) && (
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {order.shippingEstimatedDelivery && (
              <div className="flex items-center gap-1.5">
                <Clock size={11} style={{ color: '#9c9690' }} />
                <span className="text-[0.7rem]" style={{ color: '#9c9690' }}>
                  Est. delivery:{' '}
                  <span className="font-semibold" style={{ color: '#5c5852' }}>
                    {order.shippingEstimatedDelivery}
                  </span>
                </span>
              </div>
            )}
            {order.shippedAt && (
              <div className="flex items-center gap-1.5">
                <Package size={11} style={{ color: '#9c9690' }} />
                <span className="text-[0.7rem]" style={{ color: '#9c9690' }}>
                  Shipped{' '}
                  {new Date(order.shippedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {tracking && tn && (
        <div className="px-6 pb-6 pt-1">
          <OrderTracking
            trackingNumber={tn}
            trackingUrl={order.trackingUrl ?? undefined}
            carrierCode={carrier?.toLowerCase().replace(/\s+/g, '_') ?? undefined}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { apiFetch }   = useApi();
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const success = searchParams.get('success');

  useEffect(() => {
    apiFetch('/api/orders')
      .then((d) => setOrders(d.data || []))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#fafaf8' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#c9a84c' }} />
        <p className="text-sm tracking-wide" style={{ color: '#9c9690' }}>Loading your orders…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ background: '#fafaf8' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div
        className="w-full border-b"
        style={{
          background: 'linear-gradient(180deg, #1a1814 0%, #22201b 100%)',
          borderColor: '#2d2a24',
        }}
      >
        <div className="w-full px-6 md:px-10 xl:px-16 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p
                className="text-[0.6rem] font-bold tracking-[0.25em] uppercase mb-3"
                style={{ color: '#c9a84c' }}
              >
                My Account
              </p>
              <h1
                className="text-4xl md:text-5xl font-light tracking-tight"
                style={{ fontFamily: '"Elms Sans", sans-serif', color: '#f5f1eb' }}
              >
                Orders
              </h1>
              <p className="text-sm mt-2" style={{ color: '#6e6a62' }}>
                {orders.length === 0
                  ? 'No purchases yet'
                  : `${orders.length} order${orders.length !== 1 ? 's' : ''} · ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
              </p>
            </div>

            {orders.length > 0 && (
              <div className="flex items-stretch gap-3">
                {[
                  { label: 'Total spent',   value: `$${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, Icon: TrendingUp },
                  { label: 'Orders',        value: String(orders.length),  Icon: ShoppingBag },
                  { label: 'Items',         value: String(totalItems),     Icon: Box },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="flex flex-col justify-between px-5 py-3.5 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(201,168,76,0.18)',
                      minWidth: '100px',
                    }}
                  >
                    <Icon size={14} style={{ color: '#c9a84c', opacity: 0.8 }} />
                    <div className="mt-3">
                      <p className="text-lg font-light leading-none" style={{ color: '#f5f1eb' }}>{value}</p>
                      <p className="text-[0.6rem] uppercase tracking-widest mt-1" style={{ color: '#5c5852' }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Success banner ───────────────────────────────────────────────── */}
      {success && (
        <div className="w-full px-6 md:px-10 xl:px-16 pt-6">
          <div
            className="flex items-start gap-4 rounded-xl px-5 py-4"
            style={{ background: '#f0fdf4', border: '1px solid #86efac' }}
          >
            <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>Payment confirmed</p>
              <p className="text-xs mt-0.5" style={{ color: '#166534' }}>
                Your order is placed. A tracking number will appear here once your package ships.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {orders.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center py-36 px-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: '#ede9e0' }}
          >
            <Package size={28} style={{ color: '#b5a898' }} />
          </div>
          <p className="text-xl font-light mb-1" style={{ fontFamily: '"Elms Sans", sans-serif', color: '#1a1814' }}>
            No orders yet
          </p>
          <p className="text-sm mb-8" style={{ color: '#9c9690' }}>
            Your purchases will appear here
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#1a1814', color: '#c9a84c' }}
          >
            Explore Collection <ArrowRight size={14} />
          </Link>
        </div>
      ) : (

        /* ── Order list ────────────────────────────────────────────────── */
        <div className="w-full px-6 md:px-10 xl:px-16 py-8 flex flex-col gap-5">
          {orders.map((order) => {
            const isOpen = expanded === order._id;
            const date   = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            });

            return (
              <div
                key={order._id}
                className="w-full rounded-2xl overflow-hidden transition-shadow duration-200"
                style={{
                  background: '#fff',
                  border: '1px solid #e5e2db',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* ── Card header ─────────────────────────────────────── */}
                <div className="px-6 pt-6 pb-5">
                  <div className="flex items-start justify-between gap-4">

                    {/* Left: ID + date + status */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className="font-mono text-[0.65rem] font-bold tracking-widest uppercase px-2 py-0.5 rounded"
                          style={{ background: '#faf5e8', color: '#92742a', border: '1px solid #f0e6c0' }}
                        >
                          #{order._id.slice(-10)}
                        </span>
                        <span className="text-xs" style={{ color: '#9c9690' }}>{date}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={order.status} />
                        {order.paymentStatus && order.paymentStatus !== order.status && (
                          <StatusBadge status={order.paymentStatus} />
                        )}
                      </div>
                    </div>

                    {/* Right: Total */}
                    <div className="text-right flex-shrink-0">
                      <p
                        className="text-2xl font-light"
                        style={{ fontFamily: '"Elms Sans", sans-serif', color: '#1a1814' }}
                      >
                        ${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[0.65rem] mt-0.5 uppercase tracking-wide" style={{ color: '#b5b0a8' }}>
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Progress track */}
                  <div className="mt-5">
                    <ProgressTrack status={order.status} />
                  </div>
                </div>

                {/* ── Expand toggle ────────────────────────────────────── */}
                <button
                  onClick={() => setExpanded(isOpen ? null : order._id)}
                  className="w-full flex items-center justify-between px-6 py-3.5 transition-colors text-left"
                  style={{
                    borderTop: '1px solid #ede9e0',
                    borderBottom: isOpen ? '1px solid #ede9e0' : 'none',
                    background: isOpen ? '#fafaf8' : 'transparent',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: '#5c5852' }}>
                    {isOpen ? 'Hide details' : 'View order details'}
                  </span>
                  <ChevronDown
                    size={15}
                    style={{
                      color: '#9c9690',
                      transition: 'transform 0.2s',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>

                {/* ── Expanded detail ──────────────────────────────────── */}
                {isOpen && (
                  <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-8" style={{ background: '#fafaf8' }}>

                    {/* Items */}
                    <div>
                      <p
                        className="text-[0.6rem] font-bold uppercase tracking-widest mb-4"
                        style={{ color: '#b5b0a8' }}
                      >
                        Items ordered
                      </p>
                      <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
                        {order.items.map((item, ii) => (
                          <div key={ii} className="flex items-center justify-between py-3 gap-3 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: '#ede9e0' }}
                              >
                                <Package size={15} style={{ color: '#8a7d6e' }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: '#1a1814' }}>{item.name}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#9c9690' }}>Qty {item.quantity}</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold flex-shrink-0" style={{ color: '#1a1814' }}>
                              ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Totals breakdown */}
                      <div
                        className="mt-4 rounded-xl overflow-hidden"
                        style={{ border: '1px solid #e5e2db' }}
                      >
                        {[
                          { label: 'Subtotal',  value: `$${(order.subtotal ?? order.totalAmount - order.shippingCost - order.tax).toFixed(2)}` },
                          { label: 'Shipping',  value: order.shippingCost > 0 ? `$${order.shippingCost.toFixed(2)}` : 'Free' },
                          { label: 'Tax',       value: `$${(order.tax ?? 0).toFixed(2)}` },
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex justify-between items-center px-4 py-2.5 text-xs"
                            style={{ borderBottom: '1px solid #ede9e0', color: '#9c9690' }}
                          >
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                        ))}
                        <div
                          className="flex justify-between items-center px-4 py-3"
                          style={{ background: '#fff' }}
                        >
                          <span className="text-sm font-semibold" style={{ color: '#1a1814' }}>Total</span>
                          <span className="text-sm font-bold" style={{ color: '#1a1814' }}>
                            ${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shipping address + payment */}
                    <div className="flex flex-col gap-5">
                      {order.shippingAddress && (
                        <div>
                          <p
                            className="text-[0.6rem] font-bold uppercase tracking-widest mb-3"
                            style={{ color: '#b5b0a8' }}
                          >
                            Ship to
                          </p>
                          <div
                            className="rounded-xl px-4 py-4"
                            style={{ background: '#fff', border: '1px solid #e5e2db' }}
                          >
                            <div className="flex items-start gap-3">
                              <MapPin size={14} style={{ color: '#c9a84c', flexShrink: 0, marginTop: '1px' }} />
                              <div className="text-xs leading-relaxed" style={{ color: '#5c5852' }}>
                                <p className="font-semibold text-sm mb-0.5" style={{ color: '#1a1814' }}>
                                  {order.shippingAddress.fullName}
                                </p>
                                <p>{order.shippingAddress.addressLine1}</p>
                                {order.shippingAddress.addressLine2 && (
                                  <p>{order.shippingAddress.addressLine2}</p>
                                )}
                                <p>
                                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                                  {order.shippingAddress.postalCode}
                                </p>
                                <p>{order.shippingAddress.country}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <p
                          className="text-[0.6rem] font-bold uppercase tracking-widest mb-3"
                          style={{ color: '#b5b0a8' }}
                        >
                          Payment
                        </p>
                        <div
                          className="rounded-xl px-4 py-4 flex items-center gap-3"
                          style={{ background: '#fff', border: '1px solid #e5e2db' }}
                        >
                          <CreditCard size={15} style={{ color: '#c9a84c' }} />
                          <div className="text-xs" style={{ color: '#5c5852' }}>
                            <span className="capitalize font-medium" style={{ color: '#1a1814' }}>
                              {order.paymentMethod}
                            </span>
                            <span className="mx-2" style={{ color: '#d5d0c8' }}>·</span>
                            <span
                              className="capitalize px-2 py-0.5 rounded"
                              style={{
                                background: order.paymentStatus === 'paid' ? '#f0fdf4' : '#fef9ec',
                                color: order.paymentStatus === 'paid' ? '#15803d' : '#92400e',
                              }}
                            >
                              {order.paymentStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      {order.trackingUrl && (
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-75 self-start"
                          style={{ color: '#c9a84c' }}
                        >
                          <ExternalLink size={12} /> View on carrier website
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Shipment / Tracking panel ────────────────────────── */}
                <ShipmentPanel order={order} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}