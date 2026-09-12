'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  Gem, Loader2, AlertCircle, CheckCircle2, X, Check, Ban, Lock, Unlock,
} from 'lucide-react';
import DropshipPipelineBar from '@/components/admin/DropshipPipelineBar';

type Status = 'pending' | 'approved' | 'rejected';

interface Application {
  _id: string;
  fullName: string;
  businessName?: string;
  email: string;
  phone?: string;
  website?: string;
  sellingChannels: string[];
  message?: string;
  status: Status;
  active: boolean;
  createdAt: string;
}

const STATUS_META: Record<Status, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fffbeb', color: '#b45309', label: 'Pending' },
  approved: { bg: '#f0fdf4', color: '#15803d', label: 'Approved' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
};

const FILTERS: { label: string; value: '' | Status }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function DropshipApplicationsAdminPage() {
  const { apiFetch } = useApi();
  const [apps, setApps] = useState<Application[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'' | Status>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiFetch(`/api/admin/dropship/applications?${params.toString()}`);
      setApps(res.data?.applications ?? []);
      setPendingCount(res.data?.pendingCount ?? 0);
    } catch (e: any) {
      setError(e.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, action: 'approve' | 'reject' | 'deactivate' | 'reactivate') {
    setActingOn(id);
    setError(null);
    try {
      const payload =
        action === 'reject'
          ? { action, reason: rejectReasons[id] || undefined }
          : { action };
      await apiFetch(`/api/admin/dropship/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const labels: Record<string, string> = {
        approve: 'approved', reject: 'rejected', deactivate: 'deactivated', reactivate: 'reactivated',
      };
      setNotice(`Application ${labels[action]}.`);
      await load();
    } catch (e: any) {
      setError(e.message || `Failed to ${action} application`);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Gem size={20} style={{ color: '#c9a84c' }} />
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#1a1714' }}>Dropship Applications</h1>
          <p className="text-xs" style={{ color: '#9c9690' }}>
            Review and approve sellers applying to the Dropship Program.
            {pendingCount > 0 && <span style={{ color: '#b45309' }}> {pendingCount} pending.</span>}
          </p>
        </div>
      </div>

      <DropshipPipelineBar />

      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={
              statusFilter === f.value
                ? { background: '#1a1714', color: '#fff' }
                : { border: '1px solid #e5e2db', color: '#5c5852' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#15803d' }}><CheckCircle2 size={15} /> {notice}</div>
          <button onClick={() => setNotice(null)} className="text-[#15803d] hover:opacity-70"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#dc2626' }}><AlertCircle size={15} /> {error}</div>
          <button onClick={() => setError(null)} className="text-[#dc2626] hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" size={20} style={{ color: '#c9a84c' }} /></div>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl px-6 py-14 text-center" style={{ border: '1px dashed #e5e2db', color: '#9c9690', background: '#fff' }}>
          <Gem size={22} className="mx-auto mb-2" />
          <p className="text-sm">No applications found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((a) => {
            const meta = STATUS_META[a.status];
            const isActive = a.active !== false;
            return (
              <div key={a._id} className="rounded-2xl px-6 py-5" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: '#1a1714' }}>{a.fullName}</p>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {a.status === 'approved' && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={
                            isActive
                              ? { background: '#f0fdf4', color: '#15803d' }
                              : { background: '#fef2f2', color: '#dc2626' }
                          }
                        >
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: '#9c9690' }}>{a.email} {a.phone && `· ${a.phone}`}</p>
                    <div className="mt-2 text-xs space-y-0.5" style={{ color: '#5c5852' }}>
                      {a.businessName && <p><span className="font-semibold">Business:</span> {a.businessName}</p>}
                      {a.website && <p><span className="font-semibold">Website:</span> {a.website}</p>}
                      {a.sellingChannels?.length > 0 && (
                        <p><span className="font-semibold">Sells on:</span> {a.sellingChannels.join(', ')}</p>
                      )}
                      {a.message && <p><span className="font-semibold">Message:</span> {a.message}</p>}
                      <p className="text-[0.65rem]" style={{ color: '#b5b0a8' }}>Applied {new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {a.status === 'pending' && (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          disabled={actingOn === a._id}
                          onClick={() => act(a._id, 'approve')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: '#15803d' }}
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          disabled={actingOn === a._id}
                          onClick={() => act(a._id, 'reject')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                          style={{ border: '1px solid #e5e2db', color: '#dc2626' }}
                        >
                          <Ban size={13} /> Reject
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Rejection reason (optional)"
                        value={rejectReasons[a._id] ?? ''}
                        onChange={(e) => setRejectReasons((prev) => ({ ...prev, [a._id]: e.target.value }))}
                        className="w-56 rounded-lg px-3 py-2 text-xs"
                        style={{ border: '1px solid #e5e2db' }}
                      />
                    </div>
                  )}

                  {a.status === 'approved' && (
                    <div>
                      {isActive ? (
                        <button
                          disabled={actingOn === a._id}
                          onClick={() => act(a._id, 'deactivate')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                          style={{ border: '1px solid #e5e2db', color: '#dc2626' }}
                          title="Instantly cuts off this seller's private link"
                        >
                          <Lock size={13} /> Deactivate
                        </button>
                      ) : (
                        <button
                          disabled={actingOn === a._id}
                          onClick={() => act(a._id, 'reactivate')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: '#15803d' }}
                        >
                          <Unlock size={13} /> Reactivate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
