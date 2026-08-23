"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

type ReviewRow = {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  isHidden: boolean;
  verifiedPurchase: boolean;
  likeCount: number;
  createdAt: string;
  user: { _id?: string; name: string; email?: string };
  product: { _id: string; name: string; image?: string } | null;
  adminReply?: { text: string; repliedAt: string };
};

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#c8a24a", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(rating)}
      <span style={{ color: "#e2ddd0" }}>{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function AdminReviewsPage() {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState<"" | "yes" | "no">("");
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (filter) params.set("hasReply", filter);
      const res = await fetch(`/api/admin/reviews?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setReviews(data.data.reviews);
        setTotal(data.data.total);
        setPages(data.data.pages);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, user]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const postReply = async (id: string) => {
    const text = (replyDrafts[id] || "").trim();
    if (!text) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.map((r) => (r._id === id ? { ...r, adminReply: data.data.adminReply } : r)));
        setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      }
    } finally {
      setBusy(null);
    }
  };

  const removeReply = async (id: string) => {
    if (!confirm("Remove this reply?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}/reply`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.map((r) => (r._id === id ? { ...r, adminReply: undefined } : r)));
      }
    } finally {
      setBusy(null);
    }
  };

  const toggleHidden = async (id: string, isHidden: boolean) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !isHidden }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.map((r) => (r._id === id ? { ...r, isHidden: !isHidden } : r)));
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Permanently delete this review?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.filter((r) => r._id !== id));
        setTotal((t) => t - 1);
      }
    } finally {
      setBusy(null);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a1a]">Product Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total review{total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          {(["", "no", "yes"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                filter === f ? "bg-[#0f0e0c] text-white border-[#0f0e0c]" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {f === "" ? "All" : f === "no" ? "Needs Reply" : "Replied"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">No reviews found.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((r) => (
            <div key={r._id} className="border border-gray-200 rounded-lg bg-white p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <Stars rating={r.rating} />
                  {r.title && <div className="text-sm font-semibold mt-1">{r.title}</div>}
                  <div className="text-xs text-gray-500 mt-1">
                    {r.user.name} {r.user.email ? `· ${r.user.email}` : ""} · {fmt(r.createdAt)}
                    {r.verifiedPurchase && (
                      <span className="ml-2 text-emerald-600 font-semibold">Verified Purchase</span>
                    )}
                  </div>
                  {r.product && (
                    <Link href={`/products/${r.product._id}`} target="_blank" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                      {r.product.name}
                    </Link>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleHidden(r._id, r.isHidden)}
                    disabled={busy === r._id}
                    className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    {r.isHidden ? "Unhide" : "Hide"}
                  </button>
                  <button
                    onClick={() => deleteReview(r._id)}
                    disabled={busy === r._id}
                    className="text-xs px-2.5 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-700 mt-3 leading-relaxed">{r.comment}</p>

              {r.isHidden && (
                <div className="mt-2 text-xs text-amber-600 font-medium">Hidden from storefront</div>
              )}

              {r.adminReply ? (
                <div className="mt-3 border-l-2 border-[#c8a24a] bg-[#faf7f0] rounded-r-md px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#0f0e0c]">Your Reply</div>
                  <p className="text-xs text-gray-700 mt-1">{r.adminReply.text}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-gray-400">{fmt(r.adminReply.repliedAt)}</span>
                    <button onClick={() => removeReply(r._id)} disabled={busy === r._id} className="text-[10px] text-rose-500 hover:underline">
                      Remove reply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply as Alpha Gemstone…"
                    value={replyDrafts[r._id] || ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r._id]: e.target.value }))}
                    className="flex-1 text-xs border border-gray-200 rounded-md px-3 py-2"
                  />
                  <button
                    onClick={() => postReply(r._id)}
                    disabled={busy === r._id || !(replyDrafts[r._id] || "").trim()}
                    className="text-xs px-3 py-2 rounded-md bg-[#0f0e0c] text-white disabled:opacity-40"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-500">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded-md disabled:opacity-40">
            ← Prev
          </button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded-md disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
