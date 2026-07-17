'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import {
  FileClock, Loader2, AlertCircle, ChevronRight, ChevronLeft,
  TrendingUp, AlertTriangle, DollarSign, PackageCheck,
} from 'lucide-react';

interface MemoRow {
  _id: string;
  status: string;
  totalValue: number;
  dueAt: string;
  createdAt: string;
  user: { name: string; email: string } | null;
  items: Array<{ name: string; quantity: number }>;
}

interface Stats {
  activeCount: number;
  overdueCount: number;
  totalValueOutstanding: number;
  convertedThisMonth: { total: number; count: number };
}

const STATUS_OPTIONS = [
  '', 'pending', 'approved', 'shipped', 'with_customer', 'return_requested',
  'return_in_transit', 'returned', 'overdue', 'recalled', 'purchased',
  'force_converted', 'lost', 'damaged', 'cancelled', 'rejected',
];

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

export default function AdminMemosPage() {
  const { apiFetch } = useApi();
  const [memos, setMemos] = useState<MemoRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) qs.set('status', status);
      const [memosRes, statsRes] = await Promise.all([
        apiFetch(`/api/admin/memos?${qs.toString()}`),
        apiFetch('/api/admin/memos/stats'),
      ]);
      setMemos(memosRes.data.items ?? []);
      setTotalPages(Math.max(1, Math.ceil(memosRes.data.total / memosRes.data.limit)));
      setStats(statsRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load memos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileClock size={20} style={{ color: '#c9a84c' }} />
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#1a1714' }}>Memos</h1>
          <p className="text-xs" style={{ color: '#9c9690' }}>Track and manage trade memo requests across all customers.</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Memos', value: stats.activeCount, icon: PackageCheck, color: '#1d4ed8' },
            { label: 'Overdue', value: stats.overdueCount, icon: AlertTriangle, color: '#dc2626' },
            { label: 'Value Outstanding', value: `$${stats.totalValueOutstanding.toLocaleString()}`, icon: DollarSign, color: '#c9a84c' },
            { label: 'Converted This Month', value: `${stats.convertedThisMonth.count} · $${stats.convertedThisMonth.total.toLocaleString()}`, icon: TrendingUp, color: '#15803d' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl px-5 py-4" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color }} />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: '#b5b0a8' }}>{label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: '#1a1714' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
            style={
              status === s
                ? { background: '#1a1714', color: '#fff' }
                : { background: '#fff', color: '#5c5852', border: '1px solid #e5e2db' }
            }
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" size={20} style={{ color: '#c9a84c' }} /></div>
      ) : memos.length === 0 ? (
        <div className="rounded-2xl px-6 py-14 text-center" style={{ border: '1px dashed #e5e2db', color: '#9c9690', background: '#fff' }}>
          <FileClock size={22} className="mx-auto mb-2" />
          <p className="text-sm">No memos match this filter.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
            {memos.map((m) => (
              <Link
                key={m._id}
                href={`/admin/memos/${m._id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[#fafaf8]"
                style={{ borderBottom: '1px solid #ede9e1' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status} />
                    <span className="text-xs" style={{ color: '#9c9690' }}>Due {new Date(m.dueAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm mt-1.5" style={{ color: '#1a1714' }}>
                    {m.user?.name ?? 'Unknown customer'} <span style={{ color: '#9c9690' }}>· {m.user?.email}</span>
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#9c9690' }}>
                    {m.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-bold" style={{ color: '#1a1714' }}>${m.totalValue.toFixed(2)}</span>
                  <ChevronRight size={16} style={{ color: '#b5b0a8' }} />
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-lg disabled:opacity-40" style={{ border: '1px solid #e5e2db' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs" style={{ color: '#9c9690' }}>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-lg disabled:opacity-40" style={{ border: '1px solid #e5e2db' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
