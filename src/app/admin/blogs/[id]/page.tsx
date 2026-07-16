'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import BlogEditor, { BlogFormData } from '../BlogEditor';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';

export default function EditBlogPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [data, setData]       = useState<BlogFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    authFetch(`/api/admin/blogs/${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setError('Blog not found'); return; }
        const b = d.data;
        setData({
          title:            b.title,
          slug:             b.slug,
          shortDescription: b.shortDescription,
          content:          b.content,
          featuredImage:    b.featuredImage ?? '',
          category:         b.category,
          tags:             b.tags ?? [],
          seoTitle:         b.seoTitle ?? '',
          seoDescription:   b.seoDescription ?? '',
          status:           b.status,
        });
      })
      .catch(() => setError('Failed to load blog'))
      .finally(() => setLoading(false));
  }, [authLoading, user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/blogs" className="flex items-center gap-1.5 text-[0.7rem] text-[#a09a90] hover:text-[#c9a84c] transition-colors">
          <ArrowLeft size={13} strokeWidth={2} /> Back
        </Link>
        <span className="text-[#d4cfc8]">/</span>
        <span className="text-[0.7rem] font-semibold text-[#1a1714]">Edit Post</span>
      </div>

      <div className="mb-6">
        <p className="text-[0.68rem] tracking-[0.22em] uppercase text-[#c9a84c] font-semibold mb-2">◆ Content Management</p>
        <h1 className="font-['Cormorant_Garamond',serif] text-[2.4rem] font-medium text-[#1a1714] leading-none">
          Edit Post
        </h1>
      </div>
      <div className="mb-6 h-px bg-gradient-to-r from-[#c9a84c]/30 via-[#ede9e1] to-transparent" />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[#c9a84c]" strokeWidth={1.5} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[0.85rem] text-[#8a8278] mb-4">{error}</p>
          <Link href="/admin/blogs" className="text-[0.75rem] font-semibold text-[#c9a84c] hover:underline">
            ← Back to blogs
          </Link>
        </div>
      ) : data ? (
        <BlogEditor initialData={data} blogId={id} isEdit />
      ) : null}
    </div>
  );
}