// src/app/admin/contacts/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

type Status = "unread" | "read" | "replied";

interface ContactMsg {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: Status;
  createdAt: string;
}

const STATUS_META: Record<Status, { color: string; dot: string; label: string }> = {
  unread:  { color: "bg-rose-50 text-rose-600 border-rose-200",       dot: "bg-rose-500",    label: "Unread"  },
  read:    { color: "bg-slate-100 text-slate-500 border-slate-200",   dot: "bg-slate-400",   label: "Read"    },
  replied: { color: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500", label: "Replied" },
};

const FILTERS = [
  { label: "All Messages", value: "", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { label: "Unread",       value: "unread",  icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { label: "Read",         value: "read",    icon: "M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" },
  { label: "Replied",      value: "replied", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
];

export default function AdminContactsPage() {
  const { token } = useAuth();

  const [messages, setMessages]         = useState<ContactMsg[]>([]);
  const [total, setTotal]               = useState(0);
  const [unreadCount, setUnreadCount]   = useState(0);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<ContactMsg | null>(null);
  const [updating, setUpdating]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchMessages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      const res  = await fetch(`/api/admin/contacts?${params.toString()}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        setTotal(data.total);
        setPages(data.pages);
        setUnreadCount(data.unreadCount);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, token]);

  useEffect(() => { if (token) fetchMessages(); }, [fetchMessages, token]);

  const openMessage = async (msg: ContactMsg) => {
    setSelected(msg);
    if (msg.status === "unread") await updateStatus(msg._id, "read");
  };

  const updateStatus = async (id: string, status: Status) => {
    setUpdating(id);
    try {
      const res  = await fetch(`/api/admin/contacts/${id}`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, status } : m)));
        if (selected?._id === id) setSelected((s) => (s ? { ...s, status } : s));
        fetchMessages();
      }
    } finally { setUpdating(null); }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Permanently delete this message?")) return;
    setDeleting(id);
    try {
      const res  = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE", headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== id));
        if (selected?._id === id) setSelected(null);
        setTotal((t) => t - 1);
      }
    } finally { setDeleting(null); }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const countByStatus = (s: string) => s ? messages.filter(m => m.status === s).length : messages.length;

  return (
    <div className="min-h-screen bg-[#f0f4f9]" style={{ fontFamily: '"Google Sans Flex", sans-serif' }}>

      {/* ── Top Bar ── */}
      <div className="bg-[#0d2240] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Gem icon */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Contact Inbox</h1>
              <p className="text-white/40 text-xs">GemStone Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-400/30 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-rose-300 text-xs font-semibold">{unreadCount} new</span>
              </div>
            )}
            <div className="bg-white/10 border border-white/10 rounded-full px-3 py-1.5">
              <span className="text-white/60 text-xs font-medium">{total} total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total",   value: total,        color: "from-[#112c52] to-[#1a4070]", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
            { label: "Unread",  value: unreadCount,  color: "from-rose-500 to-rose-600",   icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
            { label: "Read",    value: messages.filter(m => m.status === "read").length,    color: "from-slate-500 to-slate-600",   icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
            { label: "Replied", value: messages.filter(m => m.status === "replied").length, color: "from-emerald-500 to-emerald-600", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
          ].map((card) => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">{card.label}</span>
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left: Message List ── */}
          <div className="flex-1 min-w-0">

            {/* Filter pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                    statusFilter === f.value
                      ? "bg-[#112c52] text-white border-[#112c52] shadow-md shadow-[#112c52]/20"
                      : "bg-white text-slate-500 border-slate-200 hover:border-[#112c52]/30 hover:text-[#112c52]"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Message cards */}
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-200 rounded w-1/3" />
                        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                      </div>
                      <div className="h-5 w-16 bg-slate-100 rounded-full" />
                    </div>
                  </div>
                ))
              ) : messages.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-600">No messages yet</p>
                    <p className="text-sm text-slate-400 mt-1">Contact form submissions will appear here</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const meta    = STATUS_META[msg.status];
                  const isActive = selected?._id === msg._id;
                  return (
                    <div
                      key={msg._id}
                      onClick={() => openMessage(msg)}
                      className={`group relative bg-white rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                        isActive
                          ? "border-[#112c52] shadow-lg shadow-[#112c52]/10 ring-1 ring-[#112c52]/20"
                          : msg.status === "unread"
                          ? "border-rose-200 shadow-sm hover:shadow-md hover:border-rose-300"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      {/* Unread accent bar */}
                      {msg.status === "unread" && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 to-rose-600 rounded-l-2xl" />
                      )}
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-700 rounded-l-2xl" />
                      )}

                      <div className="p-4 pl-5">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isActive ? "bg-[#112c52] text-white" : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"
                          }`}>
                            {msg.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${msg.status === "unread" ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                                {msg.name}
                              </p>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                                {timeAgo(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{msg.email}</p>
                            <div className="flex items-center justify-between mt-1.5 gap-2">
                              <p className={`text-xs truncate ${msg.status === "unread" ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                                <span className="font-semibold text-slate-600">{msg.subject}</span>
                                <span className="text-slate-400"> — {msg.message}</span>
                              </p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold flex-shrink-0 ${meta.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action row on hover */}
                        <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {msg.status !== "replied" && (
                            <button
                              onClick={() => updateStatus(msg._id, "replied")}
                              disabled={updating === msg._id}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {updating === msg._id ? "…" : "✓ Replied"}
                            </button>
                          )}
                          <button
                            onClick={() => deleteMessage(msg._id)}
                            disabled={deleting === msg._id}
                            className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {deleting === msg._id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >← Prev</button>
                <span className="text-sm text-slate-500 px-2">Page {page} of {pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >Next →</button>
              </div>
            )}
          </div>

          {/* ── Right: Detail Panel ── */}
          <div className="lg:w-[420px] flex-shrink-0">
            {selected ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden sticky top-6">
                {/* Panel header */}
                <div className="bg-gradient-to-r from-[#0d2240] to-[#1a4070] px-6 py-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-lg">
                        {selected.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-bold text-base leading-tight">{selected.name}</p>
                        <p className="text-white/50 text-xs mt-0.5">{selected.email}</p>
                        {selected.phone && <p className="text-white/50 text-xs">{selected.phone}</p>}
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white transition-colors p-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Status + date */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${STATUS_META[selected.status].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[selected.status].dot}`} />
                      {STATUS_META[selected.status].label}
                    </span>
                    <span className="text-white/40 text-xs">{fmt(selected.createdAt)}</span>
                  </div>
                </div>

                {/* Subject */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Subject</p>
                  <p className="text-slate-800 font-semibold text-sm">{selected.subject}</p>
                </div>

                {/* Message body */}
                <div className="px-6 py-5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Message</p>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.status !== "replied" && (
                      <button
                        onClick={() => updateStatus(selected._id, "replied")}
                        disabled={updating === selected._id}
                        className="col-span-2 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {updating === selected._id ? "Updating…" : "Mark as Replied"}
                      </button>
                    )}
                    {selected.status === "unread" && (
                      <button
                        onClick={() => updateStatus(selected._id, "read")}
                        disabled={updating === selected._id}
                        className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteMessage(selected._id)}
                      disabled={deleting === selected._id}
                      className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50 ${selected.status === "unread" ? "" : "col-span-2"}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {deleting === selected._id ? "Deleting…" : "Delete"}
                    </button>
                  </div>

                  {/* Reply via email link */}
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold rounded-xl border border-[#112c52]/20 text-[#112c52] hover:bg-[#112c52]/5 transition-all mt-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Reply via Email
                  </a>
                </div>
              </div>
            ) : (
              /* Empty state for detail panel */
              <div className="bg-white rounded-2xl border border-slate-200 border-dashed flex flex-col items-center justify-center py-20 gap-4 text-slate-400 sticky top-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <svg className="w-7 h-7 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-500 text-sm">No message selected</p>
                  <p className="text-xs text-slate-400 mt-1">Click a message to view details</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}