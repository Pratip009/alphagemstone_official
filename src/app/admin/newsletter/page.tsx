'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Users, Send, Plus, Trash2, Edit2, Eye, Download, Copy,
  Search, ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  X, AlertCircle, Clock, UserRound, History, Upload, RotateCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import dynamic from 'next/dynamic';
import { Campaign, CampaignFormData, EMPTY_FORM, formFromCampaign } from '@/components/admin/newsletter/types';
import SendCampaignModal from '@/components/admin/newsletter/SendCampaignModal';
import ImportContactsModal from '@/components/admin/newsletter/ImportContactsModal';

const CampaignEditor = dynamic(() => import('@/components/admin/newsletter/CampaignEditor'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalSubscribers: number;
  activeSubscribers: number;
  legacyContacts: number;
  registeredUsers: number;
  totalCampaigns: number;
  lastSentCampaign: { title: string; sentAt: string } | null;
}

interface Subscriber {
  _id: string;
  email: string;
  name?: string;
  source?: 'website' | 'legacy' | 'account';
  status: 'active' | 'unsubscribed';
  subscribedAt: string;
}

interface Pagination {
  total: number;
  totalPages: number;
}

type Tab = 'campaigns' | 'subscribers';

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
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-white border border-[#ede9e1] rounded-2xl p-5 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="absolute top-0 left-6 right-6 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent}40,transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          <Icon size={15} strokeWidth={1.7} style={{ color: accent }} />
        </div>
      </div>
      <div className="font-['Cormorant_Garamond',serif] text-[2rem] font-medium text-[#1a1714] leading-none mb-1 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[0.7rem] text-[#a09a90] tracking-wide uppercase font-medium">{label}</div>
      {sub && <div className="mt-1 text-[0.65rem] text-[#c9a84c] font-medium truncate">{sub}</div>}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Campaign['status'] | Subscriber['status'] }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft:         { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
    sending:       { bg: '#fef3c7', color: '#92400e', label: 'Sending' },
    sent:          { bg: '#dcfce7', color: '#15803d', label: 'Sent' },
    active:        { bg: '#dcfce7', color: '#15803d', label: 'Active' },
    unsubscribed:  { bg: '#fee2e2', color: '#991b1b', label: 'Unsubscribed' },
  };
  const s = map[status] ?? map.draft;
  return (
    <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: Subscriber['source'] }) {
  const map = {
    website: { label: 'Website', color: '#475569', bg: '#f1f5f9' },
    legacy:  { label: 'Old website', color: '#8a6e2a', bg: '#fbf6e8' },
    account: { label: 'Customer', color: '#3730a3', bg: '#eef2ff' },
  } as const;
  const s = map[source ?? 'website'] ?? map.website;
  return <span className="text-[0.68rem] font-medium px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// `session` keeps the editor mounted across saves (a new draft becoming an
// edit after its first save must not reset the form or scroll position).
type EditorState = { mode: 'create' | 'edit'; id?: string; initial: CampaignFormData; session: number } | null;

export default function AdminNewsletterPage() {
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campPagination, setCampPagination] = useState<Pagination | null>(null);
  const [campPage, setCampPage] = useState(1);
  const [campLoading, setCampLoading] = useState(true);

  // Subscribers state
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subPagination, setSubPagination] = useState<Pagination | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [subSource, setSubSource] = useState<'all' | 'website' | 'legacy' | 'account'>('all');
  const [subLoading, setSubLoading] = useState(true);

  // Dialogs
  const [editor, setEditor] = useState<EditorState>(null);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sendTarget, setSendTarget] = useState<Campaign | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoadingStats(true);
    try {
      const res = await authFetch('/api/admin/newsletter/stats');
      const d = await res.json();
      if (d.success) setStats(d.data);
    } finally {
      setLoadingStats(false);
    }
  }, [user, authFetch]);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    setCampLoading(true);
    try {
      const res = await authFetch(`/api/admin/newsletter/campaigns?page=${campPage}&limit=10`);
      const d = await res.json();
      if (d.success) {
        setCampaigns(d.data);
        setCampPagination(d.pagination);
      }
    } finally {
      setCampLoading(false);
    }
  }, [user, authFetch, campPage]);

  const fetchSubscribers = useCallback(async () => {
    if (!user) return;
    setSubLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(subPage),
        limit: '20',
        status: subStatus,
        source: subSource,
        ...(subSearch ? { search: subSearch } : {}),
      });
      const res = await authFetch(`/api/admin/newsletter/subscribers?${params}`);
      const d = await res.json();
      if (d.success) {
        setSubscribers(d.data);
        setSubPagination(d.pagination);
      }
    } finally {
      setSubLoading(false);
    }
  }, [user, authFetch, subPage, subSearch, subStatus, subSource]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => {
    const t = setTimeout(fetchSubscribers, subSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchSubscribers, subSearch]);

  // Rendered preview for the list's eye button (same HTML recipients get)
  useEffect(() => {
    if (!previewCampaign) { setPreviewHtml(''); return; }
    (async () => {
      const res = await authFetch('/api/admin/newsletter/preview', {
        method: 'POST',
        body: JSON.stringify({ campaign: formFromCampaign(previewCampaign), recipient: { name: user?.name } }),
      });
      const d = await res.json();
      if (d.success) setPreviewHtml(d.data.html);
    })();
  }, [previewCampaign, authFetch, user?.name]);

  // ── Campaign Actions ─────────────────────────────────────────────────────

  const saveCampaign = async (data: CampaignFormData): Promise<boolean> => {
    if (!editor) return false;
    const isEdit = editor.mode === 'edit' && editor.id;
    const res = await authFetch(
      isEdit ? `/api/admin/newsletter/campaigns/${editor.id}` : '/api/admin/newsletter/campaigns',
      { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(data) }
    );
    const d = await res.json();
    if (!d.success) {
      alert(d.message ?? 'Failed to save campaign');
      return false;
    }
    // A brand-new campaign becomes an edit of itself, so further saves update it.
    setEditor(prev => prev && { ...prev, mode: 'edit', id: d.data._id, initial: data });
    fetchCampaigns();
    fetchStats();
    return true;
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Delete this draft campaign? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await authFetch(`/api/admin/newsletter/campaigns/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) { fetchCampaigns(); fetchStats(); }
      else alert(d.message ?? 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const duplicate = (c: Campaign) => {
    const data = formFromCampaign(c);
    setEditor({ mode: 'create', initial: { ...data, title: `${data.title} (copy)` }, session: Date.now() });
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await authFetch(`/api/admin/newsletter/subscribers?export=csv&source=${subSource}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscribers-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  const audienceText = (c: Campaign) => {
    const a = c.audience ?? { subscribers: true, users: false, legacy: false };
    return [a.subscribers && 'Subscribers', a.users && 'Customers', a.legacy && 'Old website'].filter(Boolean).join(', ') || 'No audience';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-[#c9a84c] animate-spin" />
      </div>
    );
  }

  const reach = stats ? stats.activeSubscribers + stats.legacyContacts + stats.registeredUsers : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond',serif] text-[2rem] font-semibold text-[#1a1714] leading-none mb-1">
            Newsletter
          </h1>
          <p className="text-[0.75rem] text-[#a09a90]">Design campaigns and send them to subscribers, customers and old-site contacts.</p>
        </div>
        <button
          onClick={() => setEditor({ mode: 'create', initial: EMPTY_FORM, session: Date.now() })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[0.78rem] font-semibold text-white transition-all hover:opacity-90 active:scale-95 shrink-0"
          style={{ background: '#0f172a' }}
        >
          <Plus size={15} strokeWidth={2} />
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Newsletter subscribers"
          value={loadingStats ? '—' : stats?.activeSubscribers ?? 0}
          sub={stats && stats.totalSubscribers > stats.activeSubscribers ? `${(stats.totalSubscribers - stats.activeSubscribers).toLocaleString()} unsubscribed` : undefined}
          icon={Mail} accent="#c9a84c"
        />
        <StatCard label="Registered customers" value={loadingStats ? '—' : stats?.registeredUsers ?? 0} icon={UserRound} accent="#6366f1" />
        <StatCard label="Old website contacts" value={loadingStats ? '—' : stats?.legacyContacts ?? 0} icon={History} accent="#16a34a"
          sub={stats && stats.legacyContacts === 0 ? 'Import them from the Subscribers tab' : undefined} />
        <StatCard
          label="Last sent"
          value={loadingStats || !stats?.lastSentCampaign ? '—' : timeAgo(stats.lastSentCampaign.sentAt)}
          sub={stats?.lastSentCampaign?.title}
          icon={Clock}
          accent="#0ea5e9"
        />
      </div>
      {!loadingStats && stats && (
        <p className="-mt-5 text-[0.7rem] text-[#a09a90]">
          Up to {reach.toLocaleString()} addresses across all three lists — fewer once people on more than one list are counted once.
        </p>
      )}

      {/* Editor */}
      {editor && (
        <CampaignEditor
          key={editor.session}
          mode={editor.mode}
          initial={editor.initial}
          adminEmail={user?.email}
          adminName={user?.name}
          authFetch={authFetch}
          onSave={saveCampaign}
          onClose={() => setEditor(null)}
        />
      )}

      {/* Send / resume */}
      {sendTarget && (
        <SendCampaignModal
          campaign={sendTarget}
          authFetch={authFetch}
          onClose={() => { setSendTarget(null); fetchCampaigns(); fetchStats(); }}
          onFinished={() => { fetchCampaigns(); }}
        />
      )}

      {/* Import */}
      {showImport && (
        <ImportContactsModal
          authFetch={authFetch}
          onClose={() => setShowImport(false)}
          onImported={() => { fetchSubscribers(); fetchStats(); }}
        />
      )}

      {/* Preview Modal */}
      {previewCampaign && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setPreviewCampaign(null); }}>
          <div className="bg-[#f6f4f0] rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-[#ede9e1] bg-white">
              <div className="min-w-0 flex-1">
                <h2 className="font-['Cormorant_Garamond',serif] text-[1.3rem] font-semibold text-[#1a1714] truncate">{previewCampaign.subject}</h2>
                <p className="text-[0.7rem] text-[#a09a90] truncate">To: {audienceText(previewCampaign)}</p>
              </div>
              {previewCampaign.status === 'draft' && (
                <button
                  onClick={() => { const c = previewCampaign; setPreviewCampaign(null); setSendTarget(c); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[0.78rem] font-semibold text-white transition-all hover:opacity-90 shrink-0"
                  style={{ background: '#0f172a' }}
                >
                  <Send size={14} />
                  Send
                </button>
              )}
              <button onClick={() => setPreviewCampaign(null)} aria-label="Close preview" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previewHtml ? (
                <iframe title="Campaign preview" srcDoc={previewHtml} sandbox="allow-same-origin" className="w-full h-[75vh] border-0 rounded-xl bg-white" />
              ) : (
                <div className="flex justify-center py-24"><Loader2 size={22} className="text-[#c9a84c] animate-spin" /></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f4f1ec] p-1 rounded-xl w-fit">
        {(['campaigns', 'subscribers'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-[0.75rem] font-semibold capitalize tracking-wide transition-all ${activeTab === tab ? 'bg-white text-[#1a1714] shadow-sm' : 'text-[#a09a90] hover:text-[#1a1714]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Campaigns Tab ── */}
      {activeTab === 'campaigns' && (
        <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ede9e1] flex items-center justify-between">
            <h2 className="font-semibold text-[0.88rem] text-[#1a1714]">Campaign History</h2>
            <span className="text-[0.72rem] text-[#a09a90]">{campPagination?.total ?? 0} campaigns</span>
          </div>

          {campLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="text-[#c9a84c] animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-[#a09a90]">
              <Mail size={32} strokeWidth={1.2} />
              <p className="text-[0.8rem]">No campaigns yet.</p>
              <button onClick={() => setEditor({ mode: 'create', initial: EMPTY_FORM, session: Date.now() })}
                className="text-[0.78rem] font-semibold text-[#8a6e2a] underline">Create your first campaign</button>
            </div>
          ) : (
            <div className="divide-y divide-[#f4f1ec]">
              {campaigns.map(camp => (
                <div key={camp._id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#faf8f4] transition-colors">
                  {camp.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={camp.image} alt="" className="hidden sm:block w-14 h-14 rounded-lg object-cover border border-[#ede9e1] shrink-0" />
                  ) : (
                    <div className="hidden sm:flex w-14 h-14 rounded-lg items-center justify-center shrink-0 border border-[#ede9e1]"
                      style={{ background: camp.headerStyle === 'ivory' ? '#F0EADF' : '#0E0D0B' }}>
                      <Mail size={16} style={{ color: { gold: '#C9A84C', sapphire: '#9DB8E3', emerald: '#8CCBB0', ruby: '#E59AA4' }[camp.accent ?? 'gold'] }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-[0.85rem] text-[#1a1714] truncate">{camp.title}</span>
                      <StatusBadge status={camp.status} />
                    </div>
                    <p className="text-[0.72rem] text-[#a09a90] truncate">{camp.subject}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-[0.67rem] text-[#b5afa5]">{formatDate(camp.sentAt ?? camp.createdAt)}</span>
                      <span className="text-[0.67rem] text-[#b5afa5]">{audienceText(camp)}</span>
                      {camp.status === 'sent' && (
                        <span className="text-[0.67rem] text-[#b5afa5]">{camp.totalRecipients.toLocaleString()} delivered</span>
                      )}
                      {(camp.failedCount ?? 0) > 0 && (
                        <span className="text-[0.67rem] text-red-500">{camp.failedCount!.toLocaleString()} failed</span>
                      )}
                      {camp.status === 'sending' && (
                        <span className="text-[0.67rem] text-[#92400e]">{(camp.sentCount ?? 0).toLocaleString()} sent so far</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setPreviewCampaign(camp)} title="Preview" aria-label="Preview"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => duplicate(camp)} title="Duplicate as new draft" aria-label="Duplicate"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors">
                      <Copy size={15} />
                    </button>

                    {camp.status === 'draft' && (
                      <>
                        <button onClick={() => setEditor({ mode: 'edit', id: camp._id, initial: formFromCampaign(camp), session: Date.now() })} title="Edit" aria-label="Edit"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setSendTarget(camp)} title="Send" aria-label="Send"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6366f1] hover:bg-[#eef2ff] transition-colors">
                          <Send size={15} />
                        </button>
                        <button onClick={() => handleDeleteCampaign(camp._id)} disabled={deletingId === camp._id} title="Delete" aria-label="Delete"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#ef4444] hover:bg-[#fef2f2] transition-colors">
                          {deletingId === camp._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </>
                    )}

                    {camp.status === 'sending' && (
                      <button onClick={() => setSendTarget(camp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.72rem] font-semibold text-[#92400e] bg-[#fef3c7] hover:bg-[#fde68a] transition-colors">
                        <RotateCw size={13} />
                        Resume
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {campPagination && campPagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#ede9e1] flex items-center justify-between">
              <span className="text-[0.72rem] text-[#a09a90]">Page {campPage} of {campPagination.totalPages}</span>
              <div className="flex gap-1.5">
                <button disabled={campPage <= 1} onClick={() => setCampPage(p => p - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#e4e4e7] text-[#64748b] disabled:opacity-40 hover:bg-[#f4f1ec] transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <button disabled={campPage >= campPagination.totalPages} onClick={() => setCampPage(p => p + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#e4e4e7] text-[#64748b] disabled:opacity-40 hover:bg-[#f4f1ec] transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Subscribers Tab ── */}
      {activeTab === 'subscribers' && (
        <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ede9e1] flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="shrink-0">
              <h2 className="font-semibold text-[0.88rem] text-[#1a1714]">Mailing list</h2>
              <p className="text-[0.68rem] text-[#a09a90]">Registered customers are reached automatically and aren’t listed here unless they unsubscribed.</p>
            </div>

            <div className="flex-1 flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="relative flex-1 min-w-[160px] max-w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09a90]" />
                <input
                  type="text"
                  placeholder="Search email or name…"
                  value={subSearch}
                  onChange={e => { setSubSearch(e.target.value); setSubPage(1); }}
                  className="w-full pl-8 pr-3 py-2 text-[0.78rem] rounded-lg border border-[#e4e4e7] bg-[#fafaf9] outline-none focus:border-[#c9a84c] transition-colors"
                />
              </div>

              <select
                value={subSource}
                onChange={e => { setSubSource(e.target.value as typeof subSource); setSubPage(1); }}
                aria-label="Filter by source"
                className="px-3 py-2 text-[0.78rem] rounded-lg border border-[#e4e4e7] bg-[#fafaf9] text-[#374151] outline-none cursor-pointer"
              >
                <option value="all">All sources</option>
                <option value="website">Website signups</option>
                <option value="legacy">Old website</option>
                <option value="account">Customers (opted out)</option>
              </select>

              <select
                value={subStatus}
                onChange={e => { setSubStatus(e.target.value as typeof subStatus); setSubPage(1); }}
                aria-label="Filter by status"
                className="px-3 py-2 text-[0.78rem] rounded-lg border border-[#e4e4e7] bg-[#fafaf9] text-[#374151] outline-none cursor-pointer"
              >
                <option value="all">Any status</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>

              <button
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.75rem] font-semibold text-[#374151] border border-[#e4e4e7] hover:bg-[#f4f1ec] transition-colors shrink-0"
              >
                {exportingCsv ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Export CSV
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.75rem] font-semibold text-white bg-[#0f172a] hover:opacity-90 transition-opacity shrink-0"
              >
                <Upload size={13} />
                Import old contacts
              </button>
            </div>
          </div>

          {subLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="text-[#c9a84c] animate-spin" /></div>
          ) : subscribers.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-[#a09a90]">
              <Users size={32} strokeWidth={1.2} />
              <p className="text-[0.8rem]">{subSearch || subStatus !== 'all' || subSource !== 'all' ? 'No one matches these filters.' : 'No one on the list yet.'}</p>
              {subSource === 'legacy' && (
                <button onClick={() => setShowImport(true)} className="text-[0.78rem] font-semibold text-[#8a6e2a] underline">Import your old website contacts</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f4f1ec]">
                    <th className="px-6 py-3 text-left text-[0.7rem] font-semibold text-[#a09a90]">Email</th>
                    <th className="px-6 py-3 text-left text-[0.7rem] font-semibold text-[#a09a90]">Name</th>
                    <th className="px-6 py-3 text-left text-[0.7rem] font-semibold text-[#a09a90]">Source</th>
                    <th className="px-6 py-3 text-left text-[0.7rem] font-semibold text-[#a09a90]">Status</th>
                    <th className="px-6 py-3 text-left text-[0.7rem] font-semibold text-[#a09a90]">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1ec]">
                  {subscribers.map(sub => (
                    <tr key={sub._id} className="hover:bg-[#faf8f4] transition-colors">
                      <td className="px-6 py-3.5 text-[0.82rem] text-[#1a1714] font-medium">{sub.email}</td>
                      <td className="px-6 py-3.5 text-[0.78rem] text-[#6b6560]">{sub.name || '—'}</td>
                      <td className="px-6 py-3.5"><SourceBadge source={sub.source} /></td>
                      <td className="px-6 py-3.5"><StatusBadge status={sub.status} /></td>
                      <td className="px-6 py-3.5 text-[0.78rem] text-[#a09a90]">{formatDate(sub.subscribedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subPagination && subPagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#ede9e1] flex items-center justify-between">
              <span className="text-[0.72rem] text-[#a09a90]">Page {subPage} of {subPagination.totalPages} · {subPagination.total.toLocaleString()} people</span>
              <div className="flex gap-1.5">
                <button disabled={subPage <= 1} onClick={() => setSubPage(p => p - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#e4e4e7] text-[#64748b] disabled:opacity-40 hover:bg-[#f4f1ec] transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <button disabled={subPage >= subPagination.totalPages} onClick={() => setSubPage(p => p + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#e4e4e7] text-[#64748b] disabled:opacity-40 hover:bg-[#f4f1ec] transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#fef9ec] border border-[#fde68a]">
        <AlertCircle size={15} strokeWidth={1.8} className="text-[#92400e] mt-0.5 shrink-0" />
        <p className="text-[0.72rem] text-[#78350f] leading-relaxed">
          Each address gets a campaign once, even if it’s on several lists. Anyone who unsubscribes — from any list — is skipped on every future send. Sending pauses if you close the window; use Resume to finish it.
        </p>
      </div>

    </div>
  );
}
