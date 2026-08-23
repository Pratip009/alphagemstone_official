'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';

type AdminReply = { text: string; repliedAt: string };

type ReviewItem = {
  _id: string;
  user: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
  likeCount: number;
  likedByMe: boolean;
  adminReply?: AdminReply;
  createdAt: string;
};

type Stats = {
  average: number;
  total: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
};

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  highest: 'Highest Rated',
  lowest: 'Lowest Rated',
  helpful: 'Most Helpful',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Star rating (read-only display) ────────────────────────────────────────
function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="pdr-stars-row" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={n <= Math.round(rating) ? '#c8a24a' : 'none'} stroke="#c8a24a" strokeWidth="1.4">
          <polygon points="12 2 15.09 8.63 22 9.24 16.5 14.14 18.18 21 12 17.27 5.82 21 7.5 14.14 2 9.24 8.91 8.63 12 2" />
        </svg>
      ))}
    </span>
  );
}

// ── Star rating (interactive input) ─────────────────────────────────────────
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="pdr-stars-row" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className="pdr-star-btn"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= (hover || value) ? '#c8a24a' : 'none'} stroke="#c8a24a" strokeWidth="1.4">
            <polygon points="12 2 15.09 8.63 22 9.24 16.5 14.14 18.18 21 12 17.27 5.82 21 7.5 14.14 2 9.24 8.91 8.63 12 2" />
          </svg>
        </button>
      ))}
    </span>
  );
}

