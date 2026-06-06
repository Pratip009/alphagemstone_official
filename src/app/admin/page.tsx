'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Gem, UploadCloud, Layers, ShoppingBag, ArrowRight,
  Users, TrendingUp, Package, Crown, ChevronLeft, ChevronRight, Search,
  HomeIcon, BookOpen,
} from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useAuth } from '@/hooks/useAuth';


// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  products: { total: number; active: number; newThisMonth: number };
  users:    { total: number; newThisMonth: number; growth: number };
  categories: { total: number };
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface UsersData {
  users: User[];
  total: number;
  adminCount: number;
  userCount: number;
  newThisMonth: number;
  page: number;
  limit: number;
}

// ─── Nav links ────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: '/',     label: 'Home',      icon: HomeIcon, desc: 'Home Page',            accent: '#c2c97a' },
  { href: '/admin/products',   label: 'Products',    icon: Gem,         desc: 'Manage catalogue',           accent: '#c9a84c' },
  { href: '/admin/upload',     label: 'Bulk Upload', icon: UploadCloud, desc: 'CSV / Excel import',         accent: '#7ab0c9' },
  { href: '/admin/categories', label: 'Categories',  icon: Layers,      desc: 'Categories & subcategories', accent: '#9ab87a' },
  { href: '/admin/orders',     label: 'Orders',      icon: ShoppingBag, desc: 'Customer orders',            accent: '#c97a7a' },
  { href: '/admin/contacts',   label: 'Contacts',    icon: Users,       desc: 'Manage customer contacts',   accent: '#7ac9a8' },
  { href: '/admin/blogs',      label: 'Blog',        icon: BookOpen,    desc: 'Create & manage blog posts', accent: '#a87ac9' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent, delay,
}: {
  label: string; value: number; sub?: string;
  icon: React.ElementType; accent: string; delay: number;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!value) return;
    let start = 0;
    const step = Math.ceil(value / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplayed(value); clearInterval(timer); }
      else setDisplayed(start);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div
      className="relative bg-white border border-[#ede9e1] rounded-2xl p-5 overflow-hidden group hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <Icon size={17} strokeWidth={1.7} style={{ color: accent }} />
        </div>
        {sub && (
          <span className="text-[0.65rem] font-semibold tracking-widest uppercase px-2 py-1 rounded-full" style={{ background: `${accent}12`, color: accent }}>
            {sub}
          </span>
        )}
      </div>
      <div className="font-['Cormorant_Garamond',serif] text-[2rem] font-medium text-[#1a1714] leading-none mb-1 tabular-nums">
        {displayed.toLocaleString()}
      </div>
      <div className="text-[0.72rem] text-[#a09a90] tracking-wide uppercase font-medium">{label}</div>
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 0%, ${accent}06 0%, transparent 70%)` }} />
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [stats, setStats]         = useState<Stats | null>(null);
  const [usersData, setUsersData] = useState<UsersData | null>(null);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);

  // Fetch stats — wait for auth to hydrate from localStorage
  useEffect(() => {
    if (authLoading || !token) return;
    setStatsLoading(true);
    authFetch('/api/admin/stats')
      .then(r => r.json())
      .then(j => setStats(j.data))
      .catch((e: unknown) => console.error('[stats]', e))
      .finally(() => setStatsLoading(false));
  }, [authLoading, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch users — wait for auth, re-run when page changes
  useEffect(() => {
    if (authLoading || !token) return;
    setUsersLoading(true);
    authFetch(`/api/admin/users?page=${page}&limit=8`)
      .then(r => r.json())
      .then(j => setUsersData(j.data))
      .catch((e: unknown) => console.error('[stats]', e))
      .finally(() => setUsersLoading(false));
  }, [authLoading, token, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = usersData?.users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPages = usersData ? Math.ceil(usersData.total / 8) : 1;

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[0.68rem] tracking-[0.22em] uppercase text-[#c9a84c] font-semibold mb-2">◆ Alpha Imports</p>
            <h1 className="font-['Cormorant_Garamond',serif] text-[2.6rem] font-medium text-[#1a1714] tracking-tight leading-none">
              Dashboard
            </h1>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[0.7rem] text-[#a09a90] tracking-wide">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-[0.65rem] text-[#c9a84c] tracking-widest uppercase mt-0.5 font-semibold">Admin Console</p>
          </div>
        </div>
        <div className="mt-5 h-px bg-gradient-to-r from-[#c9a84c]/30 via-[#ede9e1] to-transparent" />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Products"  value={stats?.products.total   ?? 0} sub={stats ? `+${stats.products.newThisMonth} this mo` : undefined} icon={Package} accent="#c9a84c" delay={0}   />
        <StatCard label="Active Listings" value={stats?.products.active  ?? 0} icon={Gem}    accent="#9ab87a" delay={60}  />
        <StatCard label="Total Users"     value={stats?.users.total      ?? 0} sub={stats?.users.growth !== undefined ? `${stats.users.growth > 0 ? '+' : ''}${stats.users.growth}% MoM` : undefined} icon={Users}  accent="#7ab0c9" delay={120} />
        <StatCard label="Categories"      value={stats?.categories.total ?? 0} icon={Layers} accent="#c97a7a" delay={180} />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6">

        {/* ── Left: Quick nav ── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-[0.65rem] tracking-[0.2em] uppercase text-[#a09a90] font-semibold mb-1">Quick Access</h2>

          {NAV_LINKS.map(({ href, label, icon: Icon, desc, accent }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 bg-white border border-[#ede9e1] rounded-xl px-4 py-3.5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                <Icon size={16} strokeWidth={1.6} style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[0.82rem] font-semibold text-[#1a1714]">{label}</div>
                <div className="text-[0.7rem] text-[#a09a90]">{desc}</div>
              </div>
              <ArrowRight size={14} strokeWidth={2} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" style={{ color: accent }} />
            </Link>
          ))}

          {/* New users callout */}
          {stats && (
            <div className="mt-1 bg-gradient-to-br from-[#c9a84c]/8 to-[#c9a84c]/4 border border-[#c9a84c]/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={13} strokeWidth={2} className="text-[#c9a84c]" />
                <span className="text-[0.65rem] tracking-widest uppercase text-[#c9a84c] font-semibold">This Month</span>
              </div>
              <div className="font-['Cormorant_Garamond',serif] text-[1.8rem] font-medium text-[#1a1714] leading-none">
                +{stats.users.newThisMonth}
              </div>
              <div className="text-[0.7rem] text-[#a09a90] mt-0.5">new users registered</div>
            </div>
          )}
        </div>

        {/* ── Right: User table ── */}
        <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden flex flex-col">

          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede9e1]">
            <div>
              <h2 className="text-[0.85rem] font-semibold text-[#1a1714]">User Registry</h2>
              <p className="text-[0.68rem] text-[#a09a90] mt-0.5">
                {usersData
                  ? `${usersData.total} total · ${usersData.adminCount} admin · ${usersData.userCount} customers`
                  : '—'}
              </p>
            </div>
            <div className="relative hidden sm:block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4bdb2]" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-[0.72rem] bg-[#faf9f7] border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all w-44 placeholder:text-[#c4bdb2]"
              />
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1.4fr_80px_90px] px-5 py-2.5 border-b border-[#ede9e1] bg-[#faf9f7]">
            {['Name', 'Email', 'Role', 'Joined'].map(h => (
              <span key={h} className="text-[0.6rem] tracking-[0.15em] uppercase text-[#b0a898] font-semibold">{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-auto">
            {usersLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_80px_90px] px-5 py-3.5 border-b border-[#f5f3ef] animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#ede9e1]" />
                    <div className="h-3 w-20 bg-[#ede9e1] rounded" />
                  </div>
                  <div className="h-3 w-32 bg-[#ede9e1] rounded self-center" />
                  <div className="h-5 w-12 bg-[#ede9e1] rounded-full self-center" />
                  <div className="h-3 w-16 bg-[#ede9e1] rounded self-center" />
                </div>
              ))
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={28} strokeWidth={1.2} className="text-[#d4cfc8] mb-3" />
                <p className="text-[0.78rem] text-[#b0a898]">No users found</p>
              </div>
            ) : (
              filteredUsers.map((user, i) => (
                <div
                  key={user._id}
                  className="grid grid-cols-[1fr_1.4fr_80px_90px] px-5 py-3.5 border-b border-[#f5f3ef] hover:bg-[#faf9f7] transition-colors duration-150"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Name + avatar */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold shrink-0"
                      style={{
                        background: user.role === 'admin' ? '#c9a84c20' : '#7ab0c920',
                        color:      user.role === 'admin' ? '#c9a84c'   : '#7ab0c9',
                        border: `1px solid ${user.role === 'admin' ? '#c9a84c30' : '#7ab0c930'}`,
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[0.78rem] font-medium text-[#1a1714] truncate">{user.name}</span>
                  </div>

                  {/* Email */}
                  <span className="text-[0.72rem] text-[#8a8278] truncate self-center pr-2">{user.email}</span>

                  {/* Role badge */}
                  <div className="self-center">
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold tracking-wide bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20">
                        <Crown size={9} strokeWidth={2} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold tracking-wide bg-[#7ab0c9]/10 text-[#7ab0c9] border border-[#7ab0c9]/20">
                        <Users size={9} strokeWidth={2} /> User
                      </span>
                    )}
                  </div>

                  {/* Joined */}
                  <span className="text-[0.68rem] text-[#a09a90] self-center" title={formatDate(user.createdAt)}>
                    {timeAgo(user.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {!usersLoading && usersData && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#ede9e1] bg-[#faf9f7]">
              <span className="text-[0.68rem] text-[#a09a90]">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 rounded-lg border border-[#ede9e1] flex items-center justify-center hover:border-[#c9a84c]/40 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={13} strokeWidth={2} className="text-[#6b6560]" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = page <= 3 ? i + 1
                    : page >= totalPages - 2 ? totalPages - 4 + i
                    : page - 2 + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-7 h-7 rounded-lg text-[0.7rem] font-semibold transition-all"
                      style={p === page
                        ? { background: '#c9a84c', color: '#fff', border: '1px solid #c9a84c' }
                        : { background: 'transparent', color: '#6b6560', border: '1px solid #ede9e1' }}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded-lg border border-[#ede9e1] flex items-center justify-center hover:border-[#c9a84c]/40 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={13} strokeWidth={2} className="text-[#6b6560]" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}