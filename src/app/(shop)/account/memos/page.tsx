'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import {
  FileClock, Clock, CheckCircle2, Ban, Send, Plus, Trash2,
  Package, ChevronRight, ShieldCheck, Loader2, AlertCircle, X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface EligibilityStatus {
  memoStatus: 'none' | 'pending' | 'approved' | 'suspended';
  memoCreditLimit: number;
  memoBusinessName: string | null;
  memoResaleCertNumber: string | null;
  memoSuspendedReason: string | null;
}

interface MemoListItem {
  _id: string;
  status: string;
  totalValue: number;
  dueAt: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; price: number; image?: string }>;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  memoEligible?: boolean;
  memoMinDays?: number;
  memoMaxDays?: number;
  stock: number;
  reservedForMemo?: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:           { label: 'Pending Review',   bg: '#fef9ec', text: '#92400e', border: '#fde68a' },
  approved:          { label: 'Approved',         bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  shipped:           { label: 'Shipped',          bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  with_customer:     { label: 'With You',         bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  return_requested:  { label: 'Return Requested', bg: '#fef9ec', text: '#92400e', border: '#fde68a' },
  return_in_transit: { label: 'Return In Transit',bg: '#fef9ec', text: '#92400e', border: '#fde68a' },
  returned:          { label: 'Returned',         bg: '#f9fafb', text: '#4b5563', border: '#d1d5db' },
  overdue:           { label: 'Overdue',          bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  recalled:          { label: 'Recalled',         bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  purchased:         { label: 'Purchased',        bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  force_converted:   { label: 'Converted',        bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  lost:              { label: 'Lost',             bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  damaged:           { label: 'Damaged',          bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  cancelled:         { label: 'Cancelled',        bg: '#f9fafb', text: '#4b5563', border: '#d1d5db' },
  rejected:          { label: 'Rejected',         bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f9fafb', text: '#374151', border: '#d1d5db' };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-semibold tracking-wide"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

export default function MemoProgramPage() {
  const { apiFetch } = useApi();
  const { user } = useAuth();

  const [status, setStatus] = useState<EligibilityStatus | null>(null);
  const [memos, setMemos] = useState<MemoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Apply-for-eligibility form
  const [applyOpen, setApplyOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [resaleCertNumber, setResaleCertNumber] = useState('');
  const [references, setReferences] = useState('');
  const [applying, setApplying] = useState(false);

  // Request-a-memo form
  const [requestOpen, setRequestOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [durationDays, setDurationDays] = useState(7);
  const [address, setAddress] = useState({
    fullName: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'US', phone: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, memosRes] = await Promise.all([
        apiFetch('/api/memo-eligibility/me'),
        apiFetch('/api/memos'),
      ]);
      setStatus(statusRes.data);
      setMemos(memosRes.data ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load memo program details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!requestOpen) return;
    apiFetch('/api/products?limit=100')
      .then((res) => setProducts((res.data ?? []).filter((p: Product) => p.memoEligible)))
      .catch(() => {});
    if (user) {
      setAddress((a) => ({ ...a, fullName: a.fullName || user.name || '', phone: a.phone || user.phone || '' }));
    }
  }, [requestOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    if (!productQuery.trim()) return products;
    const q = productQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const totalValue = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    setApplying(true);
    setError(null);
    try {
      await apiFetch('/api/memo-eligibility/apply', {
        method: 'POST',
        body: JSON.stringify({ businessName, resaleCertNumber: resaleCertNumber || undefined, references: references || undefined }),
      });
      setNotice('Application submitted — our team will review it shortly.');
      setApplyOpen(false);
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to submit application');
    } finally {
      setApplying(false);
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product._id === product._id);
      if (existing) {
        return prev.map((l) => (l.product._id === product._id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.product._id === productId ? { ...l, quantity: Math.max(1, quantity) } : l)));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.product._id !== productId));
  }

  async function submitMemoRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) { setError('Add at least one item to your memo request'); return; }
    if (!termsAccepted) { setError('You must accept the memo agreement to proceed'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/memos', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.product._id, quantity: l.quantity })),
          durationDays,
          shippingAddress: address,
          termsAccepted: true,
        }),
      });
      setNotice('Memo request submitted — you\'ll be notified once it\'s reviewed.');
      setRequestOpen(false);
      setCart([]);
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to submit memo request');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 flex items-center justify-center">
        <Loader2 className="animate-spin" size={22} style={{ color: '#c9a84c' }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #c9a84c 0%, #e8c96a 100%)' }}
        >
          <FileClock size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1814' }}>Memo Program</h1>
          <p className="text-sm" style={{ color: '#9c9690' }}>Request inventory on approval, sell it, then pay or return.</p>
        </div>
      </div>

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#15803d' }}>
            <CheckCircle2 size={15} /> {notice}
          </div>
          <button onClick={() => setNotice(null)} className="text-[#15803d] hover:opacity-70"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#dc2626' }}>
            <AlertCircle size={15} /> {error}
          </div>
          <button onClick={() => setError(null)} className="text-[#dc2626] hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Eligibility status card */}
      <div className="rounded-2xl mb-8 overflow-hidden" style={{ border: '1px solid #e5e2db', background: '#fff' }}>
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} style={{ color: '#c9a84c' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1a1814' }}>Memo Eligibility</p>
              <p className="text-xs mt-0.5" style={{ color: '#9c9690' }}>
                {status?.memoStatus === 'approved' && `Credit limit: $${status.memoCreditLimit.toLocaleString()}`}
                {status?.memoStatus === 'pending' && 'Your application is under review.'}
                {status?.memoStatus === 'suspended' && (status.memoSuspendedReason || 'Your memo privileges are suspended.')}
                {status?.memoStatus === 'none' && 'Apply for trade memo privileges to request inventory before you pay.'}
              </p>
            </div>
          </div>

          {status?.memoStatus === 'none' && (
            <button
              onClick={() => setApplyOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1a1814' }}
            >
              <Send size={14} /> Apply Now
            </button>
          )}
          {status?.memoStatus === 'approved' && (
            <button
              onClick={() => setRequestOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1a1814' }}
            >
              <Plus size={14} /> Request a Memo
            </button>
          )}
          {status && ['pending', 'suspended'].includes(status.memoStatus) && (
            <StatusBadge status={status.memoStatus} />
          )}
        </div>

        {/* Apply form */}
        {applyOpen && status?.memoStatus === 'none' && (
          <form onSubmit={submitApplication} className="px-6 pb-6 pt-2 grid gap-4" style={{ borderTop: '1px solid #ede9e0' }}>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Business name *</label>
              <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Resale certificate number (optional)</label>
              <input value={resaleCertNumber} onChange={(e) => setResaleCertNumber(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Trade references (optional)</label>
              <textarea value={references} onChange={(e) => setReferences(e.target.value)} rows={3}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
            </div>
            <button disabled={applying} type="submit"
              className="justify-self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#c9a84c' }}>
              {applying ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Submit Application
            </button>
          </form>
        )}

        {/* Request a memo form */}
        {requestOpen && status?.memoStatus === 'approved' && (
          <form onSubmit={submitMemoRequest} className="px-6 pb-6 pt-2" style={{ borderTop: '1px solid #ede9e0' }}>
            <div className="grid md:grid-cols-2 gap-6 mt-3">
              {/* Product picker */}
              <div>
                <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Search memo-eligible items</label>
                <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search by name…"
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg" style={{ border: '1px solid #ede9e0' }}>
                  {filteredProducts.length === 0 && (
                    <p className="text-xs px-3 py-3" style={{ color: '#9c9690' }}>No memo-eligible items found.</p>
                  )}
                  {filteredProducts.map((p) => (
                    <button
                      type="button"
                      key={p._id}
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#fafaf8] transition-colors"
                      style={{ borderBottom: '1px solid #ede9e0' }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Package size={13} style={{ color: '#c9a84c' }} className="flex-shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="flex-shrink-0 font-semibold" style={{ color: '#1a1814' }}>${p.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart + duration + address */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Items requested</label>
                  <div className="mt-1 rounded-lg" style={{ border: '1px solid #ede9e0' }}>
                    {cart.length === 0 && <p className="text-xs px-3 py-3" style={{ color: '#9c9690' }}>No items added yet.</p>}
                    {cart.map((l) => (
                      <div key={l.product._id} className="flex items-center justify-between px-3 py-2 gap-2" style={{ borderBottom: '1px solid #ede9e0' }}>
                        <span className="text-sm truncate flex-1">{l.product.name}</span>
                        <input type="number" min={1} value={l.quantity}
                          onChange={(e) => updateQty(l.product._id, Number(e.target.value))}
                          className="w-14 rounded px-2 py-1 text-xs text-center" style={{ border: '1px solid #e5e2db' }} />
                        <button type="button" onClick={() => removeFromCart(l.product._id)} className="text-[#dc2626] hover:opacity-70">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {cart.length > 0 && (
                      <div className="flex justify-between px-3 py-2 text-sm font-semibold" style={{ color: '#1a1814' }}>
                        <span>Total value</span><span>${totalValue.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Memo duration (days)</label>
                  <input type="number" min={1} max={14} value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                </div>
              </div>
            </div>

            {/* Shipping address */}
            <div className="mt-6">
              <label className="text-xs font-semibold" style={{ color: '#5c5852' }}>Ship to</label>
              <div className="grid md:grid-cols-2 gap-3 mt-1">
                <input required placeholder="Full name" value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input required placeholder="Phone" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input required placeholder="Address line 1" value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} className="md:col-span-2 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input placeholder="Address line 2 (optional)" value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} className="md:col-span-2 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input required placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input required placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input required placeholder="Postal code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
                <input required placeholder="Country" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
              </div>
            </div>

            <label className="flex items-center gap-2 mt-4 text-xs" style={{ color: '#5c5852' }}>
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              I accept the memo agreement terms.
            </label>

            <button disabled={submitting} type="submit"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#c9a84c' }}>
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Submit Memo Request
            </button>
          </form>
        )}
      </div>

      {/* Memo list */}
      <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#b5b0a8' }}>Your Memos</h2>
      {memos.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center" style={{ border: '1px dashed #e5e2db', color: '#9c9690' }}>
          <Clock size={22} className="mx-auto mb-2" />
          <p className="text-sm">No memo requests yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {memos.map((m) => (
            <Link
              key={m._id}
              href={`/account/memos/${m._id}`}
              className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition-colors hover:bg-[#fafaf8]"
              style={{ border: '1px solid #e5e2db', background: '#fff' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  <span className="text-xs" style={{ color: '#9c9690' }}>
                    Due {new Date(m.dueAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm mt-1.5 truncate" style={{ color: '#1a1814' }}>
                  {m.items.map((i) => i.name).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-bold" style={{ color: '#1a1814' }}>${m.totalValue.toFixed(2)}</span>
                <ChevronRight size={16} style={{ color: '#b5b0a8' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