// ── Heart/like button ────────────────────────────────────────────────────────
function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const [justLiked, setJustLiked] = useState(false);
  return (
    <button
      type="button"
      className={`pdr-like-btn${liked ? ' liked' : ''}`}
      onClick={() => {
        if (!liked) {
          setJustLiked(true);
          setTimeout(() => setJustLiked(false), 320);
        }
        onToggle();
      }}
      disabled={disabled}
      aria-pressed={liked}
    >
      <svg
        className={justLiked ? 'pdr-heart-pop' : ''}
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={liked ? '#c0392b' : 'none'}
        stroke={liked ? '#c0392b' : 'currentColor'}
        strokeWidth="1.6"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinejoin="round" />
      </svg>
      <span>Helpful{count > 0 ? ` (${count})` : ''}</span>
    </button>
  );
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const router = useRouter();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [myReview, setMyReview] = useState<ReviewItem | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Write-review form state
  const [formRating, setFormRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Admin reply state — keyed by review id so multiple boxes can be open.
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);

  const [likeBusy, setLikeBusy] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews?page=${page}&sort=${sort}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setReviews(data.data.reviews);
        setStats(data.data.stats);
        setPages(data.data.pages);
        setMyReview(data.data.myReview);
      }
    } finally {
      setLoading(false);
    }
  }, [productId, page, sort]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Prefill the form when editing an existing review.
  const openForm = () => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (myReview) {
      setFormRating(myReview.rating);
      setFormTitle(myReview.title || '');
      setFormComment(myReview.comment);
    } else {
      setFormRating(0);
      setFormTitle('');
      setFormComment('');
    }
    setFormError('');
    setShowForm(true);
  };

  const submitReview = async () => {
    if (formRating < 1) {
      setFormError('Please select a star rating.');
      return;
    }
    if (formComment.trim().length < 3) {
      setFormError('Please write a few words about your experience.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await authFetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: formRating, title: formTitle, comment: formComment }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit review');
      setShowForm(false);
      setPage(1);
      setSort('newest');
      await fetchReviews();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMyReview = async () => {
    if (!myReview) return;
    if (!confirm('Delete your review?')) return;
    try {
      const res = await authFetch(`/api/reviews/${myReview._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        await fetchReviews();
      }
    } catch {
      // no-op — the list simply won't refresh
    }
  };

  const toggleLike = async (reviewId: string) => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setLikeBusy(reviewId);
    // Optimistic update so the heart feels instant.
    setReviews((prev) =>
      prev.map((r) =>
        r._id === reviewId
          ? { ...r, likedByMe: !r.likedByMe, likeCount: r.likeCount + (r.likedByMe ? -1 : 1) }
          : r
      )
    );
    try {
      const res = await authFetch(`/api/reviews/${reviewId}/like`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) =>
          prev.map((r) => (r._id === reviewId ? { ...r, likedByMe: data.data.liked, likeCount: data.data.likeCount } : r))
        );
      }
    } finally {
      setLikeBusy(null);
    }
  };

  const submitReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] || '').trim();
    if (!text) return;
    setReplyBusy(reviewId);
    try {
      const res = await authFetch(`/api/admin/reviews/${reviewId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.map((r) => (r._id === reviewId ? { ...r, adminReply: data.data.adminReply } : r)));
        setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      }
    } finally {
      setReplyBusy(null);
    }
  };

  const total = stats?.total ?? 0;
  const average = stats?.average ?? 0;

  return (
    <>
      <div className="pdr-summary">
        <div className="pdr-summary-score">
          <div className="pdr-summary-num">{average > 0 ? average.toFixed(1) : '—'}</div>
          <StarDisplay rating={average} size={16} />
          <div className="pdr-summary-count">{total} {total === 1 ? 'review' : 'reviews'}</div>
        </div>
        <div className="pdr-summary-bars">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = stats?.breakdown?.[String(star) as '1' | '2' | '3' | '4' | '5'] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div className="pdr-bar-row" key={star}>
                <span className="pdr-bar-label">{star} ★</span>
                <span className="pdr-bar-track">
                  <span className="pdr-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="pdr-bar-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pdr-toolbar">
        <div className="pdr-sort">
          <label>Sort by</label>
          <select value={sort} onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}>
            {Object.entries(SORT_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="pd-btn-line" onClick={openForm}>
          {myReview ? 'Edit Your Review' : 'Write a Review'}
        </button>
      </div>

      {showForm && (
        <div className="pdr-form">
          <div className="pdr-form-field">
            <label>Your rating</label>
            <StarInput value={formRating} onChange={setFormRating} />
          </div>
          <div className="pdr-form-field">
            <label htmlFor="pdr-title">Title (optional)</label>
            <input
              id="pdr-title"
              type="text"
              maxLength={150}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Sum up your experience"
            />
          </div>
          <div className="pdr-form-field">
            <label htmlFor="pdr-comment">Your review</label>
            <textarea
              id="pdr-comment"
              rows={4}
              maxLength={2000}
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="What did you like or dislike? How was the quality and service?"
            />
          </div>
          {formError && <div className="pdr-form-error">{formError}</div>}
          <div className="pdr-form-actions">
            <button type="button" className="pd-btn-line" disabled={submitting} onClick={submitReview}>
              {submitting ? 'Submitting…' : myReview ? 'Update Review' : 'Submit Review'}
            </button>
            {myReview && (
              <button type="button" className="pdr-delete-link" onClick={deleteMyReview}>
                Delete my review
              </button>
            )}
            <button type="button" className="pdr-cancel-link" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="pd-reviews-empty">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="pd-reviews-empty">There are currently no product reviews. Be the first to write one.</div>
      ) : (
        <div className="pdr-list">
          {reviews.map((r) => (
            <div key={r._id} className="pdr-item">
              <div className="pdr-item-head">
                <div>
                  <StarDisplay rating={r.rating} />
                  {r.title && <div className="pdr-item-title">{r.title}</div>}
                </div>
                <div className="pdr-item-date">{fmtDate(r.createdAt)}</div>
              </div>
              <div className="pdr-item-author">
                {r.userName}
                {r.verifiedPurchase && <span className="pdr-verified">Verified Purchase</span>}
              </div>
              <p className="pdr-item-comment">{r.comment}</p>

              <div className="pdr-item-actions">
                <LikeButton
                  liked={r.likedByMe}
                  count={r.likeCount}
                  disabled={likeBusy === r._id}
                  onToggle={() => toggleLike(r._id)}
                />
              </div>

              {r.adminReply && (
                <div className="pdr-reply">
                  <div className="pdr-reply-head">Reply from Alpha Gemstone</div>
                  <p className="pdr-reply-text">{r.adminReply.text}</p>
                  <div className="pdr-reply-date">{fmtDate(r.adminReply.repliedAt)}</div>
                </div>
              )}

              {isAdmin && !r.adminReply && (
                <div className="pdr-admin-reply-box">
                  <textarea
                    rows={2}
                    placeholder="Reply to this review as Alpha Gemstone…"
                    value={replyDrafts[r._id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r._id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="pd-btn-line"
                    disabled={replyBusy === r._id || !(replyDrafts[r._id] || '').trim()}
                    onClick={() => submitReply(r._id)}
                  >
                    {replyBusy === r._id ? 'Posting…' : 'Post Reply'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="pdr-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </>
  );
}
