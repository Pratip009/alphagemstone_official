'use client';

import {
  useEffect, useRef, useState, useCallback,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Plus, Pencil, Trash2, GripVertical, Eye, EyeOff,
  CheckCircle2, AlertCircle, X, Upload, ExternalLink,
  ImagePlus, Monitor, Smartphone, ChevronUp, ChevronDown,
  LayoutDashboard,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface HeroSlide {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  desktopImage: string;
  mobileImage?: string;
  accent?: string;
  accentGlow?: string;
  buttonText?: string;
  buttonLink?: string;
  openInNewTab?: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type SlideFormData = Omit<HeroSlide, '_id' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: SlideFormData = {
  title: '',
  subtitle: '',
  description: '',
  desktopImage: '',
  mobileImage: '',
  accent: '#b8c9d4',
  accentGlow: '#5a8fa8',
  buttonText: '',
  buttonLink: '',
  openInNewTab: false,
  displayOrder: 0,
  isActive: true,
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border
      ${type === 'success'
        ? 'bg-white border-[#9ab87a]/40 text-[#3a6020]'
        : 'bg-white border-[#c97a7a]/40 text-[#8a2020]'}`}>
      {type === 'success'
        ? <CheckCircle2 size={16} strokeWidth={2} className="text-[#9ab87a]" />
        : <AlertCircle size={16} strokeWidth={2} className="text-[#c97a7a]" />
      }
      <span className="text-[0.8rem] font-medium">{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Image Upload field ────────────────────────────────────────────────────────
function ImageUploadField({
  label, icon: Icon, value, onChange, token,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (url: string) => void;
  token: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10 MB');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Must use plain fetch — useAuthFetch injects "Content-Type: application/json"
      // which overwrites the browser-generated "multipart/form-data; boundary=…" header.
      const res = await fetch('/api/admin/hero-slides/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Upload failed');
      onChange(json.data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.72rem] font-semibold tracking-wide text-[#6b6560] uppercase flex items-center gap-2">
        <Icon size={12} strokeWidth={2} />
        {label}
      </label>

      {/* Preview */}
      {value && (
        <div className="relative w-full rounded-lg overflow-hidden border border-[#e2ddd5] bg-[#f5f3ef]"
          style={{ aspectRatio: '16/6' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#0f0e0c]/70 flex items-center justify-center text-white hover:bg-[#c97a7a] transition-colors"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* URL input */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste image URL or upload below…"
        className="w-full px-3 py-2 text-[0.78rem] border border-[#e2ddd5] rounded-lg bg-[#faf9f6]
          focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/20 transition-all
          placeholder:text-[#c4bdb2]"
      />

      {/* Upload button */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-1.5 text-[0.72rem] font-medium rounded-lg border
            border-[#e2ddd5] bg-white text-[#6b6560] hover:border-[#c9a84c]/50 hover:text-[#8a6e2a]
            disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Upload size={12} strokeWidth={2} />
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
        {uploadError && (
          <span className="text-[0.68rem] text-[#c97a7a]">{uploadError}</span>
        )}
      </div>
    </div>
  );
}

// ── Slide form modal ──────────────────────────────────────────────────────────
function SlideModal({
  initial,
  onSave,
  onClose,
  token,
}: {
  initial?: HeroSlide;
  onSave: (data: SlideFormData) => Promise<void>;
  onClose: () => void;
  token: string | null;
}) {
  const [form, setForm] = useState<SlideFormData>(
    initial
      ? {
          title: initial.title,
          subtitle: initial.subtitle || '',
          description: initial.description || '',
          desktopImage: initial.desktopImage,
          mobileImage: initial.mobileImage || '',
          accent: initial.accent || '#b8c9d4',
          accentGlow: initial.accentGlow || '#5a8fa8',
          buttonText: initial.buttonText || '',
          buttonLink: initial.buttonLink || '',
          openInNewTab: initial.openInNewTab || false,
          displayOrder: initial.displayOrder,
          isActive: initial.isActive,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof SlideFormData>(key: K, val: SlideFormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const { [key]: _, ...rest } = e; return rest; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.desktopImage.trim()) errs.desktopImage = 'Desktop image is required';
    if (form.buttonLink) {
      const lower = form.buttonLink.trim().toLowerCase();
      if (lower.startsWith('javascript:')) errs.buttonLink = 'Invalid URL';
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full px-3 py-2 text-[0.78rem] border rounded-lg bg-[#faf9f6]
    focus:outline-none focus:ring-1 transition-all placeholder:text-[#c4bdb2]
    ${errors[field]
      ? 'border-[#c97a7a] focus:border-[#c97a7a] focus:ring-[#c97a7a]/20'
      : 'border-[#e2ddd5] focus:border-[#c9a84c]/60 focus:ring-[#c9a84c]/20'}`;

  const labelCls = 'text-[0.72rem] font-semibold tracking-wide text-[#6b6560] uppercase';
  const errCls = 'text-[0.66rem] text-[#c97a7a] mt-0.5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,14,12,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ede9e1]">
          <div>
            <h2 className="font-['Cormorant_Garamond',serif] text-[1.4rem] font-medium text-[#1a1714]">
              {initial ? 'Edit Slide' : 'New Slide'}
            </h2>
            <p className="text-[0.68rem] text-[#a09a90] tracking-wide mt-0.5">
              {initial ? `Editing: ${initial.title}` : 'Add a new hero carousel slide'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b6560] hover:bg-[#f5f3ef] transition-colors">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Title <span className="text-[#c97a7a]">*</span></label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Alpha Color Diamonds" className={inputCls('title')} />
            {errors.title && <p className={errCls}>{errors.title}</p>}
          </div>

          {/* Subtitle / eyebrow */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Subtitle / Eyebrow</label>
            <input type="text" value={form.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)}
              placeholder="e.g. Exclusive Offer" className={inputCls('subtitle')} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Description</label>
            <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)}
              placeholder="Optional short description shown below the title…"
              rows={3}
              className={`${inputCls('description')} resize-none`} />
          </div>

          {/* Desktop image */}
          <ImageUploadField
            label="Desktop Banner Image *"
            icon={Monitor}
            value={form.desktopImage}
            onChange={(url) => set('desktopImage', url)}
            token={token}
          />
          {errors.desktopImage && <p className={`${errCls} -mt-4`}>{errors.desktopImage}</p>}

          {/* Mobile image */}
          <ImageUploadField
            label="Mobile Banner Image (optional)"
            icon={Smartphone}
            value={form.mobileImage || ''}
            onChange={(url) => set('mobileImage', url)}
            token={token}
          />

          {/* Accent colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Accent Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent || '#b8c9d4'}
                  onChange={(e) => set('accent', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[#e2ddd5] cursor-pointer p-0.5 bg-white" />
                <input type="text" value={form.accent || ''} onChange={(e) => set('accent', e.target.value)}
                  className={`flex-1 ${inputCls('accent')}`} placeholder="#b8c9d4" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Glow Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accentGlow || '#5a8fa8'}
                  onChange={(e) => set('accentGlow', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[#e2ddd5] cursor-pointer p-0.5 bg-white" />
                <input type="text" value={form.accentGlow || ''} onChange={(e) => set('accentGlow', e.target.value)}
                  className={`flex-1 ${inputCls('accentGlow')}`} placeholder="#5a8fa8" />
              </div>
            </div>
          </div>

          {/* Button text + link */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Button Text</label>
              <input type="text" value={form.buttonText || ''} onChange={(e) => set('buttonText', e.target.value)}
                placeholder="e.g. Shop Now" className={inputCls('buttonText')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Button Link</label>
              <input type="text" value={form.buttonLink || ''} onChange={(e) => set('buttonLink', e.target.value)}
                placeholder="/products or https://…" className={inputCls('buttonLink')} />
              {errors.buttonLink && <p className={errCls}>{errors.buttonLink}</p>}
            </div>
          </div>

          {/* Open in new tab */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => set('openInNewTab', !form.openInNewTab)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex items-center flex-shrink-0
                ${form.openInNewTab ? 'bg-[#c9a84c]' : 'bg-[#d4cfc8]'}`}
            >
              <span className={`absolute w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200
                ${form.openInNewTab ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </div>
            <span className="text-[0.78rem] text-[#6b6560] group-hover:text-[#1a1714] transition-colors">
              Open button link in new tab
            </span>
            {form.openInNewTab && <ExternalLink size={12} strokeWidth={2} className="text-[#c9a84c]" />}
          </label>

          {/* Display order + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Display Order</label>
              <input type="number" min={0} value={form.displayOrder}
                onChange={(e) => set('displayOrder', parseInt(e.target.value, 10) || 0)}
                className={inputCls('displayOrder')} />
              <p className="text-[0.65rem] text-[#a09a90]">Lower = shown first</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Status</label>
              <div
                onClick={() => set('isActive', !form.isActive)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all
                  ${form.isActive
                    ? 'bg-[#9ab87a]/10 border-[#9ab87a]/40 text-[#3a6020]'
                    : 'bg-[#f5f3ef] border-[#e2ddd5] text-[#a09a90]'}`}
              >
                {form.isActive
                  ? <Eye size={14} strokeWidth={2} className="text-[#9ab87a]" />
                  : <EyeOff size={14} strokeWidth={2} />}
                <span className="text-[0.78rem] font-medium">
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#ede9e1] flex items-center justify-end gap-3 bg-[#faf9f7]">
          <button onClick={onClose}
            className="px-4 py-2 text-[0.78rem] font-medium text-[#6b6560] border border-[#e2ddd5] rounded-lg hover:border-[#c9a84c]/50 hover:text-[#1a1714] transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-[0.78rem] font-semibold text-white rounded-lg
              bg-[#1a1714] hover:bg-[#c9a84c] disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200"
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Slide'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────
function DeleteConfirm({ title, onConfirm, onCancel }: {
  title: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,14,12,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c97a7a]/10 border border-[#c97a7a]/20 flex items-center justify-center shrink-0">
            <Trash2 size={16} strokeWidth={1.8} className="text-[#c97a7a]" />
          </div>
          <div>
            <h3 className="text-[0.9rem] font-semibold text-[#1a1714]">Delete slide?</h3>
            <p className="text-[0.75rem] text-[#a09a90] mt-1">
              "<span className="font-medium text-[#6b6560]">{title}</span>" will be permanently deleted.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-[0.75rem] font-medium border border-[#e2ddd5] rounded-lg text-[#6b6560] hover:border-[#c9a84c]/40 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-[0.75rem] font-semibold rounded-lg bg-[#c97a7a] text-white hover:bg-[#b56666] transition-all">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slide card ────────────────────────────────────────────────────────────────
function SlideCard({
  slide,
  index,
  total,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  slide: HeroSlide;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const accent = slide.accent || '#b8c9d4';

  return (
    <div className={`group relative bg-white border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]
      ${slide.isActive ? 'border-[#ede9e1]' : 'border-dashed border-[#d4cfc8] opacity-75'}`}>

      {/* Colour accent strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

      <div className="flex">
        {/* Drag handle / order controls */}
        <div className="w-10 shrink-0 flex flex-col items-center justify-center gap-1 py-4 bg-[#faf9f7] border-r border-[#f0ece4]">
          <GripVertical size={14} strokeWidth={1.5} className="text-[#c4bdb2] mb-1" />
          <button onClick={onMoveUp} disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center rounded text-[#a09a90] hover:bg-[#f0ece4] hover:text-[#1a1714] disabled:opacity-20 transition-all">
            <ChevronUp size={12} strokeWidth={2} />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center rounded text-[#a09a90] hover:bg-[#f0ece4] hover:text-[#1a1714] disabled:opacity-20 transition-all">
            <ChevronDown size={12} strokeWidth={2} />
          </button>
        </div>

        {/* Thumbnail */}
        <div className="w-32 sm:w-40 shrink-0 relative overflow-hidden bg-[#0f0e0c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.desktopImage}
            alt={slide.title}
            className="w-full h-full object-cover"
            style={{ minHeight: 100 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
            }}
          />
          {/* Order badge */}
          <div className="absolute top-2 left-2 text-[0.6rem] font-bold tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `${accent}cc`, color: '#fff' }}>
            #{slide.displayOrder}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
          <div>
            {slide.subtitle && (
              <p className="text-[0.64rem] tracking-widest uppercase font-semibold mb-1" style={{ color: accent }}>
                {slide.subtitle}
              </p>
            )}
            <h3 className="font-['Cormorant_Garamond',serif] text-[1.05rem] font-medium text-[#1a1714] truncate">
              {slide.title}
            </h3>
            {slide.description && (
              <p className="text-[0.7rem] text-[#a09a90] mt-0.5 line-clamp-1">{slide.description}</p>
            )}
            {slide.buttonText && slide.buttonLink && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[0.65rem] px-2 py-0.5 rounded bg-[#f0ece4] text-[#6b6560] font-medium">
                  {slide.buttonText}
                </span>
                <span className="text-[0.62rem] text-[#c4bdb2] truncate max-w-[140px]">
                  → {slide.buttonLink}
                </span>
                {slide.openInNewTab && <ExternalLink size={10} strokeWidth={2} className="text-[#c4bdb2] shrink-0" />}
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {slide.mobileImage && (
              <span className="inline-flex items-center gap-1 text-[0.62rem] text-[#a09a90] border border-[#e2ddd5] px-1.5 py-0.5 rounded">
                <Smartphone size={9} strokeWidth={2} /> Mobile img
              </span>
            )}
            <span className="text-[0.62rem] text-[#c4bdb2]">
              Updated {new Date(slide.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col items-end gap-2 px-4 py-3">
          {/* Status toggle */}
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.65rem] font-semibold tracking-wide transition-all
              ${slide.isActive
                ? 'bg-[#9ab87a]/12 text-[#3a6020] border border-[#9ab87a]/30 hover:bg-[#c97a7a]/10 hover:text-[#8a2020] hover:border-[#c97a7a]/30'
                : 'bg-[#f5f3ef] text-[#a09a90] border border-[#e2ddd5] hover:bg-[#9ab87a]/10 hover:text-[#3a6020] hover:border-[#9ab87a]/30'}`}
          >
            {slide.isActive ? <Eye size={10} strokeWidth={2} /> : <EyeOff size={10} strokeWidth={2} />}
            {slide.isActive ? 'Active' : 'Inactive'}
          </button>

          {/* Edit */}
          <button onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6b6560] border border-[#e2ddd5] hover:border-[#c9a84c]/50 hover:text-[#8a6e2a] hover:bg-[#faf3e0] transition-all">
            <Pencil size={13} strokeWidth={1.8} />
          </button>

          {/* Delete */}
          <button onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6b6560] border border-[#e2ddd5] hover:border-[#c97a7a]/50 hover:text-[#c97a7a] hover:bg-[#fdf0f0] transition-all">
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HeroSlidesAdminPage() {
  const { token, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  // null = modal closed | { mode:'new' } = creating | { mode:'edit', slide } = editing
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<{ mode: 'new' } | { mode: 'edit'; slide: HeroSlide } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HeroSlide | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Close modal on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditTarget(null); setDeleteTarget(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  }, []);

  // ── Fetch all slides ────────────────────────────────────────────────────────
  const fetchSlides = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/admin/hero-slides');
      const json = await res.json();
      if (json.success) setSlides(json.data);
    } catch {
      showToast('Failed to load slides', 'error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, token, showToast]);

  useEffect(() => {
    if (!authLoading && token) fetchSlides();
  }, [authLoading, token, fetchSlides]);

  // ── Create / Update ─────────────────────────────────────────────────────────
  const handleSave = async (data: SlideFormData) => {
    try {
      if (editTarget?.mode === 'new') {
        const res = await authFetch('/api/admin/hero-slides', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Failed to create slide');
        showToast('Slide created');
      } else if (editTarget?.mode === 'edit') {
        const res = await authFetch(`/api/admin/hero-slides/${editTarget.slide._id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Failed to update slide');
        showToast('Slide updated');
      }
      setEditTarget(null);
      fetchSlides();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
      throw err; // keep modal open
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await authFetch(`/api/admin/hero-slides/${deleteTarget._id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Delete failed');
      showToast('Slide deleted');
      setDeleteTarget(null);
      fetchSlides();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const handleToggle = async (slide: HeroSlide) => {
    try {
      const res = await authFetch(`/api/admin/hero-slides/${slide._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showToast(slide.isActive ? 'Slide deactivated' : 'Slide activated');
      fetchSlides();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // ── Reorder (up/down) ───────────────────────────────────────────────────────
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= slides.length) return;

    const updated = [...slides];
    // Swap display orders
    const orderA = updated[index].displayOrder;
    const orderB = updated[swapIndex].displayOrder;
    updated[index] = { ...updated[index], displayOrder: orderB };
    updated[swapIndex] = { ...updated[swapIndex], displayOrder: orderA };
    // Swap array positions
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setSlides(updated);

    try {
      await authFetch('/api/admin/hero-slides/reorder', {
        method: 'POST',
        body: JSON.stringify({
          order: updated.map((s, i) => ({ id: s._id, displayOrder: i })),
        }),
      });
      fetchSlides();
    } catch {
      showToast('Failed to reorder', 'error');
      fetchSlides(); // restore
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white border border-[#ede9e1] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[0.68rem] tracking-[0.22em] uppercase text-[#c9a84c] font-semibold mb-2">
              ◆ Alpha Imports
            </p>
            <h1 className="font-['Cormorant_Garamond',serif] text-[2.4rem] font-medium text-[#1a1714] tracking-tight leading-none">
              Hero Carousel
            </h1>
            <p className="text-[0.75rem] text-[#a09a90] mt-1.5">
              Manage homepage hero banner slides — images, text, buttons, and ordering.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-[0.75rem] font-medium border border-[#e2ddd5] rounded-lg text-[#6b6560] hover:border-[#c9a84c]/50 hover:text-[#8a6e2a] transition-all"
            >
              <ExternalLink size={13} strokeWidth={1.8} />
              Preview site
            </a>
            <button
              onClick={() => setEditTarget({ mode: 'new' })}
              className="flex items-center gap-2 px-4 py-2 text-[0.78rem] font-semibold text-white bg-[#1a1714] rounded-lg hover:bg-[#c9a84c] transition-all duration-200"
            >
              <Plus size={14} strokeWidth={2} />
              New Slide
            </button>
          </div>
        </div>
        <div className="mt-5 h-px bg-gradient-to-r from-[#c9a84c]/30 via-[#ede9e1] to-transparent" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Slides', value: slides.length, accent: '#c9a84c' },
          { label: 'Active', value: slides.filter(s => s.isActive).length, accent: '#9ab87a' },
          { label: 'Inactive', value: slides.filter(s => !s.isActive).length, accent: '#a09a90' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-white border border-[#ede9e1] rounded-xl px-4 py-3">
            <div className="font-['Cormorant_Garamond',serif] text-[1.8rem] font-medium leading-none" style={{ color: accent }}>
              {value}
            </div>
            <div className="text-[0.65rem] text-[#a09a90] uppercase tracking-wider font-semibold mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Slides list */}
      {slides.length === 0 ? (
        <div className="bg-white border border-dashed border-[#d4cfc8] rounded-2xl flex flex-col items-center justify-center py-20 text-center gap-3">
          <LayoutDashboard size={32} strokeWidth={1} className="text-[#d4cfc8]" />
          <p className="text-[0.85rem] font-medium text-[#b0a898]">No slides yet</p>
          <p className="text-[0.72rem] text-[#c4bdb2]">Create your first hero carousel slide to get started</p>
          <button
            onClick={() => setEditTarget({ mode: 'new' })}
            className="mt-2 flex items-center gap-2 px-4 py-2 text-[0.75rem] font-semibold text-white bg-[#1a1714] rounded-lg hover:bg-[#c9a84c] transition-all"
          >
            <Plus size={13} strokeWidth={2} />
            Create First Slide
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slides.map((slide, i) => (
            <SlideCard
              key={slide._id}
              slide={slide}
              index={i}
              total={slides.length}
              onEdit={() => setEditTarget({ mode: 'edit', slide })}
              onDelete={() => setDeleteTarget(slide)}
              onToggle={() => handleToggle(slide)}
              onMoveUp={() => handleMove(i, 'up')}
              onMoveDown={() => handleMove(i, 'down')}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editTarget !== null && (
        <SlideModal
          initial={editTarget.mode === 'edit' ? editTarget.slide : undefined}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
          token={token}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          title={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}