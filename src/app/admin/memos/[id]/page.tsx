'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, MapPin, Loader2, AlertCircle, CheckCircle2, X, History,
  Check, Ban, Truck, RotateCcw, Undo2, Zap, MessageSquarePlus, CalendarPlus,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';

interface MemoEvent {
  status: string;
  note?: string;
  actedByRole: string;
  at: string;
}

interface MemoItem {
  name: string;
  price: number;
  quantity: number;
  itemStatus: string;
}

interface MemoDetail {
  _id: string;
  status: string;
  totalValue: number;
  requestedDurationDays: number;
  dueAt: string;
  createdAt: string;
  extensionCount: number;
  rejectedReason?: string;
  items: MemoItem[];
  user: { name: string; email: string; memoCreditLimit: number; memoStatus: string } | null;
  shippingAddress: {
    fullName: string; addressLine1: string; addressLine2?: string;
    city: string; state: string; postalCode: string; country: string; phone: string;
  };
  events: MemoEvent[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Pending', bg: '#fef9ec', text: '#92400e', border: '#fde68a' },
  approved: { label: 'Approved', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  shipped: { label: 'Shipped', bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  with_customer: { label: 'With Customer', bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  return_requested: { label: 'Return Requested', bg: '#fef9ec', text: '#92400e', border: '#fde68a' },
  return_in_transit: { label: 'Return In Transit', bg: '#fef9ec', text: '#92400e', border: '#fde68a' },
  returned: { label: 'Returned', bg: '#f9fafb', text: '#4b5563', border: '#d1d5db' },
  overdue: { label: 'Overdue', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  recalled: { label: 'Recalled', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  purchased: { label: 'Purchased', bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  force_converted: { label: 'Converted', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  lost: { label: 'Lost', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  damaged: { label: 'Damaged', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  cancelled: { label: 'Cancelled', bg: '#f9fafb', text: '#4b5563', border: '#d1d5db' },
  rejected: { label: 'Rejected', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f9fafb', text: '#374151', border: '#d1d5db' };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-semibold tracking-wide"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

export default function AdminMemoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch } = useApi();

  const [memo, setMemo] = useState<MemoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [extendDays, setExtendDays] = useState(3);
  const [showExtend, setShowExtend] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [suspendUser, setSuspendUser] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/memos/${id}`);
      setMemo(res.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load memo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAction(action: string, fn: () => Promise<any>, after?: () => void) {
    setActionLoading(action);
    setError(null);
    try {
      await fn();
      setNotice('Done — memo updated.');
      after?.();
      await load();
    } catch (e: any) {
      setError(e.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin" size={20} style={{ color: '#c9a84c' }} /></div>;
  }

  if (!memo) {
    return (
      <div className="text-center py-24">
        <p className="text-sm" style={{ color: '#9c9690' }}>{error || 'Memo not found.'}</p>
        <button onClick={() => router.push('/admin/memos')} className="text-sm font-semibold mt-3" style={{ color: '#c9a84c' }}>Back to Memos</button>
      </div>
    );
  }

  const s = memo.status;

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.push('/admin/memos')} className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 hover:opacity-70" style={{ color: '#5c5852' }}>
        <ArrowLeft size={15} /> Back to Memos
      </button>

      {notice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#15803d' }}><CheckCircle2 size={15} /> {notice}</div>
          <button onClick={() => setNotice(null)} className="text-[#15803d] hover:opacity-70"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#dc2626' }}><AlertCircle size={15} /> {error}</div>
          <button onClick={() => setError(null)} className="text-[#dc2626] hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
        <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <StatusBadge status={memo.status} />
            <p className="text-sm mt-2 font-semibold" style={{ color: '#1a1714' }}>{memo.user?.name}</p>
            <p className="text-xs" style={{ color: '#9c9690' }}>{memo.user?.email} · Credit limit ${memo.user?.memoCreditLimit?.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: '#9c9690' }}>
              Requested {new Date(memo.createdAt).toLocaleDateString()} · Due {new Date(memo.dueAt).toLocaleDateString()}
            </p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#1a1714' }}>${memo.totalValue.toFixed(2)}</p>
        </div>

        <div className="px-6 pb-5" style={{ borderTop: '1px solid #ede9e1' }}>
          <p className="text-[0.6rem] font-bold uppercase tracking-widest mt-4 mb-3" style={{ color: '#b5b0a8' }}>Items</p>
          <div className="flex flex-col divide-y" style={{ borderColor: '#ede9e1' }}>
            {memo.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ede9e0' }}>
                    <Package size={15} style={{ color: '#8a7d6e' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1a1714' }}>{item.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9c9690' }}>Qty {item.quantity} · {item.itemStatus}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold flex-shrink-0" style={{ color: '#1a1714' }}>${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6" style={{ borderTop: '1px solid #ede9e1' }}>
          <p className="text-[0.6rem] font-bold uppercase tracking-widest mt-4 mb-3" style={{ color: '#b5b0a8' }}>Ship to</p>
          <div className="rounded-xl px-4 py-4 flex items-start gap-3" style={{ background: '#fafaf8', border: '1px solid #e5e2db' }}>
            <MapPin size={14} style={{ color: '#c9a84c', flexShrink: 0, marginTop: '1px' }} />
            <div className="text-xs leading-relaxed" style={{ color: '#5c5852' }}>
              <p className="font-semibold text-sm mb-0.5" style={{ color: '#1a1714' }}>{memo.shippingAddress.fullName}</p>
              <p>{memo.shippingAddress.addressLine1}</p>
              {memo.shippingAddress.addressLine2 && <p>{memo.shippingAddress.addressLine2}</p>}
              <p>{memo.shippingAddress.city}, {memo.shippingAddress.state} {memo.shippingAddress.postalCode}</p>
              <p>{memo.shippingAddress.country} · {memo.shippingAddress.phone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-2xl px-6 py-5 mb-6 flex flex-col gap-4" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
        <p className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: '#b5b0a8' }}>Actions</p>

        <div className="flex flex-wrap gap-3">
          {s === 'pending' && (
            <>
              <button disabled={!!actionLoading}
                onClick={() => runAction('approve', () => apiFetch(`/api/admin/memos/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'approve' }) }))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#15803d' }}>
                {actionLoading === 'approve' ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Approve
              </button>
              <button onClick={() => setShowReject((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#dc2626' }}>
                <Ban size={14} /> Reject
              </button>
            </>
          )}

          {s === 'approved' && (
            <button disabled={!!actionLoading}
              onClick={() => runAction('purchase-label', () => apiFetch(`/api/admin/memos/${id}/purchase-label`, { method: 'POST' }))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#1a1714' }}>
              {actionLoading === 'purchase-label' ? <Loader2 className="animate-spin" size={14} /> : <Truck size={14} />} Purchase Outbound Label
            </button>
          )}

          {['shipped', 'with_customer', 'overdue'].includes(s) && (
            <button disabled={!!actionLoading}
              onClick={() => runAction('recall', () => apiFetch(`/api/admin/memos/${id}/recall`, { method: 'POST', body: JSON.stringify({}) }))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#dc2626', border: '1px solid #fca5a5' }}>
              {actionLoading === 'recall' ? <Loader2 className="animate-spin" size={14} /> : <Undo2 size={14} />} Recall
            </button>
          )}

          {['return_requested', 'return_in_transit', 'overdue'].includes(s) && (
            <>
              <button disabled={!!actionLoading}
                onClick={() => runAction('mark-returned-ok', () => apiFetch(`/api/admin/memos/${id}/mark-returned`, { method: 'POST', body: JSON.stringify({ condition: 'ok' }) }))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#15803d' }}>
                {actionLoading === 'mark-returned-ok' ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />} Mark Returned (OK)
              </button>
              <button disabled={!!actionLoading}
                onClick={() => runAction('mark-returned-damaged', () => apiFetch(`/api/admin/memos/${id}/mark-returned`, { method: 'POST', body: JSON.stringify({ condition: 'damaged' }) }))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#dc2626', border: '1px solid #fca5a5' }}>
                {actionLoading === 'mark-returned-damaged' ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />} Mark Returned (Damaged)
              </button>
            </>
          )}

          {s === 'overdue' && (
            <div className="w-full flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs" style={{ color: '#5c5852' }}>
                <input type="checkbox" checked={suspendUser} onChange={(e) => setSuspendUser(e.target.checked)} /> Suspend customer's memo privileges
              </label>
              <button disabled={!!actionLoading}
                onClick={() => runAction('force-convert', () => apiFetch(`/api/admin/memos/${id}/force-convert`, { method: 'POST', body: JSON.stringify({ suspendUser }) }))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#dc2626' }}>
                {actionLoading === 'force-convert' ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} Force Convert
              </button>
            </div>
          )}

          {s === 'with_customer' && (
            <button onClick={() => setShowExtend((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ border: '1px solid #e5e2db', color: '#1a1714' }}>
              <CalendarPlus size={14} /> Approve Extension
            </button>
          )}

          <button onClick={() => setShowNote((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ border: '1px solid #e5e2db', color: '#1a1714' }}>
            <MessageSquarePlus size={14} /> Add Note
          </button>
        </div>

        {showReject && (
          <div className="flex items-center gap-3">
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection…"
              className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
            <button disabled={!!actionLoading || !rejectReason.trim()}
              onClick={() => runAction('reject', () => apiFetch(`/api/admin/memos/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'reject', reason: rejectReason }) }), () => { setShowReject(false); setRejectReason(''); })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: '#dc2626' }}>
              Confirm Reject
            </button>
          </div>
        )}

        {showExtend && (
          <div className="flex items-center gap-3">
            <input type="number" min={1} max={14} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))}
              className="w-20 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
            <span className="text-xs" style={{ color: '#9c9690' }}>extra day(s)</span>
            <button disabled={!!actionLoading}
              onClick={() => runAction('extend', () => apiFetch(`/api/admin/memos/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'extend', extraDays: extendDays }) }), () => setShowExtend(false))}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: '#1a1714' }}>
              Confirm Extension
            </button>
          </div>
        )}

        {showNote && (
          <div className="flex items-center gap-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note…"
              className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #e5e2db' }} />
            <button disabled={!!actionLoading || !note.trim()}
              onClick={() => runAction('note', () => apiFetch(`/api/admin/memos/${id}`, { method: 'PUT', body: JSON.stringify({ action: 'note', note }) }), () => { setShowNote(false); setNote(''); })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: '#1a1714' }}>
              Add
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl px-6 py-5" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
        <p className="text-[0.6rem] font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: '#b5b0a8' }}>
          <History size={12} /> History
        </p>
        <div className="flex flex-col gap-3">
          {[...memo.events].reverse().map((e, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#c9a84c' }} />
              <div>
                <p className="text-sm" style={{ color: '#1a1714' }}>
                  <StatusBadge status={e.status} /> <span className="ml-1 text-xs capitalize" style={{ color: '#9c9690' }}>by {e.actedByRole}</span>
                </p>
                {e.note && <p className="text-xs mt-1" style={{ color: '#5c5852' }}>{e.note}</p>}
                <p className="text-[0.65rem] mt-0.5" style={{ color: '#b5b0a8' }}>{new Date(e.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
