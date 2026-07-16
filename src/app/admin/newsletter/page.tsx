'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Users, Send, Plus, Trash2, Edit2, Eye, Download,
  Search, ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  X, Image as ImageIcon, AlertCircle, BarChart2, Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-[#ede9e1] rounded-xl bg-white min-h-[280px] flex items-center justify-center">
      <Loader2 size={20} className="text-[#c9a84c] animate-spin" />
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalSubscribers: number;
  activeSubscribers: number;
  totalCampaigns: number;
  lastSentCampaign: { title: string; sentAt: string } | null;
}

interface Subscriber {
  _id: string;
  email: string;
  status: 'active' | 'unsubscribed';
  subscribedAt: string;
}

interface Campaign {
  _id: string;
  title: string;
  subject: string;
  message: string;
  image: string;
  status: 'draft' | 'sending' | 'sent';
  sentAt?: string;
  totalRecipients: number;
  createdAt: string;
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

// ─── Campaign Form ────────────────────────────────────────────────────────────

interface CampaignFormData {
  title: string;
  subject: string;
  message: string;
  image: string;
}

function CampaignForm({
  initial,
  onSave,
  onCancel,
  authFetch,
}: {
  initial?: Partial<CampaignFormData>;
  onSave: (data: CampaignFormData) => Promise<void>;
  onCancel: () => void;
  authFetch: ReturnType<typeof useAuthFetch>;
}) {
  const [form, setForm] = useState<CampaignFormData>({
    title:   initial?.title   ?? '',
    subject: initial?.subject ?? '',
    message: initial?.message ?? '',
    image:   initial?.image   ?? '',
  });
  const [errors, setErrors] = useState<Partial<CampaignFormData>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof CampaignFormData, val: string) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: undefined }));
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('files', file);
    const res = await authFetch('/api/admin/upload', { method: 'POST', headers: {}, body: fd });
    const d = await res.json();
    if (d.success) update('image', d.urls[0]);
    setUploading(false);
  };

  const validate = () => {
    const e: Partial<CampaignFormData> = {};
    if (!form.title.trim())   e.title   = 'Title is required';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.message.trim() || form.message === '<p></p>') e.message = 'Message is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-[0.72rem] font-semibold text-[#a09a90] uppercase tracking-widest mb-1.5">Campaign Title</label>
        <input
          value={form.title}
          onChange={e => update('title', e.target.value)}
          placeholder="Q3 Gemstone Launch"
          className="w-full px-3.5 py-2.5 text-[0.83rem] rounded-lg border outline-none transition-colors"
          style={{ border: errors.title ? '1.5px solid #ef4444' : '1.5px solid #e4e4e7', background: '#fafaf9' }}
        />
        {errors.title && <p className="mt-1 text-[0.67rem] text-red-500">{errors.title}</p>}
      </div>

      {/* Subject */}
      <div>
        <label className="block text-[0.72rem] font-semibold text-[#a09a90] uppercase tracking-widest mb-1.5">Email Subject</label>
        <input
          value={form.subject}
          onChange={e => update('subject', e.target.value)}
          placeholder="Discover our latest gemstone arrivals"
          className="w-full px-3.5 py-2.5 text-[0.83rem] rounded-lg border outline-none transition-colors"
          style={{ border: errors.subject ? '1.5px solid #ef4444' : '1.5px solid #e4e4e7', background: '#fafaf9' }}
        />
        {errors.subject && <p className="mt-1 text-[0.67rem] text-red-500">{errors.subject}</p>}
      </div>

      {/* Banner Image */}
      <div>
        <label className="block text-[0.72rem] font-semibold text-[#a09a90] uppercase tracking-widest mb-1.5">Banner Image (optional)</label>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        {form.image ? (
          <div className="relative rounded-xl overflow-hidden border border-[#ede9e1] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.image} alt="banner" className="w-full max-h-48 object-cover" />
            <button
              onClick={() => update('image', '')}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-8 rounded-xl border-2 border-dashed border-[#e4e4e7] flex flex-col items-center gap-2 text-[#a09a90] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
          >
            {uploading ? <Loader2 size={22} className="animate-spin" /> : <ImageIcon size={22} strokeWidth={1.5} />}
            <span className="text-[0.72rem] font-medium">{uploading ? 'Uploading…' : 'Click to upload banner image'}</span>
          </button>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="block text-[0.72rem] font-semibold text-[#a09a90] uppercase tracking-widest mb-1.5">Message Content</label>
        <RichTextEditor
          value={form.message}
          onChange={val => update('message', val)}
        />
        {errors.message && <p className="mt-1 text-[0.67rem] text-red-500">{errors.message}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#ede9e1]">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.78rem] font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#0f172a' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save as Draft
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [subLoading, setSubLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
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
  }, [user, authFetch, subPage, subSearch, subStatus]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  // ── Campaign Actions ─────────────────────────────────────────────────────

  const handleCreateCampaign = async (data: { title: string; subject: string; message: string; image: string }) => {
    const res = await authFetch('/api/admin/newsletter/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (d.success) {
      setShowForm(false);
      fetchCampaigns();
      fetchStats();
    } else {
      alert(d.message ?? 'Failed to create campaign');
    }
  };

  const handleUpdateCampaign = async (data: { title: string; subject: string; message: string; image: string }) => {
    if (!editingCampaign) return;
    const res = await authFetch(`/api/admin/newsletter/campaigns/${editingCampaign._id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (d.success) {
      setEditingCampaign(null);
      fetchCampaigns();
    } else {
      alert(d.message ?? 'Failed to update campaign');
    }
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

  const handleSendCampaign = async (id: string) => {
    const campaign = campaigns.find(c => c._id === id);
    const activeSubs = stats?.activeSubscribers ?? 0;
    if (!confirm(`Send "${campaign?.title}" to ${activeSubs} active subscribers? This cannot be undone.`)) return;
    setSendingId(id);
    try {
      const res = await authFetch(`/api/admin/newsletter/campaigns/${id}/send`, { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        fetchCampaigns();
        fetchStats();
      } else {
        alert(d.message ?? 'Failed to send');
      }
    } finally {
      setSendingId(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await authFetch('/api/admin/newsletter/subscribers?export=csv');
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-[#c9a84c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-['Cormorant_Garamond',serif] text-[2rem] font-semibold text-[#1a1714] leading-none mb-1">
            Newsletter
          </h1>
          <p className="text-[0.75rem] text-[#a09a90] tracking-widest uppercase">Campaigns &amp; Subscribers</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingCampaign(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[0.78rem] font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: '#0f172a' }}
        >
          <Plus size={15} strokeWidth={2} />
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Subscribers" value={loadingStats ? '—' : stats?.totalSubscribers ?? 0} icon={Users} accent="#c9a84c" />
        <StatCard label="Active Subscribers" value={loadingStats ? '—' : stats?.activeSubscribers ?? 0} icon={CheckCircle2} accent="#16a34a" />
        <StatCard label="Total Campaigns" value={loadingStats ? '—' : stats?.totalCampaigns ?? 0} icon={Mail} accent="#6366f1" />
        <StatCard
          label="Last Sent"
          value={loadingStats || !stats?.lastSentCampaign ? '—' : timeAgo(stats.lastSentCampaign.sentAt)}
          sub={stats?.lastSentCampaign?.title}
          icon={Clock}
          accent="#0ea5e9"
        />
      </div>

      {/* Create / Edit Form Modal */}
      {(showForm || editingCampaign) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditingCampaign(null); } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ede9e1]">
              <h2 className="font-['Cormorant_Garamond',serif] text-[1.3rem] font-semibold text-[#1a1714]">
                {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingCampaign(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <CampaignForm
                initial={editingCampaign ? {
                  title: editingCampaign.title,
                  subject: editingCampaign.subject,
                  message: editingCampaign.message,
                  image: editingCampaign.image,
                } : undefined}
                onSave={editingCampaign ? handleUpdateCampaign : handleCreateCampaign}
                onCancel={() => { setShowForm(false); setEditingCampaign(null); }}
                authFetch={authFetch}
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewCampaign && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setPreviewCampaign(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ede9e1]">
              <h2 className="font-['Cormorant_Garamond',serif] text-[1.3rem] font-semibold text-[#1a1714]">Campaign Preview</h2>
              <button onClick={() => setPreviewCampaign(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[0.67rem] text-[#a09a90] uppercase tracking-widest mb-0.5">Subject</p>
                <p className="text-[0.88rem] font-semibold text-[#1a1714]">{previewCampaign.subject}</p>
              </div>
              {previewCampaign.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewCampaign.image} alt="banner" className="w-full rounded-xl object-cover max-h-56" />
              )}
              <div>
                <p className="text-[0.67rem] text-[#a09a90] uppercase tracking-widest mb-2">Message</p>
                <div
                  className="prose prose-sm max-w-none text-[#374151] text-[0.85rem]"
                  dangerouslySetInnerHTML={{ __html: previewCampaign.message }}
                />
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#ede9e1]">
                {previewCampaign.status === 'draft' && (
                  <button
                    onClick={() => { setPreviewCampaign(null); handleSendCampaign(previewCampaign._id); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[0.78rem] font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: '#0f172a' }}
                  >
                    <Send size={14} />
                    Send Now
                  </button>
                )}
                <button onClick={() => setPreviewCampaign(null)} className="px-4 py-2.5 rounded-xl text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7] transition-colors">
                  Close
                </button>
              </div>
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
              <p className="text-[0.8rem]">No campaigns yet. Create your first one.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f4f1ec]">
              {campaigns.map(camp => (
                <div key={camp._id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#faf8f4] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-[0.85rem] text-[#1a1714] truncate">{camp.title}</span>
                      <StatusBadge status={camp.status} />
                    </div>
                    <p className="text-[0.72rem] text-[#a09a90] truncate">{camp.subject}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[0.67rem] text-[#c9c4bb]">{formatDate(camp.createdAt)}</span>
                      {camp.status === 'sent' && (
                        <span className="text-[0.67rem] text-[#c9c4bb]">{camp.totalRecipients.toLocaleString()} recipients</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setPreviewCampaign(camp)}
                      title="Preview"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors"
                    >
                      <Eye size={15} />
                    </button>

                    {camp.status === 'draft' && (
                      <>
                        <button
                          onClick={() => { setEditingCampaign(camp); setShowForm(false); }}
                          title="Edit"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleSendCampaign(camp._id)}
                          disabled={sendingId === camp._id}
                          title="Send"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6366f1] hover:bg-[#eef2ff] transition-colors"
                        >
                          {sendingId === camp._id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(camp._id)}
                          disabled={deletingId === camp._id}
                          title="Delete"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                        >
                          {deletingId === camp._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </>
                    )}

                    {camp.status === 'sending' && (
                      <div className="flex items-center gap-1.5 text-[0.7rem] text-[#92400e]">
                        <Loader2 size={14} className="animate-spin" />
                        Sending…
                      </div>
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
          <div className="px-6 py-4 border-b border-[#ede9e1] flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="font-semibold text-[0.88rem] text-[#1a1714] shrink-0">Subscribers</h2>

            <div className="flex-1 flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 max-w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09a90]" />
                <input
                  type="text"
                  placeholder="Search email…"
                  value={subSearch}
                  onChange={e => { setSubSearch(e.target.value); setSubPage(1); }}
                  className="w-full pl-8 pr-3 py-2 text-[0.78rem] rounded-lg border border-[#e4e4e7] bg-[#fafaf9] outline-none focus:border-[#c9a84c] transition-colors"
                />
              </div>

              {/* Status filter */}
              <select
                value={subStatus}
                onChange={e => { setSubStatus(e.target.value as typeof subStatus); setSubPage(1); }}
                className="px-3 py-2 text-[0.78rem] rounded-lg border border-[#e4e4e7] bg-[#fafaf9] text-[#374151] outline-none cursor-pointer"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>

            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.75rem] font-semibold text-[#374151] border border-[#e4e4e7] hover:bg-[#f4f1ec] transition-colors shrink-0"
            >
              {exportingCsv ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export CSV
            </button>
          </div>

          {subLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="text-[#c9a84c] animate-spin" /></div>
          ) : subscribers.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-[#a09a90]">
              <Users size={32} strokeWidth={1.2} />
              <p className="text-[0.8rem]">No subscribers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f4f1ec]">
                    <th className="px-6 py-3 text-left text-[0.67rem] font-bold text-[#a09a90] uppercase tracking-widest">Email</th>
                    <th className="px-6 py-3 text-left text-[0.67rem] font-bold text-[#a09a90] uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-left text-[0.67rem] font-bold text-[#a09a90] uppercase tracking-widest">Subscribed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1ec]">
                  {subscribers.map(sub => (
                    <tr key={sub._id} className="hover:bg-[#faf8f4] transition-colors">
                      <td className="px-6 py-3.5 text-[0.82rem] text-[#1a1714] font-medium">{sub.email}</td>
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
              <span className="text-[0.72rem] text-[#a09a90]">Page {subPage} of {subPagination.totalPages}</span>
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
          Campaigns are sent in batches of 50 to respect Resend rate limits. Large lists may take a few minutes. The page will reflect the final status once sending completes.
        </p>
      </div>

    </div>
  );
}
