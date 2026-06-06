'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Image as ImageIcon, X, Tag, Plus, AlertCircle, Save, Send,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';

// Dynamically import to avoid SSR hydration issues with TipTap
const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-[#ede9e1] rounded-xl bg-white min-h-[420px] flex items-center justify-center">
      <Loader2 size={20} className="text-[#c9a84c] animate-spin" />
    </div>
  ),
});

export interface BlogFormData {
  title: string;
  slug: string;
  shortDescription: string;
  content: string;
  featuredImage: string;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  status: 'draft' | 'published';
}

interface BlogEditorProps {
  initialData?: Partial<BlogFormData>;
  blogId?: string;
  isEdit?: boolean;
}

const BLOG_CATEGORIES = [
  'Gemstones', 'Diamonds', 'Watches', 'Jewellery', 'Education',
  'Buying Guide', 'News', 'Lifestyle', 'Investment', 'Care & Maintenance'
];

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function BlogEditor({ initialData, blogId, isEdit }: BlogEditorProps) {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<BlogFormData>({
    title:            initialData?.title            ?? '',
    slug:             initialData?.slug             ?? '',
    shortDescription: initialData?.shortDescription ?? '',
    content:          initialData?.content          ?? '',
    featuredImage:    initialData?.featuredImage    ?? '',
    category:         initialData?.category         ?? '',
    tags:             initialData?.tags             ?? [],
    seoTitle:         initialData?.seoTitle         ?? '',
    seoDescription:   initialData?.seoDescription   ?? '',
    status:           initialData?.status           ?? 'draft',
  });

  const [tagInput, setTagInput]   = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [seoOpen, setSeoOpen]     = useState(false);

  const update = (field: keyof BlogFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleTitleChange = (title: string) => {
    update('title', title);
    if (!isEdit || !form.slug) update('slug', slugify(title));
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) update('tags', [...form.tags, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => update('tags', form.tags.filter(t => t !== tag));

  // Upload image for the featured image field
  const uploadFeaturedImage = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('files', file);
    const res = await authFetch('/api/admin/upload', { method: 'POST', headers: {}, body: fd });
    const d = await res.json();
    if (d.success) update('featuredImage', d.urls[0]);
    setUploading(false);
  };

  // Upload image inside the rich text editor
  const uploadEditorImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('files', file);
    const res = await authFetch('/api/admin/upload', { method: 'POST', headers: {}, body: fd });
    const d = await res.json();
    return d.success ? d.urls[0] : '';
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim())            errs.title = 'Title is required';
    if (!form.shortDescription.trim()) errs.shortDescription = 'Short description is required';
    if (!form.content.trim() || form.content === '<p></p>') errs.content = 'Content is required';
    if (!form.category)                errs.category = 'Category is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!validate()) return;
    setSaving(true);

    const payload = { ...form, status };
    const url    = isEdit ? `/api/admin/blogs/${blogId}` : '/api/admin/blogs';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await authFetch(url, { method, body: JSON.stringify(payload) });
    const d   = await res.json();
    setSaving(false);

    if (d.success) {
      router.push('/admin/blogs');
    } else {
      alert(d.message || 'Failed to save post');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

        {/* ── Left: Main content ── */}
        <div className="space-y-5">

          {/* Title */}
          <div>
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Enter a compelling title…"
              className={`w-full px-4 py-3 text-[1.1rem] font-['Cormorant_Garamond',serif] font-semibold border rounded-xl outline-none bg-white transition-all placeholder:text-[#d4cfc8] ${
                errors.title
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-[#ede9e1] focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/20'
              }`}
            />
            {errors.title && (
              <p className="mt-1 text-[0.65rem] text-red-500 flex items-center gap-1">
                <AlertCircle size={11} />{errors.title}
              </p>
            )}
          </div>

          {/* Slug */}
          <div>
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-2">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-[0.72rem] text-[#b0a898] bg-[#f5f3ef] border border-[#ede9e1] border-r-0 px-3 py-2.5 rounded-l-lg whitespace-nowrap">/blogs/</span>
              <input
                type="text"
                value={form.slug}
                onChange={e => update('slug', slugify(e.target.value))}
                placeholder="auto-generated-from-title"
                className="flex-1 px-3 py-2.5 text-[0.78rem] border border-[#ede9e1] rounded-r-lg outline-none bg-white focus:border-[#c9a84c]/50 focus:ring-1 focus:ring-[#c9a84c]/20 placeholder:text-[#c4bdb2]"
              />
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-2">
              Short Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.shortDescription}
              onChange={e => update('shortDescription', e.target.value)}
              placeholder="A brief summary shown in blog listings (max 500 chars)…"
              rows={3}
              maxLength={500}
              className={`w-full px-4 py-3 text-[0.82rem] border rounded-xl outline-none resize-none bg-white transition-all placeholder:text-[#c4bdb2] ${
                errors.shortDescription
                  ? 'border-red-300'
                  : 'border-[#ede9e1] focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/20'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.shortDescription && (
                <p className="text-[0.65rem] text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} />{errors.shortDescription}
                </p>
              )}
              <p className="ml-auto text-[0.62rem] text-[#c4bdb2]">{form.shortDescription.length}/500</p>
            </div>
          </div>

          {/* ── Rich Text Editor ── */}
          <div>
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-2">
              Content <span className="text-red-400">*</span>
            </label>
            <RichTextEditor
              value={form.content}
              onChange={val => update('content', val)}
              placeholder="Write your article here…"
              onImageUpload={uploadEditorImage}
              error={!!errors.content}
            />
            {errors.content && (
              <p className="mt-1 text-[0.65rem] text-red-500 flex items-center gap-1">
                <AlertCircle size={11} />{errors.content}
              </p>
            )}
          </div>

          {/* SEO (collapsible) */}
          <div className="border border-[#ede9e1] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSeoOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#faf9f7] hover:bg-[#f5f3ef] transition-colors"
            >
              <span className="text-[0.72rem] font-semibold text-[#5c5852] tracking-wide">SEO Settings (optional)</span>
              {seoOpen ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
            </button>
            {seoOpen && (
              <div className="p-4 space-y-4 border-t border-[#ede9e1]">
                <div>
                  <label className="block text-[0.65rem] tracking-widest uppercase text-[#a09a90] font-semibold mb-1.5">SEO Title</label>
                  <input
                    type="text"
                    value={form.seoTitle}
                    onChange={e => update('seoTitle', e.target.value)}
                    placeholder="Custom title for search engines (defaults to post title)"
                    className="w-full px-3 py-2 text-[0.78rem] border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[0.65rem] tracking-widest uppercase text-[#a09a90] font-semibold mb-1.5">SEO Description</label>
                  <textarea
                    value={form.seoDescription}
                    onChange={e => update('seoDescription', e.target.value)}
                    placeholder="Meta description for search results (150–160 chars recommended)"
                    rows={3}
                    className="w-full px-3 py-2 text-[0.78rem] border border-[#ede9e1] rounded-lg outline-none resize-none focus:border-[#c9a84c]/50 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Sidebar settings ── */}
        <div className="space-y-5">

          {/* Publish card */}
          <div className="bg-white border border-[#ede9e1] rounded-xl p-4">
            <h3 className="text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-4">Publish</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSave('published')}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c9a84c] text-white text-[0.75rem] font-semibold rounded-lg hover:bg-[#b8933b] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
                Publish Now
              </button>
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#ede9e1] text-[#5c5852] text-[0.75rem] font-semibold rounded-lg hover:bg-[#f5f3ef] disabled:opacity-50 transition-colors"
              >
                <Save size={14} strokeWidth={2} /> Save as Draft
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-[#f5f3ef]">
              <span className={`flex items-center gap-1.5 text-[0.65rem] font-semibold ${
                form.status === 'published' ? 'text-[#4a7a2a]' : 'text-[#8a6e2a]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${form.status === 'published' ? 'bg-[#9ab87a]' : 'bg-[#c9a84c]'}`} />
                {form.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="bg-white border border-[#ede9e1] rounded-xl p-4">
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-3">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {BLOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => update('category', cat)}
                  className={`px-2.5 py-2 text-[0.65rem] rounded-lg border text-left transition-all ${
                    form.category === cat
                      ? 'bg-[#c9a84c]/10 border-[#c9a84c]/40 text-[#8a6e2a] font-semibold'
                      : 'border-[#f0ede8] text-[#8a8278] hover:border-[#ede9e1] hover:bg-[#f5f3ef]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="mt-2 text-[0.65rem] text-red-500 flex items-center gap-1">
                <AlertCircle size={11} />{errors.category}
              </p>
            )}
          </div>

          {/* Featured Image */}
          <div className="bg-white border border-[#ede9e1] rounded-xl p-4">
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-3">Featured Image</label>

            {form.featuredImage ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.featuredImage} alt="Featured" className="w-full h-36 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => update('featuredImage', '')}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-28 border-2 border-dashed border-[#ede9e1] rounded-lg flex flex-col items-center justify-center gap-2 hover:border-[#c9a84c]/40 hover:bg-[#faf9f7] transition-all"
              >
                {uploading
                  ? <Loader2 size={20} className="text-[#c9a84c] animate-spin" />
                  : <ImageIcon size={20} strokeWidth={1.4} className="text-[#c4bdb2]" />}
                <span className="text-[0.68rem] text-[#b0a898]">{uploading ? 'Uploading…' : 'Click to upload'}</span>
              </button>
            )}

            <input
              type="text"
              value={form.featuredImage}
              onChange={e => update('featuredImage', e.target.value)}
              placeholder="Or paste an image URL…"
              className="mt-2 w-full px-3 py-2 text-[0.7rem] border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 bg-white placeholder:text-[#c4bdb2]"
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFeaturedImage(f); e.target.value = ''; }}
            />
          </div>

          {/* Tags */}
          <div className="bg-white border border-[#ede9e1] rounded-xl p-4">
            <label className="block text-[0.68rem] tracking-[0.15em] uppercase text-[#a09a90] font-semibold mb-3">Tags</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {form.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-[#f5f3ef] text-[#8a8278] text-[0.65rem] rounded-full border border-[#ede9e1]">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-[#b0a898] hover:text-red-400 transition-colors">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Tag size={11} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#c4bdb2]" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag…"
                  className="w-full pl-7 pr-3 py-2 text-[0.72rem] border border-[#ede9e1] rounded-lg outline-none focus:border-[#c9a84c]/50 bg-white placeholder:text-[#c4bdb2]"
                />
              </div>
              <button
                type="button"
                onClick={addTag}
                className="w-8 h-8 bg-[#f5f3ef] rounded-lg flex items-center justify-center hover:bg-[#ede9e1] transition-colors"
              >
                <Plus size={13} strokeWidth={2} className="text-[#6b6560]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}