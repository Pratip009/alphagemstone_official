'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, Heart, MessageCircle, Clock, TrendingUp, Calendar, BookOpen, Filter } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlogCard {
  _id: string;
  title: string;
  slug: string;
  shortDescription: string;
  featuredImage: string;
  category: string;
  tags: string[];
  publishedAt: string;
  views: number;
  likes: string[];
  comments: unknown[];
  authorName: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readingTime(desc: string) {
  return Math.max(1, Math.ceil(desc.split(' ').length / 50));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BlogCardSkeleton() {
  return (
    <div className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-52 bg-[#ede9e1]" />
      <div className="p-5 space-y-3">
        <div className="h-3 w-20 bg-[#ede9e1] rounded-full" />
        <div className="h-5 w-3/4 bg-[#ede9e1] rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-[#ede9e1] rounded" />
          <div className="h-3 w-5/6 bg-[#ede9e1] rounded" />
        </div>
        <div className="flex gap-3 pt-2">
          <div className="h-3 w-16 bg-[#ede9e1] rounded" />
          <div className="h-3 w-12 bg-[#ede9e1] rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Blog Card ────────────────────────────────────────────────────────────────

function BlogCardComponent({ blog }: { blog: BlogCard }) {
  const mins = readingTime(blog.shortDescription);

  return (
    <Link href={`/blogs/${blog.slug}`} className="group block">
      <article className="bg-white border border-[#ede9e1] rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.09)] transition-all duration-300 h-full flex flex-col">
        {/* Image */}
        <div className="relative h-52 overflow-hidden bg-[#f5f3ef]">
          {blog.featuredImage ? (
            <Image
              src={blog.featuredImage}
              alt={blog.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={32} className="text-[#d4cfc8]" strokeWidth={1.2} />
            </div>
          )}
          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 text-[0.62rem] font-semibold tracking-widest uppercase bg-[#0f0e0c]/70 text-[#c9a84c] backdrop-blur-sm rounded-full border border-[#c9a84c]/30">
              {blog.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          <h2 className="font-['Cormorant_Garamond',serif] text-[1.25rem] font-semibold text-[#1a1714] leading-snug mb-2 group-hover:text-[#8a6e2a] transition-colors line-clamp-2">
            {blog.title}
          </h2>
          <p className="text-[0.75rem] text-[#8a8278] leading-relaxed line-clamp-2 flex-1 mb-3">
            {blog.shortDescription}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 text-[0.68rem] text-[#a09a90] pt-3 border-t border-[#f5f3ef]">
            <span className="flex items-center gap-1">
              <Calendar size={11} strokeWidth={1.8} />
              {blog.publishedAt ? formatDate(blog.publishedAt) : '—'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} strokeWidth={1.8} />
              {mins} min read
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Heart size={11} strokeWidth={1.8} className="text-rose-400" />
              {blog.likes.length}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={11} strokeWidth={1.8} />
              {blog.comments.length}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BlogsPage() {
  const [blogs, setBlogs]           = useState<BlogCard[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);

  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort]         = useState<'latest' | 'popular'>('latest');
  const [page, setPage]         = useState(1);
  const [searchInput, setSearchInput] = useState('');

  // Fetch categories once
  useEffect(() => {
    fetch('/api/blogs/categories')
      .then(r => r.json())
      .then(d => setCategories(d.data ?? []));
  }, []);

  // Fetch blogs
  const fetchBlogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: '9',
      sort,
    });
    if (search)           params.set('search', search);
    if (category !== 'all') params.set('category', category);

    fetch(`/api/blogs?${params}`)
      .then(r => r.json())
      .then(d => {
        setBlogs(d.data ?? []);
        setPagination(d.pagination ?? null);
      })
      .catch(() => setBlogs([]))
      .finally(() => setLoading(false));
  }, [page, search, category, sort]);

  useEffect(() => { fetchBlogs(); }, [fetchBlogs]);

  // Reset page when filters change
  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleCategory = (c: string) => { setCategory(c); setPage(1); };
  const handleSort = (s: 'latest' | 'popular') => { setSort(s); setPage(1); };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Hero banner ── */}
      <section className="relative py-20 overflow-hidden bg-[#0f0e0c]">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #c9a84c 0%, transparent 60%), radial-gradient(circle at 70% 50%, #7ab0c9 0%, transparent 60%)' }}
        />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <p className="text-[0.65rem] tracking-[0.3em] uppercase text-[#c9a84c] font-semibold mb-4">◆ Knowledge & Insights</p>
          <h1 className="font-['Cormorant_Garamond',serif] text-[3.2rem] sm:text-[4rem] font-medium text-white leading-none tracking-tight mb-5">
            The Alpha Blog
          </h1>
          <p className="text-[0.9rem] text-[#8a8278] max-w-xl mx-auto leading-relaxed">
            Expert insights on gemstones, diamonds, watches, and fine jewellery from the Alpha Gemstone team.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c9a84c]/50" />
            <span className="text-[#c9a84c] text-xs">✦</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c9a84c]/50" />
          </div>
        </div>
      </section>

      {/* ── Filters bar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#ede9e1] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4bdb2]" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search articles…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-8 pr-3 py-2 text-[0.72rem] bg-[#faf9f7] border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all placeholder:text-[#c4bdb2]"
            />
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['all', ...categories].map(c => (
              <button
                key={c}
                onClick={() => handleCategory(c)}
                className={`px-3 py-1.5 rounded-full text-[0.65rem] font-semibold tracking-wide uppercase transition-all duration-150 ${
                  category === c
                    ? 'bg-[#c9a84c] text-white'
                    : 'bg-[#f5f3ef] text-[#8a8278] hover:bg-[#ede9e1]'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Filter size={12} className="text-[#a09a90]" strokeWidth={2} />
            {([['latest', 'Latest'], ['popular', 'Popular']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => handleSort(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.65rem] font-semibold transition-all ${
                  sort === v
                    ? 'bg-[#1a1714] text-white'
                    : 'text-[#8a8278] hover:bg-[#f5f3ef]'
                }`}
              >
                {v === 'popular' ? <TrendingUp size={11} strokeWidth={2} /> : <Clock size={11} strokeWidth={2} />}
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Blog grid ── */}
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Count */}
        {!loading && pagination && (
          <p className="text-[0.72rem] text-[#a09a90] mb-6">
            {pagination.total} article{pagination.total !== 1 ? 's' : ''}
            {search && ` for "${search}"`}
            {category !== 'all' && ` in ${category}`}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => <BlogCardSkeleton key={i} />)}
          </div>
        ) : blogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen size={40} strokeWidth={1} className="text-[#d4cfc8] mb-4" />
            <h3 className="font-['Cormorant_Garamond',serif] text-2xl text-[#1a1714] mb-2">No articles found</h3>
            <p className="text-[0.78rem] text-[#a09a90]">Try adjusting your search or filters</p>
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setCategory('all'); setPage(1); }}
              className="mt-5 px-5 py-2 text-[0.72rem] font-semibold border border-[#c9a84c]/50 text-[#8a6e2a] rounded-full hover:bg-[#c9a84c]/10 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map(blog => <BlogCardComponent key={blog._id} blog={blog} />)}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-[#ede9e1] flex items-center justify-center hover:border-[#c9a84c]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>

            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1
                : page >= pagination.totalPages - 2 ? pagination.totalPages - 4 + i
                : page - 2 + i;
              if (p < 1 || p > pagination.totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-9 h-9 rounded-xl text-[0.75rem] font-semibold transition-all"
                  style={p === page
                    ? { background: '#c9a84c', color: '#fff', border: '1px solid #c9a84c' }
                    : { background: 'transparent', color: '#6b6560', border: '1px solid #ede9e1' }}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="w-9 h-9 rounded-xl border border-[#ede9e1] flex items-center justify-center hover:border-[#c9a84c]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}