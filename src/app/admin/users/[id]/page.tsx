'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Crown, ShoppingBag, Clock, Activity, Mail, Phone,
  MapPin, Calendar, Monitor, Smartphone, Tablet, DollarSign,
} from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserDetail {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'user';
  avatarUrl?: string;
  address?: { line1?: string; city?: string; state?: string; country?: string; postalCode?: string };
  memoStatus?: string;
  createdAt: string;
}

interface OrderRow {
  _id: string;
  items: { name: string; price: number; quantity: number }[];
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
}

interface SessionRow {
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
  duration: number;
  pageViews: number;
  entryPage?: string;
  exitPage?: string;
  device?: { type?: string; browser?: string; os?: string };
}

interface DetailData {
  user: UserDetail;
  purchases: {
    orderCount: number;
    completedOrderCount: number;
    totalSpent: number;
    avgOrderValue: number;
    lastOrderAt: string | null;
  };
  orders: OrderRow[];
  analytics: {
    totalScreenTime: number;
    sessionCount: number;
    totalPageViews: number;
    avgSessionDuration: number;
    lastActiveAt: string | null;
    firstSeenAt: string | null;
    recentSessions: SessionRow[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDuration(seconds: number) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCurrency(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#a09a90', paid: '#7ab0c9', processing: '#c9a84c', shipped: '#9ab87a',
  delivered: '#5a9a5a', cancelled: '#c97a7a', refunded: '#b0a898',
};

const DEVICE_ICON: Record<string, React.ElementType> = {
  mobile: Smartphone, tablet: Tablet, desktop: Monitor,
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatBlock({
  label, value, sub, icon: Icon, accent,
}: { label: string; value: string; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="relative bg-white border border-[#ede9e1] rounded-2xl p-5 overflow-hidden">
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
        <Icon size={17} strokeWidth={1.7} style={{ color: accent }} />
      </div>
      <div className="font-['Cormorant_Garamond',serif] text-[1.7rem] font-medium text-[#1a1714] leading-none mb-1">
        {value}
      </div>
      <div className="text-[0.7rem] text-[#a09a90] tracking-wide uppercase font-medium">{label}</div>
      {sub && <div className="text-[0.68rem] text-[#c4bdb2] mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !authUser || !id) return;
    setLoading(true);
    setError(null);
    authFetch(`/api/admin/users/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.message || 'Failed to load user');
        setData(j.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authLoading, authUser, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[0.8rem] text-[#a09a90]">Loading user…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-[0.85rem] text-[#c97a7a]">{error || 'User not found'}</p>
        <Link href="/admin/users" className="text-[0.75rem] text-[#c9a84c] hover:underline">← Back to Users</Link>
      </div>
    );
  }

  const { user, purchases, orders, analytics } = data;

  return (
    <div className="min-h-screen">
      {/* ── Back link ── */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-[#a09a90] hover:text-[#c9a84c] transition-colors mb-6"
      >
        <ArrowLeft size={13} strokeWidth={2} /> Back to Users
      </Link>

      {/* ── Profile header ── */}
      <div className="bg-white border border-[#ede9e1] rounded-2xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-[1.4rem] font-bold shrink-0"
            style={{
              background: user.role === 'admin' ? '#c9a84c20' : '#7ab0c920',
              color:      user.role === 'admin' ? '#c9a84c'   : '#7ab0c9',
              border: `1px solid ${user.role === 'admin' ? '#c9a84c30' : '#7ab0c930'}`,
            }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-['Cormorant_Garamond',serif] text-[1.8rem] font-medium text-[#1a1714] leading-none">
                {user.name}
              </h1>
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold tracking-wide bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20">
                  <Crown size={9} strokeWidth={2} /> Admin
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-[#8a8278]">
              <span className="flex items-center gap-1.5"><Mail size={12} strokeWidth={1.8} />{user.email}</span>
              {user.phone && <span className="flex items-center gap-1.5"><Phone size={12} strokeWidth={1.8} />{user.phone}</span>}
              {user.address?.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} strokeWidth={1.8} />
                  {[user.address.city, user.address.state, user.address.country].filter(Boolean).join(', ')}
                </span>
              )}
              <span className="flex items-center gap-1.5"><Calendar size={12} strokeWidth={1.8} />Joined {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </div>
        {user.memoStatus && user.memoStatus !== 'none' && (
          <span className="self-start sm:self-center text-[0.65rem] font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full bg-[#faf9f7] border border-[#ede9e1] text-[#4a4540]">
            Memo: {user.memoStatus}
          </span>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatBlock
          label="Total Spent" value={formatCurrency(purchases.totalSpent)} icon={DollarSign} accent="#c9a84c"
          sub={`${purchases.completedOrderCount} paid order${purchases.completedOrderCount === 1 ? '' : 's'}`}
        />
        <StatBlock
          label="Orders Placed" value={String(purchases.orderCount)} icon={ShoppingBag} accent="#7ab0c9"
          sub={purchases.lastOrderAt ? `Last order ${timeAgo(purchases.lastOrderAt)}` : 'No orders yet'}
        />
        <StatBlock
          label="Screen Time" value={formatDuration(analytics.totalScreenTime)} icon={Clock} accent="#9ab87a"
          sub={`${analytics.sessionCount} session${analytics.sessionCount === 1 ? '' : 's'} tracked`}
        />
        <StatBlock
          label="Last Active" value={timeAgo(analytics.lastActiveAt)} icon={Activity} accent="#a87ac9"
          sub={analytics.totalPageViews ? `${analytics.totalPageViews} page views` : 'No activity yet'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Orders ── */}
        <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#ede9e1]">
            <h2 className="text-[0.85rem] font-semibold text-[#1a1714]">Purchase History</h2>
            <p className="text-[0.68rem] text-[#a09a90] mt-0.5">
              Avg order value {formatCurrency(purchases.avgOrderValue)}
            </p>
          </div>
          <div className="flex-1 overflow-auto max-h-[520px]">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingBag size={26} strokeWidth={1.2} className="text-[#d4cfc8] mb-3" />
                <p className="text-[0.78rem] text-[#b0a898]">No orders yet</p>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o._id} className="px-5 py-3.5 border-b border-[#f5f3ef] hover:bg-[#faf9f7] transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[0.78rem] font-medium text-[#1a1714]">
                      {o.items.length} item{o.items.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-[0.82rem] font-semibold text-[#1a1714]">{formatCurrency(o.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.68rem] text-[#a09a90] truncate max-w-[60%]">
                      {o.items.map((it) => it.name).join(', ')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[0.62rem] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{
                          color: ORDER_STATUS_COLORS[o.status] ?? '#8a8278',
                          background: `${ORDER_STATUS_COLORS[o.status] ?? '#8a8278'}15`,
                        }}
                      >
                        {o.status}
                      </span>
                      <span className="text-[0.65rem] text-[#c4bdb2]">{formatDate(o.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Screen time / sessions ── */}
        <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#ede9e1]">
            <h2 className="text-[0.85rem] font-semibold text-[#1a1714]">Recent Sessions</h2>
            <p className="text-[0.68rem] text-[#a09a90] mt-0.5">
              {analytics.firstSeenAt ? `Tracking since ${formatDate(analytics.firstSeenAt)}` : 'No sessions tracked yet'}
            </p>
          </div>
          <div className="flex-1 overflow-auto max-h-[520px]">
            {analytics.recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Clock size={26} strokeWidth={1.2} className="text-[#d4cfc8] mb-3" />
                <p className="text-[0.78rem] text-[#b0a898]">No sessions recorded</p>
                <p className="text-[0.68rem] text-[#c4bdb2] mt-1">
                  Screen time is tracked from the moment this account logs in.
                </p>
              </div>
            ) : (
              analytics.recentSessions.map((s) => {
                const DeviceIcon = DEVICE_ICON[s.device?.type ?? ''] ?? Monitor;
                return (
                  <div key={s.sessionId} className="px-5 py-3.5 border-b border-[#f5f3ef] hover:bg-[#faf9f7] transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-[0.78rem] font-medium text-[#1a1714]">
                        <DeviceIcon size={13} strokeWidth={1.8} className="text-[#c4bdb2]" />
                        {formatDuration(s.duration)}
                      </span>
                      <span className="text-[0.68rem] text-[#a09a90]">{formatDateTime(s.startedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[0.68rem] text-[#a09a90]">
                      <span className="truncate max-w-[65%]">
                        {s.entryPage || '/'} {s.exitPage && s.exitPage !== s.entryPage ? `→ ${s.exitPage}` : ''}
                      </span>
                      <span>{s.pageViews} page{s.pageViews === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}