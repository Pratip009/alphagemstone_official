'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  UserCheck, Loader2, AlertCircle, CheckCircle2, X, Check, Ban, ShieldOff,
} from 'lucide-react';

interface Application {
  _id: string;
  name: string;
  email: string;
  memoBusinessName?: string;
  memoResaleCertNumber?: string;
  memoReferences?: string;
  createdAt: string;
}

export default function MemoEligibilityAdminPage() {
  const { apiFetch } = useApi();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [creditLimits, setCreditLimits] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/memo-eligibility');
      setApps(res.data ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(userId: string, action: 'approve' | 'deny' | 'suspend') {
    setActingOn(userId);
    setError(null);
    try {
      const payload: any = { action };
      if (action === 'approve') {
        const limit = Number(creditLimits[userId]);
        if (!limit || limit <= 0) {
          setError('Enter a valid credit limit before approving');
          setActingOn(null);
          return;
        }
        payload.creditLimit = limit;
      }
      await apiFetch(`/api/admin/memo-eligibility/${userId}`, { method: 'PUT', body: JSON.stringify(payload) });
      setNotice(`Application ${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'suspended'}.`);
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
        <UserCheck size={20} style={{ color: '#c9a84c' }} />
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#1a1714' }}>Memo Applications</h1>
          <p className="text-xs" style={{ color: '#9c9690' }}>Review trade-vetting applications for the memo program.</p>
        </div>
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
          <UserCheck size={22} className="mx-auto mb-2" />
          <p className="text-sm">No pending applications.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((a) => (
            <div key={a._id} className="rounded-2xl px-6 py-5" style={{ border: '1px solid #ede9e1', background: '#fff' }}>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a1714' }}>{a.name}</p>
                  <p className="text-xs" style={{ color: '#9c9690' }}>{a.email}</p>
                  <div className="mt-2 text-xs space-y-0.5" style={{ color: '#5c5852' }}>
                    {a.memoBusinessName && <p><span className="font-semibold">Business:</span> {a.memoBusinessName}</p>}
                    {a.memoResaleCertNumber && <p><span className="font-semibold">Resale cert:</span> {a.memoResaleCertNumber}</p>}
                    {a.memoReferences && <p><span className="font-semibold">References:</span> {a.memoReferences}</p>}
                    <p className="text-[0.65rem]" style={{ color: '#b5b0a8' }}>Applied {new Date(a.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    placeholder="Credit limit $"
                    value={creditLimits[a._id] ?? ''}
                    onChange={(e) => setCreditLimits((prev) => ({ ...prev, [a._id]: e.target.value }))}
                    className="w-32 rounded-lg px-3 py-2 text-xs"
                    style={{ border: '1px solid #e5e2db' }}
                  />
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
                    onClick={() => act(a._id, 'deny')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                    style={{ border: '1px solid #e5e2db', color: '#1a1714' }}
                  >
                    <Ban size={13} /> Deny
                  </button>
                  <button
                    disabled={actingOn === a._id}
                    onClick={() => act(a._id, 'suspend')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                    style={{ color: '#dc2626' }}
                  >
                    <ShieldOff size={13} /> Suspend
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
