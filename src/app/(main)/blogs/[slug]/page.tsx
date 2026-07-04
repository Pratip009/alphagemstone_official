'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Heart, MessageCircle, Clock, Calendar, Share2, Link2, ChevronRight,
  BookOpen, Send, Pencil, Trash2, X, Check, List, ArrowLeft, Eye, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reply {
  _id: string;
  user: string;
  userName: string;
  isAdmin: boolean;
  message: string;
  createdAt: string;
}

interface Comment {
  _id: string;
  user: string;
  userName: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  replies: Reply[];
}

interface Blog {
  _id: string;
  title: string;
  slug: string;
  shortDescription: string;
  content: string;
  featuredImage: string;
  category: string;
  tags: string[];
  seoTitle?: string;
  publishedAt?: string;
  views: number;
  likes: string[];
  comments: Comment[];
  authorName: string;
}

interface RelatedBlog {
  _id: string;
  title: string;
  slug: string;
  featuredImage: string;
  category: string;
  publishedAt?: string;
  shortDescription: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calcReadingTime(html: string) {
  const text = html.replace(/<[^>]*>/g, '');
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
}

function extractHeadings(html: string): { id: string; text: string; level: number }[] {
  const matches = [...html.matchAll(/<h([2-3])[^>]*>(.*?)<\/h[2-3]>/gi)];
  return matches.map((m, i) => ({
    id: `heading-${i}`,
    text: m[2].replace(/<[^>]*>/g, ''),
    level: parseInt(m[1]),
  }));
}

function injectHeadingIds(html: string): string {
  let i = 0;
  return html.replace(/<h([2-3])([^>]*)>/gi, (_match, level, attrs) => {
    const id = `heading-${i++}`;
    return `<h${level} id="${id}"${attrs}>`;
  });
}

// ─── Reading Progress Bar ────────────────────────────────────────────────────

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-[#c9a84c] to-[#e8d08a] transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Table of Contents ───────────────────────────────────────────────────────

function TableOfContents({ headings }: { headings: { id: string; text: string; level: number }[] }) {
  const [active, setActive] = useState('');

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-20% 0% -70% 0%' }
    );
    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div className="bg-[#faf9f7] border border-[#ede9e1] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <List size={13} strokeWidth={2} className="text-[#c9a84c]" />
        <span className="text-[0.68rem] font-semibold tracking-[0.15em] uppercase text-[#a09a90]">Contents</span>
      </div>
      <nav className="space-y-0.5">
        {headings.map(h => (
          <button
            key={h.id}
            onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })}
            className={`block w-full text-left text-[0.72rem] py-1.5 transition-colors duration-150 leading-snug rounded px-2 ${
              h.level === 3 ? 'pl-5' : ''
            } ${active === h.id
              ? 'text-[#c9a84c] font-semibold bg-[#c9a84c]/8'
              : 'text-[#8a8278] hover:text-[#1a1714]'
            }`}
          >
            {active === h.id && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#c9a84c] mr-2 align-middle" />}
            {h.text}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Related Articles Sidebar Card ───────────────────────────────────────────

function RelatedArticlesSidebar({ related, currentSlug }: { related: RelatedBlog[]; currentSlug: string }) {
  const articles = related.filter(b => b.slug !== currentSlug).slice(0, 4);
  if (articles.length === 0) return null;

  return (
    <div className="bg-white border border-[#ede9e1] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#f5f3ef] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={13} strokeWidth={2} className="text-[#c9a84c]" />
          <span className="text-[0.68rem] font-semibold tracking-[0.15em] uppercase text-[#a09a90]">Related</span>
        </div>
        <Link
          href="/blogs"
          className="text-[0.62rem] text-[#c9a84c] hover:underline font-semibold flex items-center gap-0.5"
        >
          All <ChevronRight size={10} strokeWidth={2.5} />
        </Link>
      </div>

      {/* Articles */}
      <div className="divide-y divide-[#f5f3ef]">
        {articles.map(b => (
          <Link
            key={b._id}
            href={`/blogs/${b.slug}`}
            className="group flex gap-3 p-3 hover:bg-[#faf9f7] transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative w-16 h-14 shrink-0 rounded-lg overflow-hidden bg-[#f5f3ef]">
              {b.featuredImage ? (
                <Image
                  src={b.featuredImage}
                  alt={b.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="64px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen size={14} className="text-[#d4cfc8]" />
                </div>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <span className="block text-[0.55rem] tracking-widest uppercase text-[#c9a84c] font-semibold mb-0.5">
                {b.category}
              </span>
              <h4 className="text-[0.75rem] font-semibold text-[#1a1714] leading-snug line-clamp-2 group-hover:text-[#8a6e2a] transition-colors font-['Cormorant_Garamond',serif]">
                {b.title}
              </h4>
              {b.publishedAt && (
                <span className="text-[0.6rem] text-[#b0a898] mt-1 block">
                  {new Date(b.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Comment component ────────────────────────────────────────────────────────

function CommentItem({
  comment, blogSlug, currentUserId, isAdmin, onUpdate
}: {
  comment: Comment;
  blogSlug: string;
  currentUserId?: string;
  isAdmin?: boolean;
  onUpdate: () => void;
}) {
  const authFetch = useAuthFetch();
  const [editing, setEditing] = useState(false);
  const [editMsg, setEditMsg] = useState(comment.message);
  const [replying, setReplying] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const canEdit = currentUserId === comment.user;
  const canDelete = canEdit || isAdmin;

  const handleEdit = async () => {
    if (!editMsg.trim()) return;
    setLoading(true);
    await authFetch(`/api/blogs/${blogSlug}/comments/${comment._id}`, {
      method: 'PUT',
      body: JSON.stringify({ message: editMsg }),
    });
    setEditing(false);
    setLoading(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    await authFetch(`/api/blogs/${blogSlug}/comments/${comment._id}`, { method: 'DELETE' });
    onUpdate();
  };

  const handleReply = async () => {
    if (!replyMsg.trim()) return;
    setLoading(true);
    await authFetch(`/api/blogs/${blogSlug}/comments/${comment._id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message: replyMsg }),
    });
    setReplyMsg('');
    setReplying(false);
    setLoading(false);
    onUpdate();
  };

  return (
    <div className="py-4 border-b border-[#f5f3ef] last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/20 flex items-center justify-center shrink-0">
          <span className="text-[0.7rem] font-bold text-[#c9a84c]">{comment.userName.charAt(0).toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.8rem] font-semibold text-[#1a1714]">{comment.userName}</span>
            <span className="text-[0.65rem] text-[#b0a898]">
              {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editMsg}
                onChange={e => setEditMsg(e.target.value)}
                rows={3}
                className="w-full text-[0.78rem] p-2.5 border border-[#c9a84c]/40 rounded-lg outline-none resize-none bg-white focus:ring-1 focus:ring-[#c9a84c]/20"
              />
              <div className="flex gap-2">
                <button onClick={handleEdit} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 bg-[#c9a84c] text-white text-[0.68rem] rounded-lg font-semibold hover:bg-[#b8933b] transition-colors">
                  <Check size={11} /> Save
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 border border-[#ede9e1] text-[0.68rem] rounded-lg hover:bg-[#f5f3ef] transition-colors">
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[0.78rem] text-[#5c5852] leading-relaxed">{comment.message}</p>
          )}

          {!editing && (
            <div className="flex items-center gap-3 mt-2">
              {(isAdmin || currentUserId) && (
                <button onClick={() => setReplying(!replying)} className="text-[0.65rem] text-[#a09a90] hover:text-[#c9a84c] transition-colors">
                  Reply
                </button>
              )}
              {canEdit && (
                <button onClick={() => setEditing(true)} className="text-[0.65rem] text-[#a09a90] hover:text-[#8a6e2a] transition-colors flex items-center gap-1">
                  <Pencil size={10} /> Edit
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="text-[0.65rem] text-[#a09a90] hover:text-red-500 transition-colors flex items-center gap-1">
                  <Trash2 size={10} /> Delete
                </button>
              )}
            </div>
          )}

          {replying && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Write a reply…"
                value={replyMsg}
                onChange={e => setReplyMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReply()}
                className="flex-1 text-[0.72rem] px-3 py-2 border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 bg-white"
              />
              <button onClick={handleReply} disabled={loading || !replyMsg.trim()} className="px-3 py-2 bg-[#c9a84c] text-white rounded-lg hover:bg-[#b8933b] disabled:opacity-50 transition-colors">
                <Send size={13} strokeWidth={2} />
              </button>
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 border-[#ede9e1] space-y-3">
              {comment.replies.map(reply => (
                <div key={reply._id} className="flex items-start gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[0.6rem] font-bold ${
                    reply.isAdmin
                      ? 'bg-[#c9a84c]/20 text-[#8a6e2a] border border-[#c9a84c]/30'
                      : 'bg-[#7ab0c9]/15 text-[#4a90c9] border border-[#7ab0c9]/25'
                  }`}>
                    {reply.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[0.72rem] font-semibold text-[#1a1714]">{reply.userName}</span>
                      {reply.isAdmin && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#c9a84c]/10 text-[#8a6e2a] text-[0.55rem] font-semibold rounded-full border border-[#c9a84c]/20">
                          <ShieldCheck size={8} /> Admin
                        </span>
                      )}
                      <span className="text-[0.6rem] text-[#b0a898]">
                        {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[0.74rem] text-[#5c5852] leading-relaxed">{reply.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Blog Detail ─────────────────────────────────────────────────────────

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const authFetch = useAuthFetch();

  const [blog, setBlog]         = useState<Blog | null>(null);
  const [related, setRelated]   = useState<RelatedBlog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [liked, setLiked]           = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentText, setCommentText]       = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [copied, setCopied]         = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  const fetchBlog = useCallback(() => {
    fetch(`/api/blogs/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setNotFound(true); return; }
        setBlog(d.data);
        setLikesCount(d.data.likes.length);
        if (user) setLiked(d.data.likes.includes(user.id));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, user]);

  useEffect(() => { fetchBlog(); }, [fetchBlog]);

  // Fetch related blogs (same category, exclude current)
  useEffect(() => {
    if (!blog) return;
    fetch(`/api/blogs?category=${encodeURIComponent(blog.category)}&limit=5`)
      .then(r => r.json())
      .then(d => {
        const filtered = (d.data ?? []).filter((b: RelatedBlog) => b.slug !== blog.slug);
        setRelated(filtered.slice(0, 4));
      })
      .catch(() => {});
  }, [blog]);

  const handleLike = async () => {
    if (!user) { alert('Please sign in to like this article'); return; }
    const optimistic = !liked;
    setLiked(optimistic);
    setLikesCount(c => optimistic ? c + 1 : c - 1);
    try {
      const res = await authFetch(`/api/blogs/${slug}/like`, { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        setLiked(d.data.liked);
        setLikesCount(d.data.likesCount);
      }
    } catch {
      setLiked(!optimistic);
      setLikesCount(c => optimistic ? c - 1 : c + 1);
    }
  };

  const handleComment = async () => {
    if (!user) { alert('Please sign in to comment'); return; }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    await authFetch(`/api/blogs/${slug}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message: commentText }),
    });
    setCommentText('');
    setCommentLoading(false);
    fetchBlog();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 animate-pulse">
          <div className="h-8 w-3/4 bg-[#ede9e1] rounded mb-4" />
          <div className="h-4 w-1/3 bg-[#ede9e1] rounded mb-8" />
          <div className="h-80 w-full bg-[#ede9e1] rounded-2xl mb-8" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-4 w-full bg-[#ede9e1] rounded mb-3" />)}
        </div>
      </div>
    );
  }

  if (notFound || !blog) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg)' }}>
        <BookOpen size={48} strokeWidth={1} className="text-[#d4cfc8] mb-4" />
        <h1 className="font-['Cormorant_Garamond',serif] text-3xl text-[#1a1714] mb-2">Article Not Found</h1>
        <Link href="/blogs" className="text-[0.78rem] text-[#c9a84c] hover:underline flex items-center gap-1 mt-3">
          <ArrowLeft size={13} /> Back to Blog
        </Link>
      </div>
    );
  }

  const headings = extractHeadings(blog.content);
  const processedContent = injectHeadingIds(blog.content);
  const readMins = calcReadingTime(blog.content);
  const hasSidebar = headings.length > 0 || related.length > 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <ReadingProgressBar />

      {/* ── Hero ── */}
      <section className="relative">
        {blog.featuredImage ? (
          <div className="relative h-[420px] md:h-[520px] overflow-hidden">
            <Image src={blog.featuredImage} alt={blog.title} fill className="object-cover" priority sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0c]/80 via-[#0f0e0c]/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14">
              <div className="max-w-6xl mx-auto">
                <Link href="/blogs" className="inline-flex items-center gap-1.5 text-[0.65rem] text-[#c9a84c] tracking-widest uppercase font-semibold mb-4 hover:text-white transition-colors">
                  <ArrowLeft size={11} /> Blog
                </Link>
                <span className="block text-[0.6rem] tracking-[0.25em] uppercase text-[#c9a84c] font-semibold mb-3">{blog.category}</span>
                <h1 className="font-['Cormorant_Garamond',serif] text-[2.2rem] md:text-[3rem] font-semibold text-white leading-tight max-w-3xl">
                  {blog.title}
                </h1>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0f0e0c] py-20 px-6">
            <div className="max-w-6xl mx-auto">
              <Link href="/blogs" className="inline-flex items-center gap-1.5 text-[0.65rem] text-[#c9a84c] tracking-widest uppercase font-semibold mb-4 hover:text-[#e8d08a] transition-colors">
                <ArrowLeft size={11} /> Blog
              </Link>
              <span className="block text-[0.6rem] tracking-[0.25em] uppercase text-[#c9a84c] font-semibold mb-3">{blog.category}</span>
              <h1 className="font-['Cormorant_Garamond',serif] text-[2.5rem] md:text-[3.5rem] font-semibold text-white leading-tight max-w-3xl">
                {blog.title}
              </h1>
            </div>
          </div>
        )}
      </section>

      {/* ── Article meta bar ── */}
      <div className="bg-white border-b border-[#ede9e1] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-4 text-[0.68rem] text-[#a09a90]">
          <span className="font-semibold text-[#5c5852]">By {blog.authorName}</span>
          {blog.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar size={11} strokeWidth={1.8} />{formatDate(blog.publishedAt)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} strokeWidth={1.8} />{readMins} min read
          </span>
          <span className="flex items-center gap-1">
            <Eye size={11} strokeWidth={1.8} />{blog.views.toLocaleString()} views
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-[0.68rem] font-semibold ${
                liked
                  ? 'bg-rose-50 border-rose-200 text-rose-500'
                  : 'border-[#ede9e1] text-[#a09a90] hover:border-rose-200 hover:text-rose-400'
              }`}
            >
              <Heart size={12} strokeWidth={2} className={liked ? 'fill-rose-500' : ''} />
              {likesCount}
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#ede9e1] text-[#a09a90] hover:border-[#c9a84c]/40 hover:text-[#8a6e2a] transition-all text-[0.68rem]"
            >
              {copied ? <Check size={12} strokeWidth={2.5} className="text-green-500" /> : <Link2 size={12} strokeWidth={2} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={() => navigator.share({ title: blog.title, url: window.location.href })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#ede9e1] text-[#a09a90] hover:border-[#c9a84c]/40 hover:text-[#8a6e2a] transition-all text-[0.68rem]"
              >
                <Share2 size={12} strokeWidth={2} /> Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content layout ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className={`grid gap-10 ${hasSidebar ? 'grid-cols-1 lg:grid-cols-[1fr_272px]' : 'grid-cols-1 max-w-3xl'}`}>

          {/* ── Article content ── */}
          <div>
            {/* Lead / excerpt */}
            <p className="text-[1.05rem] text-[#5c5852] leading-relaxed mb-8 border-l-4 border-[#c9a84c] pl-5 italic font-['Cormorant_Garamond',serif]">
              {blog.shortDescription}
            </p>

            {/* Body */}
            <div
              ref={contentRef}
              className="prose-blog"
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />

            {/* Tags */}
            {blog.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {blog.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 text-[0.65rem] font-semibold tracking-wide bg-[#f5f3ef] text-[#8a8278] rounded-full border border-[#ede9e1]">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* ── Comments ── */}
            <div className="mt-12 pt-8 border-t border-[#ede9e1]">
              <h2 className="font-['Cormorant_Garamond',serif] text-[1.6rem] text-[#1a1714] mb-6 flex items-center gap-3">
                <MessageCircle size={20} strokeWidth={1.4} className="text-[#c9a84c]" />
                {blog.comments.length} Comment{blog.comments.length !== 1 ? 's' : ''}
              </h2>

              {user ? (
                <div className="mb-6 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/20 flex items-center justify-center shrink-0 text-[0.7rem] font-bold text-[#c9a84c]">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Share your thoughts…"
                      rows={3}
                      className="w-full text-[0.78rem] p-3 border border-[#ede9e1] rounded-xl outline-none resize-none bg-white focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all placeholder:text-[#c4bdb2]"
                    />
                    <button
                      onClick={handleComment}
                      disabled={commentLoading || !commentText.trim()}
                      className="flex items-center gap-2 px-5 py-2 bg-[#c9a84c] text-white text-[0.72rem] font-semibold rounded-lg hover:bg-[#b8933b] disabled:opacity-50 transition-colors"
                    >
                      <Send size={13} strokeWidth={2} />
                      {commentLoading ? 'Posting…' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-[#faf9f7] border border-[#ede9e1] rounded-xl text-center">
                  <p className="text-[0.75rem] text-[#8a8278] mb-2">Sign in to join the discussion</p>
                  <Link href="/login" className="text-[0.72rem] font-semibold text-[#c9a84c] hover:underline">
                    Sign In →
                  </Link>
                </div>
              )}

              {blog.comments.length === 0 ? (
                <div className="py-8 text-center text-[0.78rem] text-[#b0a898]">
                  No comments yet. Be the first to share your thoughts!
                </div>
              ) : (
                <div className="divide-y divide-[#f5f3ef]">
                  {blog.comments.map(comment => (
                    <CommentItem
                      key={comment._id}
                      comment={comment}
                      blogSlug={slug}
                      currentUserId={user?.id}
                      isAdmin={user?.role === 'admin'}
                      onUpdate={fetchBlog}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Sticky Sidebar ── */}
          {hasSidebar && (
            <aside className="hidden lg:block">
              <div className="sticky top-[60px] space-y-5">
                {/* Table of Contents */}
                <TableOfContents headings={headings} />

                {/* Related Articles */}
                <RelatedArticlesSidebar related={related} currentSlug={slug} />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Blog content styles ── */}
      <style jsx global>{`
        .prose-blog {
          color: #3c3830;
          font-size: 0.95rem;
          line-height: 1.85;
           font-family: "Google Sans Flex", sans-serif;
        }
        .prose-blog h2 {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 1.7rem;
          font-weight: 600;
          color: #1a1714;
          margin: 2.2rem 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #ede9e1;
        }
        .prose-blog h3 {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 1.3rem;
          font-weight: 600;
          color: #1a1714;
          margin: 1.8rem 0 0.7rem;
        }
        .prose-blog p { margin-bottom: 1.2rem; }
        .prose-blog a { color: #c9a84c; text-decoration: underline; text-decoration-color: #c9a84c40; }
        .prose-blog a:hover { color: #8a6e2a; }
        .prose-blog strong { font-weight: 700; color: #1a1714; }
        .prose-blog em { font-style: italic; color: #5c5852; }
        .prose-blog ul, .prose-blog ol { padding-left: 1.5rem; margin-bottom: 1.2rem; }
        .prose-blog li { margin-bottom: 0.4rem; }
        .prose-blog blockquote {
          border-left: 4px solid #c9a84c;
          padding: 0.8rem 1.2rem;
          margin: 1.5rem 0;
          background: #faf9f7;
          border-radius: 0 8px 8px 0;
           font-family: "Google Sans Flex", sans-serif;
          font-size: 1.05rem;
          color: #5c5852;
          font-style: italic;
        }
        .prose-blog img {
          border-radius: 12px;
          margin: 1.5rem 0;
          max-width: 100%;
        }
        .prose-blog code {
          background: #f5f3ef;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85em;
          font-family: "Google Sans Flex", sans-serif;
          color: #c9a84c;
        }
        .prose-blog pre {
          background: #1a1714;
          color: #e8e0d0;
          padding: 1.2rem;
          border-radius: 10px;
          overflow-x: auto;
          margin: 1.5rem 0;
          font-size: 0.82rem;
        }
        .prose-blog hr {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, #c9a84c40, transparent);
          margin: 2rem 0;
        }
        .prose-blog table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.85rem;
        }
        .prose-blog table th {
          background: #f5f3ef;
          padding: 0.5rem 0.75rem;
          border: 1px solid #ede9e1;
          font-weight: 600;
          color: #1a1714;
          text-align: left;
        }
        .prose-blog table td {
          padding: 0.5rem 0.75rem;
          border: 1px solid #ede9e1;
          color: #5c5852;
        }
        .prose-blog table tr:nth-child(even) td { background: #faf9f7; }
      `}</style>
    </div>
  );
}