'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useAuth } from '@/hooks/useAuth';
import {
  ShoppingBag, Search, ChevronLeft, ChevronRight,
  Package, Clock, Truck, CheckCircle, XCircle, RefreshCw,
  FileText, Printer, X, TrendingUp, DollarSign, AlertCircle,
  Eye, MoreVertical, ArrowUpRight, Filter, Download, Gem,
  MapPin, CreditCard, Calendar, Hash, ChevronDown, ChevronUp,
} from 'lucide-react';
import AdminOrderShipping, { type OrderShippingData } from '@/components/admin/AdminOrderShipping';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
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

interface CarrierShipment {
  trackingNumber: string;
  serviceType: string;
  estimatedDelivery?: string;
  createdAt: string;
  carrier: 'FedEx' | 'USPS' | 'UPS';
}

interface Order {
  _id: string;
  user: { _id: string; name: string; email: string };
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  subtotal: number;
  tax: number;
  shippingCost: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  shippingCarrier?: string | null;
  shippingService?: string | null;
  shippingServiceCode?: string | null;
  shippingRateId?: string | null;
  shippingRate?: number;
  shippingEstimatedDelivery?: string | null;
  shippingEstimatedDays?: number | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  labelId?: string | null;
  labelUrl?: string | null;
  shippedAt?: string | null;
  fedex?: CarrierShipment;
  usps?: CarrierShipment;
  ups?: CarrierShipment;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string; border: string; dot: string; icon: React.ElementType;
}> = {
  pending:    { label: 'Pending',    bg: '#fef9ec', text: '#92400e', border: '#fde68a', dot: '#f59e0b', icon: Clock },
  paid:       { label: 'Paid',       bg: '#f0fdf4', text: '#15803d', border: '#86efac', dot: '#22c55e', icon: CheckCircle },
  processing: { label: 'Processing', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', icon: RefreshCw },
  shipped:    { label: 'Shipped',    bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6', icon: Truck },
  delivered:  { label: 'Delivered',  bg: '#f0fdf4', text: '#15803d', border: '#86efac', dot: '#22c55e', icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444', icon: XCircle },
  refunded:   { label: 'Refunded',   bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb', dot: '#9ca3af', icon: RefreshCw },
};

const ALL_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function Invoice({ order, onClose }: { order: Order; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const invoiceNumber = `INV-${order._id.slice(-8).toUpperCase()}`;
  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dueDate = new Date(new Date(order.createdAt).getTime() + 30 * 86400000)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handlePrint = () => {
    const content = invoiceRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${invoiceNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
      <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a1714;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0;size:A4;}</style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-white/50 text-xs font-mono">{invoiceNumber}</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-white text-xs font-semibold rounded-xl hover:bg-[#b8963e] transition-colors">
              <Printer size={13} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <X size={15} className="text-white" />
            </button>
          </div>
        </div>
        <div ref={invoiceRef} style={{ fontFamily: '"Elms Sans", sans-serif', background: '#fff', padding: '52px 60px', minHeight: '297mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 44 }}>
            <div>
              <div style={{ fontFamily: '"Elms Sans", sans-serif', fontSize: 30, fontWeight: 500, color: '#1a1714', letterSpacing: '-0.5px', lineHeight: 1 }}>
                Alpha<span style={{ color: '#c9a84c' }}>Imports</span>
              </div>
              <div style={{ fontSize: 9, color: '#a09a90', marginTop: 6, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Fine Gemstones & Jewellery</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: '"Elms Sans", sans-serif', fontSize: 46, fontWeight: 300, color: '#1a1714', letterSpacing: '-2px', lineHeight: 1 }}>INVOICE</div>
              <div style={{ marginTop: 14 }}>
                {[{ label: 'Invoice No.', value: invoiceNumber, mono: true }, { label: 'Date', value: invoiceDate }, { label: 'Due Date', value: dueDate }].map(({ label, value, mono }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, marginBottom: 5, fontSize: 12 }}>
                    <span style={{ color: '#c4bdb2' }}>{label}</span>
                    <span style={{ fontWeight: 500, color: '#1a1714', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, letterSpacing: '0.08em', textTransform: 'uppercase', background: order.paymentStatus === 'completed' ? '#edf7ed' : '#fdf5e6', color: order.paymentStatus === 'completed' ? '#2d6b2d' : '#8b5e1a', border: `1px solid ${order.paymentStatus === 'completed' ? '#80c880' : '#e0c070'}` }}>
                    {order.paymentStatus === 'completed' ? '✓ Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg, #c9a84c50, #ede9e1, transparent)', marginBottom: 36 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40 }}>
            {[
              { title: 'Bill To', lines: [{ text: order.user?.name ?? '—', bold: true, size: 14 }, { text: order.user?.email ?? '—', color: '#6b6560' }] },
              { title: 'Ship To', lines: [{ text: order.shippingAddress.fullName, bold: true, size: 14 }, { text: order.shippingAddress.addressLine1 }, ...(order.shippingAddress.addressLine2 ? [{ text: order.shippingAddress.addressLine2 }] : []), { text: `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}` }, { text: order.shippingAddress.country }] },
            ].map(({ title, lines }) => (
              <div key={title}>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09a90', fontWeight: 600, marginBottom: 12 }}>{title}</div>
                {lines.map((line, i) => (
                  <div key={i} style={{ fontSize: (line as { size?: number }).size ?? 12, fontWeight: (line as { bold?: boolean }).bold ? 500 : 400, color: (line as { bold?: boolean }).bold ? '#1a1714' : ((line as { color?: string }).color ?? '#6b6560'), lineHeight: 1.7 }}>{line.text}</div>
                ))}
              </div>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28 }}>
            <thead>
              <tr style={{ background: '#1a1714' }}>
                {['Item Description', 'SKU', 'Unit Price', 'Qty', 'Amount'].map((label, i) => (
                  <th key={label} style={{ padding: '11px 14px', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f0e8d0', textAlign: i === 0 || i === 1 ? 'left' : 'right' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#faf9f7', borderBottom: '1px solid #f0ece6' }}>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: '#1a1714', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '13px 14px', fontSize: 11, color: '#a09a90', fontFamily: 'monospace' }}>{item.product.toString().slice(-8).toUpperCase()}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: '#5a5249', textAlign: 'right' }}>${item.price.toLocaleString()}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: '#5a5249', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 600, color: '#1a1714', textAlign: 'right' }}>${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 48 }}>
            <div style={{ width: 280 }}>
              {[{ label: 'Subtotal', value: `$${order.subtotal.toLocaleString()}` }, { label: 'Shipping', value: order.shippingCost === 0 ? 'Free' : `$${order.shippingCost.toLocaleString()}` }, { label: 'Tax', value: `$${order.tax.toFixed(2)}` }].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0ece6', fontSize: 13, color: '#6b6560' }}>
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', marginTop: 10, background: '#1a1714', borderRadius: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#f0e8d0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total Due</span>
                <span style={{ fontFamily: '"Elms Sans", sans-serif', fontSize: 24, fontWeight: 500, color: '#c9a84c' }}>${order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 52, textAlign: 'center', borderTop: '1px solid #f0ece6', paddingTop: 22 }}>
            <div style={{ fontFamily: '"Elms Sans", sans-serif', fontSize: 15, color: '#c9a84c', fontStyle: 'italic', marginBottom: 6 }}>Alpha Imports — Fine Gemstones & Jewellery</div>
            <div style={{ fontSize: 10, color: '#c4bdb2', letterSpacing: '0.12em' }}>www.alphaimports.com · support@alphaimports.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb', dot: '#9ca3af', icon: Package };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tracking-wide rounded-full ${size === 'sm' ? 'px-2 py-0.5 text-[0.6rem]' : 'px-2.5 py-1 text-[0.65rem]'}`}
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────
function StatusSelect({ orderId, current, onUpdate }: {
  orderId: string; current: string; onUpdate: (id: string, status: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const authFetch = useAuthFetch();

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setUpdating(true);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onUpdate(orderId, newStatus);
    } catch (err) {
      console.error('Failed to update order status', err);
    } finally {
      setUpdating(false);
    }
  };

  const cfg = STATUS_CONFIG[current] ?? { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' };
  return (
    <div className="relative">
      <select
        value={current} onChange={handleChange} disabled={updating}
        className="appearance-none text-[0.65rem] font-semibold pl-2.5 pr-6 py-1 rounded-full outline-none cursor-pointer disabled:opacity-50 transition-all"
        style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
      >
        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: cfg.text }} />
    </div>
  );
}

// ─── Shipping Indicator ────────────────────────────────────────────────────────
function ShippingChip({ order }: { order: Order }) {
  if (order.trackingNumber) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold"
        style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
        <Truck size={8} /> {order.trackingNumber.slice(-8)}
      </span>
    );
  }
  if (order.shippingCarrier) {
    return <span className="text-[0.65rem] font-medium text-[#6b6560]">{order.shippingCarrier}</span>;
  }
  return <span className="text-[0.6rem] text-[#c4bdb2]">—</span>;
}

// ─── Expanded Order Detail ────────────────────────────────────────────────────
function OrderDetail({ order, onShippingUpdate, onInvoice }: {
  order: Order;
  onShippingUpdate: (orderId: string, updated: Partial<Order>) => void;
  onInvoice: () => void;
}) {
  const shippingData: OrderShippingData = {
    _id: order._id,
    shippingCarrier: order.shippingCarrier,
    shippingService: order.shippingService,
    shippingRateId: order.shippingRateId,
    shippingRate: order.shippingRate,
    shippingEstimatedDelivery: order.shippingEstimatedDelivery,
    shippingEstimatedDays: order.shippingEstimatedDays,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    labelId: order.labelId,
    labelUrl: order.labelUrl,
    shippedAt: order.shippedAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
  };

  return (
    <div className="border-t" style={{ borderColor: '#f0ece6', background: 'linear-gradient(180deg, #faf9f7 0%, #f5f3f0 100%)' }}>
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Customer & Address */}
        <div className="space-y-4">
          <div>
            <p className="text-[0.58rem] tracking-[0.2em] uppercase text-[#b0a898] font-bold mb-2.5">Customer</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #c9a84c20, #c9a84c10)', color: '#c9a84c', border: '1.5px solid #c9a84c30' }}>
                {order.user?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-[0.8rem] font-semibold text-[#1a1714]">{order.user?.name ?? '—'}</p>
                <p className="text-[0.65rem] text-[#a09a90]">{order.user?.email ?? '—'}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[0.58rem] tracking-[0.2em] uppercase text-[#b0a898] font-bold mb-2.5">Ship To</p>
            <div className="flex gap-2">
              <MapPin size={12} className="text-[#c9a84c] flex-shrink-0 mt-0.5" />
              <div className="text-[0.72rem] text-[#5a5249] leading-relaxed">
                <p className="font-semibold text-[#1a1714]">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                <p className="font-medium">{order.shippingAddress.country}</p>
                {order.shippingAddress.phone && <p className="text-[#a09a90] mt-0.5">{order.shippingAddress.phone}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="text-[0.58rem] tracking-[0.2em] uppercase text-[#b0a898] font-bold mb-2.5">Items Ordered</p>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[#ede9e1] last:border-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#ede9e1' }}>
                  <Gem size={12} style={{ color: '#c9a84c' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.72rem] font-medium text-[#1a1714] truncate">{item.name}</p>
                  <p className="text-[0.62rem] text-[#a09a90]">Qty {item.quantity} × ${item.price.toLocaleString()}</p>
                </div>
                <p className="text-[0.75rem] font-semibold text-[#1a1714] flex-shrink-0">${(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-3 rounded-xl overflow-hidden border border-[#ede9e1]">
            {[
              { label: 'Subtotal', value: `$${order.subtotal.toLocaleString()}` },
              { label: 'Shipping', value: order.shippingCost === 0 ? 'Free' : `$${order.shippingCost.toLocaleString()}` },
              { label: 'Tax', value: `$${order.tax.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-3 py-1.5 border-b border-[#f0ece6] text-[0.68rem] text-[#8a8278]">
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-3 py-2 bg-[#1a1714]">
              <span className="text-[0.65rem] font-semibold text-[#f0e8d0] tracking-wide uppercase">Total</span>
              <span className="text-[0.9rem] font-semibold" style={{ fontFamily: '"Elms Sans", sans-serif', color: '#c9a84c' }}>
                ${order.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment & Actions */}
        <div className="space-y-4">
          <div>
            <p className="text-[0.58rem] tracking-[0.2em] uppercase text-[#b0a898] font-bold mb-2.5">Payment</p>
            <div className="rounded-xl border border-[#ede9e1] bg-white px-3 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-[#c9a84c]" />
                <span className="text-[0.72rem] font-medium text-[#1a1714] capitalize">{order.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] text-[#a09a90]">Status</span>
                <span className={`text-[0.65rem] font-semibold capitalize ${order.paymentStatus === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] text-[#a09a90]">Ref</span>
                <span className="font-mono text-[0.62rem] text-[#a09a90]">{order._id.slice(-10).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[0.58rem] tracking-[0.2em] uppercase text-[#b0a898] font-bold mb-2.5">Actions</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onInvoice}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[0.72rem] font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: '#1a1714', color: '#c9a84c', border: '1px solid #2d2a24' }}
              >
                <FileText size={12} /> Generate Invoice
              </button>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[0.72rem] font-semibold transition-all hover:opacity-90"
                  style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}
                >
                  <Truck size={12} /> Track Package
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Panel */}
      <div className="px-6 pb-5">
        <AdminOrderShipping
          order={shippingData}
          onUpdate={(updated) => onShippingUpdate(order._id, updated as Partial<Order>)}
        />
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border p-5 flex items-start gap-4 transition-shadow hover:shadow-md" style={{ borderColor: '#ede9e1' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.62rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-1">{label}</p>
        <p className="text-xl font-semibold text-[#1a1714] leading-none mb-1" style={{ fontFamily: '"Elms Sans", sans-serif' }}>{value}</p>
        <p className="text-[0.65rem] text-[#b0a898]">{sub}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (statusFilter) params.set('status', statusFilter);
    authFetch(`/api/admin/orders?${params}`)
      .then(r => r.json())
      .then(j => { setOrders(j.data ?? []); setPagination(j.pagination ?? null); })
      .catch(e => console.error('[orders]', e))
      .finally(() => setLoading(false));
  }, [authLoading, user, page, statusFilter, authFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusUpdate = (id: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o._id === id ? { ...o, status: newStatus } : o));
  };

  const handleShippingUpdate = (orderId: string, updated: Partial<Order>) => {
    setOrders(prev => prev.map(o => o._id === orderId ? { ...o, ...updated } : o));
  };

  const filtered = useMemo(() => {
    let list = orders.filter(o =>
      !search ||
      o._id.toLowerCase().includes(search.toLowerCase()) ||
      o.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.user?.email?.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
    return list;
  }, [orders, search, sortDir]);

  const totalPages = pagination?.totalPages ?? 1;

  // Stats
  const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const shippedCount = orders.filter(o => o.status === 'shipped' || o.status === 'delivered').length;

  return (
    <div className="min-h-screen">
      {invoiceOrder && <Invoice order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[0.62rem] tracking-[0.25em] uppercase mb-2 font-bold" style={{ color: '#c9a84c' }}>
              ◆ Admin Console
            </p>
            <h1 style={{ fontFamily: '"Elms Sans", sans-serif', fontSize: '2.4rem', fontWeight: 400, color: '#1a1714', letterSpacing: '-0.5px', lineHeight: 1 }}>
              Order Management
            </h1>
          </div>
          {pagination && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border" style={{ background: '#faf9f7', borderColor: '#ede9e1' }}>
              <ShoppingBag size={14} style={{ color: '#c9a84c' }} />
              <span className="text-[0.72rem] font-semibold text-[#1a1714]">{pagination.total}</span>
              <span className="text-[0.68rem] text-[#a09a90]">total orders</span>
            </div>
          )}
        </div>
        <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, #c9a84c40, #ede9e1, transparent)' }} />
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Page Revenue" value={`$${revenue.toLocaleString()}`} sub={`${orders.length} orders shown`} icon={DollarSign} color="#c9a84c" />
        <StatCard label="Pending Review" value={String(pendingCount)} sub="Need attention" icon={AlertCircle} color="#f59e0b" />
        <StatCard label="Shipped / Done" value={String(shippedCount)} sub="In transit or delivered" icon={Truck} color="#6d28d9" />
        <StatCard label="Total Orders" value={String(pagination?.total ?? orders.length)} sub="All time" icon={TrendingUp} color="#22c55e" />
      </div>

      {/* ── Filter + Search bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border mb-1.5 overflow-hidden" style={{ borderColor: '#ede9e1' }}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: '#f0ece6' }}>
          {/* Status pills */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <Filter size={12} className="text-[#b0a898] mr-1" />
            {[{ label: 'All', value: '' }, ...ALL_STATUSES.map(s => ({ label: STATUS_CONFIG[s]?.label ?? s, value: s }))].map(({ label, value }) => {
              const active = statusFilter === value;
              const cfg = value ? STATUS_CONFIG[value] : null;
              return (
                <button key={value} onClick={() => { setStatusFilter(value); setPage(1); }}
                  className="px-2.5 py-1 rounded-full text-[0.63rem] font-semibold tracking-wide transition-all"
                  style={
                    active && cfg ? { background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }
                    : active ? { background: '#1a1714', color: '#f0e8d0', border: '1px solid #2d2a24' }
                    : { background: '#f5f3f0', color: '#8a8278', border: '1px solid #ede9e1' }
                  }>
                  {label}
                </button>
              );
            })}
          </div>
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4bdb2]" />
            <input
              type="text" placeholder="Search by order ID or customer…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-[0.72rem] rounded-xl outline-none transition-all w-60"
              style={{ background: '#faf9f7', border: '1px solid #ede9e1', color: '#1a1714' }}
            />
          </div>
        </div>

        {/* Column headers */}
        <div className="grid items-center px-5 py-2.5" style={{ gridTemplateColumns: '28px 1.1fr 1.5fr 0.8fr 80px 110px 100px 56px' }}>
          <span />
          {['Order', 'Customer', 'Amount', 'Payment', 'Shipping', 'Status', ''].map((h, i) => (
            <span key={i} className="text-[0.58rem] tracking-[0.18em] uppercase font-bold" style={{ color: '#b0a898' }}>
              {h === 'Order' ? (
                <button className="flex items-center gap-1 hover:text-[#8a7060] transition-colors" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                  {h} {sortDir === 'desc' ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
                </button>
              ) : h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid items-center px-5 py-4 border-t animate-pulse" style={{ gridTemplateColumns: '28px 1.1fr 1.5fr 0.8fr 80px 110px 100px 56px', borderColor: '#f5f3ef' }}>
                <div className="w-5 h-5 rounded-lg bg-[#ede9e1]" />
                {[100, 150, 70, 60, 80, 80, 40].map((w, j) => (
                  <div key={j} className="h-3 bg-[#ede9e1] rounded-lg" style={{ width: w }} />
                ))}
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-t" style={{ borderColor: '#f5f3ef' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#faf9f7', border: '1px solid #ede9e1' }}>
                <ShoppingBag size={22} strokeWidth={1.2} className="text-[#d4cfc8]" />
              </div>
              <p className="text-[0.82rem] font-medium text-[#b0a898] mb-1">No orders found</p>
              <p className="text-[0.7rem] text-[#c4bdb2]">Try adjusting your filters</p>
            </div>
          ) : (
            filtered.map(order => {
              const isExpanded = expandedId === order._id;
              return (
                <div key={order._id} className="border-t" style={{ borderColor: '#f5f3ef' }}>
                  {/* Row */}
                  <div
                    className="grid items-center px-5 py-3.5 cursor-pointer transition-colors group"
                    style={{
                      gridTemplateColumns: '28px 1.1fr 1.5fr 0.8fr 80px 110px 100px 56px',
                      background: isExpanded ? '#faf9f7' : undefined,
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : order._id)}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = '#fdfcfb'; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = ''; }}
                  >
                    {/* Expand icon */}
                    <div className="w-5 h-5 rounded-md flex items-center justify-center transition-all" style={{ background: isExpanded ? '#c9a84c20' : '#f0ece6', color: isExpanded ? '#c9a84c' : '#c4bdb2' }}>
                      {isExpanded ? <ChevronUp size={10} strokeWidth={2.5} /> : <ChevronDown size={10} strokeWidth={2.5} />}
                    </div>

                    {/* Order ID + date */}
                    <div>
                      <p className="font-mono text-[0.67rem] font-bold text-[#1a1714] tracking-wide">
                        #{order._id.slice(-8).toUpperCase()}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar size={9} className="text-[#c4bdb2]" />
                        <p className="text-[0.6rem] text-[#b0a898]">{timeAgo(order.createdAt)}</p>
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold flex-shrink-0"
                        style={{ background: '#c9a84c18', color: '#c9a84c', border: '1.5px solid #c9a84c25' }}>
                        {order.user?.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.73rem] font-semibold text-[#1a1714] truncate">{order.user?.name ?? '—'}</p>
                        <p className="text-[0.62rem] text-[#a09a90] truncate">{order.user?.email ?? '—'}</p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <p className="text-[0.85rem] font-semibold text-[#1a1714]" style={{ fontFamily: '"Elms Sans", sans-serif' }}>
                        ${order.totalAmount.toLocaleString()}
                      </p>
                      <p className="text-[0.6rem] text-[#b0a898]">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Payment */}
                    <span className={`text-[0.62rem] font-bold capitalize ${order.paymentStatus === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                      {order.paymentStatus}
                    </span>

                    {/* Shipping */}
                    <div onClick={e => e.stopPropagation()}>
                      <ShippingChip order={order} />
                    </div>

                    {/* Status selector */}
                    <div onClick={e => e.stopPropagation()}>
                      <StatusSelect orderId={order._id} current={order.status} onUpdate={handleStatusUpdate} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setInvoiceOrder(order)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                        style={{ background: '#c9a84c15', color: '#c9a84c', border: '1px solid #c9a84c30' }}
                        title="Generate invoice"
                      >
                        <FileText size={11} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <OrderDetail
                      order={order}
                      onShippingUpdate={handleShippingUpdate}
                      onInvoice={() => setInvoiceOrder(order)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: '#ede9e1', background: '#faf9f7' }}>
            <span className="text-[0.68rem] text-[#a09a90]">
              Page <span className="font-semibold text-[#1a1714]">{page}</span> of {totalPages}
              {pagination && <span className="ml-2 text-[#c4bdb2]">({pagination.total} total)</span>}
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#c9a84c]/40 hover:bg-white"
                style={{ borderColor: '#ede9e1' }}>
                <ChevronLeft size={13} strokeWidth={2} className="text-[#6b6560]" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-xl text-[0.7rem] font-semibold transition-all"
                    style={p === page
                      ? { background: '#1a1714', color: '#c9a84c', border: '1px solid #1a1714' }
                      : { background: 'transparent', color: '#6b6560', border: '1px solid #ede9e1' }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#c9a84c]/40 hover:bg-white"
                style={{ borderColor: '#ede9e1' }}>
                <ChevronRight size={13} strokeWidth={2} className="text-[#6b6560]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}