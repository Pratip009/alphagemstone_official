'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useAuth } from '@/hooks/useAuth';
import {
  ShoppingBag, Search, ChevronLeft, ChevronRight,
  Package, Clock, Truck, CheckCircle, XCircle, RefreshCw,
  FileText, Printer, X, MapPin, AlertCircle,
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

interface TrackingEvent {
  timestamp: string;
  eventType?: string;
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
  // ShipEngine shipping fields
  shippingCarrier?:           string | null;
  shippingService?:           string | null;
  shippingServiceCode?:       string | null;
  shippingRateId?:            string | null;
  shippingRate?:              number;
  shippingEstimatedDelivery?: string | null;
  shippingEstimatedDays?:     number | null;
  trackingNumber?:            string | null;
  trackingUrl?:               string | null;
  labelId?:                   string | null;
  labelUrl?:                  string | null;
  shippedAt?:                 string | null;
  // legacy
  fedex?: CarrierShipment;
  usps?:  CarrierShipment;
  ups?:   CarrierShipment;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  pending:    { label: 'Pending',    bg: '#fdf5e6', text: '#8b5e1a', border: '#e0c070', icon: Clock },
  paid:       { label: 'Paid',       bg: '#edf7ed', text: '#2d6b2d', border: '#80c880', icon: CheckCircle },
  processing: { label: 'Processing', bg: '#e8f0fb', text: '#1a4a9e', border: '#7ab0c9', icon: RefreshCw },
  shipped:    { label: 'Shipped',    bg: '#f3eefb', text: '#5a2d8b', border: '#b090d4', icon: Truck },
  delivered:  { label: 'Delivered',  bg: '#edf7ed', text: '#2d6b2d', border: '#80c880', icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  bg: '#fdf0f0', text: '#9e2d2d', border: '#d48080', icon: XCircle },
  refunded:   { label: 'Refunded',   bg: '#f5f5f5', text: '#5a5a5a', border: '#b0b0b0', icon: RefreshCw },
};

const ALL_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function Invoice({ order, onClose }: { order: Order; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const invoiceNumber = `INV-${order._id.slice(-8).toUpperCase()}`;
  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-white/60 text-sm font-mono">{invoiceNumber}</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-white text-sm font-medium rounded-lg hover:bg-[#b8963e] transition-colors">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>
        <div ref={invoiceRef} style={{ fontFamily: "'DM Sans', sans-serif", background: '#fff', padding: '52px 60px', minHeight: '297mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 44 }}>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: '#1a1714', letterSpacing: '-0.5px', lineHeight: 1 }}>
                Alpha<span style={{ color: '#c9a84c' }}>Imports</span>
              </div>
              <div style={{ fontSize: 9, color: '#a09a90', marginTop: 6, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Fine Gemstones & Jewellery</div>
              <div style={{ marginTop: 18, fontSize: 12, color: '#6b6560', lineHeight: 1.8 }}>
                <div>123 Gem Street, Suite 4</div><div>New York, NY 10001, United States</div>
                <div style={{ color: '#c9a84c', marginTop: 2 }}>admin@alphaimports.com</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 46, fontWeight: 300, color: '#1a1714', letterSpacing: '-2px', lineHeight: 1 }}>INVOICE</div>
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
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: '#c9a84c' }}>${order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #ede9e1', paddingTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 28 }}>
            {/* Payment */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09a90', fontWeight: 600, marginBottom: 10 }}>Payment</div>
              <div style={{ fontSize: 13, color: '#1a1714', fontWeight: 500, textTransform: 'capitalize', marginBottom: 4 }}>{order.paymentMethod}</div>
              <div style={{ fontSize: 11, color: '#a09a90', fontFamily: 'monospace' }}>Ref: {order._id.slice(-12).toUpperCase()}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: order.paymentStatus === 'completed' ? '#2d6b2d' : '#8b5e1a', fontWeight: 500, textTransform: 'capitalize' }}>Payment {order.paymentStatus}</div>
            </div>
            {/* Shipping */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09a90', fontWeight: 600, marginBottom: 10 }}>Shipping</div>
              {order.shippingCarrier || order.trackingNumber ? (
                <>
                  <div style={{ fontSize: 13, color: '#1a1714', fontWeight: 500, marginBottom: 4 }}>{order.shippingCarrier ?? '—'}</div>
                  {order.shippingService && <div style={{ fontSize: 11, color: '#6b6560', marginBottom: 4 }}>{order.shippingService}</div>}
                  {order.trackingNumber && (
                    <div style={{ fontSize: 11, color: '#a09a90', fontFamily: 'monospace', marginBottom: 4 }}>
                      #{order.trackingNumber}
                    </div>
                  )}
                  {order.shippingEstimatedDelivery && (
                    <div style={{ fontSize: 11, color: '#6b6560' }}>Est. {order.shippingEstimatedDelivery}</div>
                  )}
                  {order.shippedAt && (
                    <div style={{ fontSize: 11, color: '#6b6560', marginTop: 4 }}>
                      Shipped {new Date(order.shippedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#c4bdb2', fontStyle: 'italic' }}>
                  {order.shippingRateId ? 'Label pending purchase' : 'Awaiting shipment'}
                </div>
              )}
            </div>
            {/* Notes */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09a90', fontWeight: 600, marginBottom: 10 }}>Notes</div>
              <div style={{ fontSize: 12, color: '#8a8278', lineHeight: 1.7 }}>Thank you for your purchase. All gemstones come with a certificate of authenticity. For enquiries, contact support@alphaimports.com</div>
            </div>
          </div>
          <div style={{ marginTop: 52, textAlign: 'center', borderTop: '1px solid #f0ece6', paddingTop: 22 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: '#c9a84c', fontStyle: 'italic', marginBottom: 6 }}>Alpha Imports — Fine Gemstones & Jewellery</div>
            <div style={{ fontSize: 10, color: '#c4bdb2', letterSpacing: '0.12em' }}>www.alphaimports.com · support@alphaimports.com · +1 (800) 555-0100</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f5f5f5', text: '#555', border: '#ccc', icon: Package };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.62rem] font-semibold tracking-wide" style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
      <Icon size={9} strokeWidth={2.5} />{cfg.label}
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

  const cfg = STATUS_CONFIG[current] ?? { bg: '#f5f5f5', text: '#555', border: '#ccc' };
  return (
    <select value={current} onChange={handleChange} disabled={updating}
      className="text-[0.68rem] font-semibold rounded-full px-2.5 py-1 outline-none cursor-pointer disabled:opacity-50 transition-all"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
      {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
    </select>
  );
}

// ─── Shipping Indicator for table row ─────────────────────────────────────────
function ShippingIndicator({ order }: { order: Order }) {
  if (order.trackingNumber) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold"
          style={{ background: '#edf7ed', color: '#2d6b2d', border: '1px solid #80c880' }}>
          <Truck size={8} /> Shipped
        </span>
        <span className="font-mono text-[0.58rem] text-[#a09a90] truncate max-w-[110px]">{order.trackingNumber}</span>
      </div>
    );
  }
  if (order.shippingRateId && order.paymentStatus === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold"
        style={{ background: '#e8f0fb', color: '#1a4a9e', border: '1px solid #7ab0c9' }}>
        <Package size={8} /> Label Ready
      </span>
    );
  }
  if (order.shippingRateId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold"
        style={{ background: '#fdf5e6', color: '#8b5e1a', border: '1px solid #e0c070' }}>
        <Clock size={8} /> Rate Selected
      </span>
    );
  }
  return <span className="text-[0.6rem] text-[#c4bdb2]">—</span>;
}

// ─── Expanded Order Detail ────────────────────────────────────────────────────
function OrderDetail({ order, onShippingUpdate }: {
  order: Order;
  onShippingUpdate: (orderId: string, updated: Partial<Order>) => void;
}) {
  const shippingData: OrderShippingData = {
    _id:                        order._id,
    shippingCarrier:            order.shippingCarrier,
    shippingService:            order.shippingService,
    shippingRateId:             order.shippingRateId,
    shippingRate:               order.shippingRate,
    shippingEstimatedDelivery:  order.shippingEstimatedDelivery,
    shippingEstimatedDays:      order.shippingEstimatedDays,
    trackingNumber:             order.trackingNumber,
    trackingUrl:                order.trackingUrl,
    labelId:                    order.labelId,
    labelUrl:                   order.labelUrl,
    shippedAt:                  order.shippedAt,
    status:                     order.status,
    paymentStatus:              order.paymentStatus,
  };

  return (
    <div className="bg-[#faf9f7] border-t border-[#ede9e1] px-6 py-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Items */}
        <div>
          <p className="text-[0.62rem] tracking-widest uppercase text-[#a09a90] font-semibold mb-2">Items</p>
          <div className="flex flex-col gap-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ede9e1] flex items-center justify-center text-sm flex-shrink-0">💎</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] font-medium text-[#1a1714] truncate">{item.name}</p>
                  <p className="text-[0.65rem] text-[#a09a90]">Qty {item.quantity} × ${item.price.toLocaleString()}</p>
                </div>
                <p className="text-[0.75rem] font-semibold text-[#1a1714]">${(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#ede9e1] grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Subtotal', value: `$${order.subtotal.toLocaleString()}` },
              { label: 'Tax',      value: `$${order.tax.toFixed(2)}` },
              { label: 'Total',    value: `$${order.totalAmount.toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[0.6rem] uppercase tracking-widest text-[#a09a90]">{label}</p>
                <p className={`text-[0.8rem] font-semibold ${label === 'Total' ? 'text-[#c9a84c]' : 'text-[#1a1714]'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ship to */}
        <div>
          <p className="text-[0.62rem] tracking-widest uppercase text-[#a09a90] font-semibold mb-2">Ship To</p>
          <div className="text-[0.75rem] text-[#5a5249] leading-relaxed">
            <p className="font-medium text-[#1a1714]">{order.shippingAddress.fullName}</p>
            <p>{order.shippingAddress.addressLine1}</p>
            {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
            <p>{order.shippingAddress.country}</p>
            {order.shippingAddress.phone && <p className="mt-1 text-[#a09a90]">{order.shippingAddress.phone}</p>}
          </div>
        </div>
      </div>

      {/* ── ShipEngine Shipping Panel ── */}
      <AdminOrderShipping
        order={shippingData}
        onUpdate={(updated) => onShippingUpdate(order._id, updated as Partial<Order>)}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const { token, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [orders, setOrders]             = useState<Order[]>([]);
  const [pagination, setPagination]     = useState<Pagination | null>(null);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (authLoading || !token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (statusFilter) params.set('status', statusFilter);

    authFetch(`/api/admin/orders?${params}`)
      .then(r => r.json())
      .then(j => { setOrders(j.data ?? []); setPagination(j.pagination ?? null); })
      .catch(e => console.error('[orders]', e))
      .finally(() => setLoading(false));
  }, [authLoading, token, page, statusFilter, authFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusUpdate = (id: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o._id === id ? { ...o, status: newStatus } : o));
  };

  const handleShippingUpdate = (orderId: string, updated: Partial<Order>) => {
    setOrders(prev => prev.map(o =>
      o._id === orderId ? { ...o, ...updated } : o
    ));
  };

  const filtered = orders.filter(o =>
    !search ||
    o._id.toLowerCase().includes(search.toLowerCase()) ||
    o.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="min-h-screen">
      {invoiceOrder && <Invoice order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[0.68rem] tracking-[0.22em] uppercase text-[#c9a84c] font-semibold mb-2">◆ Alpha Imports</p>
            <h1 className="font-['Cormorant_Garamond',serif] text-[2.6rem] font-medium text-[#1a1714] tracking-tight leading-none">Orders</h1>
          </div>
          {pagination && (
            <div className="text-right hidden sm:block">
              <p className="text-[0.7rem] text-[#a09a90] tracking-wide">{pagination.total} total orders</p>
              <p className="text-[0.65rem] text-[#c9a84c] tracking-widest uppercase mt-0.5 font-semibold">
                {orders.filter(o => o.status === 'pending').length} pending
              </p>
            </div>
          )}
        </div>
        <div className="mt-5 h-px bg-gradient-to-r from-[#c9a84c]/30 via-[#ede9e1] to-transparent" />
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[{ label: 'All', value: '' }, ...ALL_STATUSES.map(s => ({ label: STATUS_CONFIG[s]?.label ?? s, value: s }))].map(({ label, value }) => {
          const active = statusFilter === value;
          const cfg = value ? STATUS_CONFIG[value] : null;
          return (
            <button key={value} onClick={() => { setStatusFilter(value); setPage(1); }}
              className="px-3 py-1.5 rounded-full text-[0.68rem] font-semibold tracking-wide transition-all"
              style={
                active && cfg ? { background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }
                : active ? { background: '#1a1714', color: '#f0e8d0', border: '1px solid #1a1714' }
                : { background: '#fff', color: '#a09a90', border: '1px solid #ede9e1' }
              }>
              {label}
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede9e1]">
          <p className="text-[0.72rem] text-[#a09a90]">
            Showing <span className="font-semibold text-[#1a1714]">{filtered.length}</span> orders
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4bdb2]" strokeWidth={2} />
            <input type="text" placeholder="Search by ID or customer…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-[0.72rem] bg-[#faf9f7] border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all w-52 placeholder:text-[#c4bdb2]" />
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1.2fr_1.6fr_1fr_90px_130px_110px_160px] px-5 py-2.5 border-b border-[#ede9e1] bg-[#faf9f7]">
          {['Order ID', 'Customer', 'Total', 'Payment', 'Shipping', 'Status', 'Date'].map(h => (
            <span key={h} className="text-[0.6rem] tracking-[0.15em] uppercase text-[#b0a898] font-semibold">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1.2fr_1.6fr_1fr_90px_130px_110px_160px] px-5 py-4 border-b border-[#f5f3ef] animate-pulse">
                {[120, 160, 80, 60, 90, 90, 80].map((w, j) => (
                  <div key={j} className="h-3 bg-[#ede9e1] rounded" style={{ width: w }} />
                ))}
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ShoppingBag size={28} strokeWidth={1.2} className="text-[#d4cfc8] mb-3" />
              <p className="text-[0.78rem] text-[#b0a898]">No orders found</p>
            </div>
          ) : (
            filtered.map(order => (
              <div key={order._id}>
                <div
                  className="grid grid-cols-[1.2fr_1.6fr_1fr_90px_130px_110px_160px] px-5 py-3.5 border-b border-[#f5f3ef] hover:bg-[#faf9f7] transition-colors cursor-pointer items-center"
                  onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}
                >
                  {/* Order ID */}
                  <span className="font-mono text-[0.68rem] text-[#a09a90] tracking-wide">
                    #{order._id.slice(-8).toUpperCase()}
                  </span>

                  {/* Customer */}
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold shrink-0"
                      style={{ background: '#c9a84c20', color: '#c9a84c', border: '1px solid #c9a84c30' }}>
                      {order.user?.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.75rem] font-medium text-[#1a1714] truncate">{order.user?.name ?? '—'}</p>
                      <p className="text-[0.65rem] text-[#a09a90] truncate">{order.user?.email ?? '—'}</p>
                    </div>
                  </div>

                  {/* Total */}
                  <span className="text-[0.82rem] font-semibold text-[#1a1714]">${order.totalAmount.toLocaleString()}</span>

                  {/* Payment */}
                  <span className={`text-[0.65rem] font-semibold tracking-wide capitalize ${order.paymentStatus === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                    {order.paymentStatus}
                  </span>

                  {/* Shipping indicator (all 3 carriers) */}
                  <div onClick={e => e.stopPropagation()}>
                    <ShippingIndicator order={order} />
                  </div>

                  {/* Status */}
                  <div onClick={e => e.stopPropagation()}>
                    <StatusSelect orderId={order._id} current={order.status} onUpdate={handleStatusUpdate} />
                  </div>

                  {/* Date + Invoice */}
                  <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-[0.68rem] text-[#a09a90]">{timeAgo(order.createdAt)}</span>
                    <button onClick={() => setInvoiceOrder(order)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[0.62rem] font-semibold transition-all hover:scale-105"
                      style={{ background: '#c9a84c12', color: '#c9a84c', border: '1px solid #c9a84c30' }}>
                      <FileText size={10} strokeWidth={2} /> Invoice
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === order._id && (
                  <OrderDetail order={order} onShippingUpdate={handleShippingUpdate} />
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#ede9e1] bg-[#faf9f7]">
            <span className="text-[0.68rem] text-[#a09a90]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg border border-[#ede9e1] flex items-center justify-center hover:border-[#c9a84c]/40 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={13} strokeWidth={2} className="text-[#6b6560]" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-lg text-[0.7rem] font-semibold transition-all"
                    style={p === page ? { background: '#c9a84c', color: '#fff', border: '1px solid #c9a84c' } : { background: 'transparent', color: '#6b6560', border: '1px solid #ede9e1' }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-7 h-7 rounded-lg border border-[#ede9e1] flex items-center justify-center hover:border-[#c9a84c]/40 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={13} strokeWidth={2} className="text-[#6b6560]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}