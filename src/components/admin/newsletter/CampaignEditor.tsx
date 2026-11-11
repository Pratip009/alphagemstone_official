'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  X, Loader2, Image as ImageIcon, Monitor, Smartphone, Send, Check,
  UserRound, Eye, PencilLine,
} from 'lucide-react';
import ProductPicker from './ProductPicker';
import {
  Accent, Audience, AudienceSummary, AUDIENCE_LABELS, CampaignFormData, HeaderStyle, audienceQuery,
} from './types';

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-[#ede9e1] rounded-xl bg-white min-h-[280px] flex items-center justify-center">
      <Loader2 size={20} className="text-[#c9a84c] animate-spin" />
    </div>
  ),
});

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'gold', label: 'Gold', color: '#C9A84C' },
  { key: 'sapphire', label: 'Sapphire', color: '#1B3A6B' },
  { key: 'emerald', label: 'Emerald', color: '#1B4D3E' },
  { key: 'ruby', label: 'Ruby', color: '#7A1F2B' },
];

const HEADERS: { key: HeaderStyle; label: string; bg: string; fg: string }[] = [
  { key: 'onyx', label: 'Onyx', bg: '#0E0D0B', fg: '#FFFFFF' },
  { key: 'ivory', label: 'Ivory', bg: '#F0EADF', fg: '#1A1714' },
];

// ─── Small form primitives ────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="py-6 border-b border-[#f0ece4] last:border-b-0">
      <h3 className="font-['Cormorant_Garamond',serif] text-[1.2rem] font-semibold text-[#1a1714] leading-tight">{title}</h3>
      {hint && <p className="text-[0.72rem] text-[#a09a90] mt-0.5 mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, error, counter, help, children,
}: { label: string; error?: string; counter?: { n: number; max: number; ideal?: [number, number] }; help?: React.ReactNode; children: React.ReactNode }) {
  let counterColor = '#a09a90';
  if (counter?.ideal && counter.n > 0) {
    counterColor = counter.n >= counter.ideal[0] && counter.n <= counter.ideal[1] ? '#15803d' : '#b45309';
  }
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[0.75rem] font-semibold text-[#4a4540]">{label}</label>
        {counter && <span className="text-[0.67rem] tabular-nums" style={{ color: counterColor }}>{counter.n}/{counter.max}</span>}
      </div>
      {children}
      {help && !error && <p className="mt-1 text-[0.68rem] text-[#a09a90] leading-relaxed">{help}</p>}
      {error && <p className="mt-1 text-[0.68rem] text-red-500">{error}</p>}
    </div>
  );
}

const inputCls = (err?: boolean) =>
  `w-full px-3.5 py-2.5 text-[0.84rem] rounded-lg outline-none transition-colors bg-[#fafaf9] focus:bg-white border-[1.5px] ${
    err ? 'border-red-400' : 'border-[#e4e4e7] focus:border-[#c9a84c]'
  }`;

// ─── Editor ───────────────────────────────────────────────────────────────────

export default function CampaignEditor({
  mode,
  initial,
  adminEmail,
  adminName,
  authFetch,
  onSave,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial: CampaignFormData;
  adminEmail?: string;
  adminName?: string;
  authFetch: AuthFetch;
  onSave: (data: CampaignFormData) => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CampaignFormData>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignFormData, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  // preview
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewAs, setPreviewAs] = useState<'website' | 'user' | 'legacy'>('website');
  const [iframeHeight, setIframeHeight] = useState(900);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');

  // audience
  const [sourceCounts, setSourceCounts] = useState<AudienceSummary | null>(null);
  const [selection, setSelection] = useState<AudienceSummary | null>(null);

  // test send
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState(adminEmail ?? '');
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const update = <K extends keyof CampaignFormData>(key: K, val: CampaignFormData[K]) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: undefined }));
    setDirty(true);
  };

  // ── Live preview (debounced, rendered by the same server code that sends) ──
  useEffect(() => {
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await authFetch('/api/admin/newsletter/preview', {
          method: 'POST',
          body: JSON.stringify({
            campaign: {
              ...form,
              title: form.title || 'Your headline appears here',
              message: form.message && form.message !== '<p></p>' ? form.message : '<p>Start writing your message on the left — this preview updates as you type.</p>',
            },
            recipient: { name: adminName || 'Sarah Collins', source: previewAs },
          }),
        });
        const d = await res.json();
        if (d.success) setPreviewHtml(d.data.html);
      } finally {
        setPreviewLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [form, previewAs, adminName, authFetch]);

  const syncIframeHeight = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) setIframeHeight(Math.max(600, doc.documentElement.scrollHeight));
  }, []);
  useEffect(() => { const t = setTimeout(syncIframeHeight, 120); return () => clearTimeout(t); }, [previewHtml, device, syncIframeHeight]);

  // ── Audience counts ──
  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/admin/newsletter/audience?subscribers=1&users=1&legacy=1`);
      const d = await res.json();
      if (d.success) setSourceCounts(d.data);
    })();
  }, [authFetch]);

  useEffect(() => {
    const a = form.audience;
    if (!a.subscribers && !a.users && !a.legacy) { setSelection(null); return; }
    let cancelled = false;
    (async () => {
      const res = await authFetch(`/api/admin/newsletter/audience?${audienceQuery(a)}`);
      const d = await res.json();
      if (!cancelled && d.success) setSelection(d.data);
    })();
    return () => { cancelled = true; };
  }, [form.audience, authFetch]);

  // ── Close guard ──
  const requestClose = () => {
    if (dirty && !confirm('Discard your unsaved changes?')) return;
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !testOpen) requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Uploads ──
  const uploadFile = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return ''; }
    const fd = new FormData();
    fd.append('files', file);
    const res = await authFetch('/api/admin/upload', { method: 'POST', headers: {}, body: fd });
    const d = await res.json();
    if (!d.success) { alert(d.message ?? 'Upload failed'); return ''; }
    return d.urls[0];
  };
  const uploadBanner = async (file: File) => {
    setUploading(true);
    try { const url = await uploadFile(file); if (url) update('image', url); }
    finally { setUploading(false); }
  };

  const insertFirstNameInSubject = () => {
    const el = subjectRef.current;
    const tag = '{{first_name}}';
    const pos = el?.selectionStart ?? form.subject.length;
    update('subject', form.subject.slice(0, pos) + tag + form.subject.slice(pos));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + tag.length, pos + tag.length); });
  };

  const toggleAudience = (key: keyof Audience) => {
    update('audience', { ...form.audience, [key]: !form.audience[key] });
  };

  // ── Validation / actions ──
  const validate = () => {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = 'Add a headline';
    if (!form.subject.trim()) e.subject = 'Add a subject line';
    if (!form.message.trim() || form.message === '<p></p>') e.message = 'Write a message';
    if (!form.audience.subscribers && !form.audience.users && !form.audience.legacy) e.audience = 'Choose at least one audience';
    if (form.promoText && !form.promoCode) e.promoCode = 'Add the code this offer refers to';
    setErrors(e);
    if (Object.keys(e).length) setMobilePane('edit');
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const ok = await onSave(form);
      if (ok) setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!validate()) { setTestOpen(false); return; }
    setTestState('sending');
    setTestError('');
    try {
      const res = await authFetch('/api/admin/newsletter/test', {
        method: 'POST',
        body: JSON.stringify({ campaign: form, to: testTo.trim(), name: adminName }),
      });
      const d = await res.json();
      if (d.success) { setTestState('sent'); setTimeout(() => setTestState('idle'), 4000); }
      else { setTestState('error'); setTestError(d.message ?? 'Test email failed'); }
    } catch {
      setTestState('error');
      setTestError('Network error — check your connection and try again');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-[#f6f4f0] flex flex-col" role="dialog" aria-modal="true" aria-label={mode === 'edit' ? 'Edit campaign' : 'New campaign'}>
      {/* Top bar */}
      <header className="h-16 shrink-0 bg-white border-b border-[#ede9e1] flex items-center gap-3 px-4 sm:px-6">
        <button onClick={requestClose} aria-label="Close editor"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec]"><X size={18} /></button>
        <div className="min-w-0 flex-1">
          <h2 className="font-['Cormorant_Garamond',serif] text-[1.35rem] font-semibold text-[#1a1714] leading-none truncate">
            {form.title || (mode === 'edit' ? 'Edit campaign' : 'New campaign')}
          </h2>
          <p className="text-[0.68rem] text-[#a09a90] mt-1">{dirty ? 'Unsaved changes' : mode === 'edit' ? 'Draft saved' : 'Not saved yet'}</p>
        </div>

        {/* Mobile edit/preview switch */}
        <div className="flex lg:hidden bg-[#f4f1ec] p-0.5 rounded-lg">
          {(['edit', 'preview'] as const).map(p => (
            <button key={p} onClick={() => setMobilePane(p)} aria-pressed={mobilePane === p}
              className={`px-2.5 py-1.5 rounded-md text-[0.72rem] font-semibold flex items-center gap-1 ${mobilePane === p ? 'bg-white text-[#1a1714] shadow-sm' : 'text-[#a09a90]'}`}>
              {p === 'edit' ? <PencilLine size={13} /> : <Eye size={13} />}
              <span className="hidden sm:inline capitalize">{p}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <button onClick={() => setTestOpen(o => !o)} aria-expanded={testOpen}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#374151] border border-[#e4e4e7] bg-white hover:bg-[#f8f8f7]">
            <Send size={14} /> <span className="hidden sm:inline">Send test</span>
          </button>
          {testOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-[#ede9e1] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] p-4 z-10">
              <p className="text-[0.78rem] font-semibold text-[#1a1714] mb-1">Send a test email</p>
              <p className="text-[0.7rem] text-[#a09a90] mb-3">See exactly what customers get, in a real inbox. The subject is marked [Test].</p>
              <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@alphagemstone.com"
                className={inputCls()} onKeyDown={e => { if (e.key === 'Enter') sendTest(); }} />
              {testState === 'error' && <p className="mt-2 text-[0.7rem] text-red-500">{testError}</p>}
              {testState === 'sent' && <p className="mt-2 text-[0.7rem] text-green-700 flex items-center gap-1"><Check size={12} /> Test sent to {testTo}</p>}
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setTestOpen(false)} className="px-3 py-2 rounded-lg text-[0.75rem] font-semibold text-[#64748b] hover:bg-[#f4f1ec]">Close</button>
                <button onClick={sendTest} disabled={testState === 'sending' || !testTo}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.75rem] font-semibold text-white bg-[#0f172a] disabled:opacity-50">
                  {testState === 'sending' && <Loader2 size={13} className="animate-spin" />} Send test
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-white bg-[#0f172a] hover:opacity-90 disabled:opacity-60">
          {saving && <Loader2 size={14} className="animate-spin" />} Save draft
        </button>
      </header>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(420px,520px)_1fr]">
        {/* ── Form column ── */}
        <div className={`min-h-0 overflow-y-auto bg-white border-r border-[#ede9e1] ${mobilePane === 'preview' ? 'hidden lg:block' : ''}`}>
          <div className="px-5 sm:px-7 pb-16">

            <Section title="Inbox" hint="What people see before they open the email.">
              <Field label="Subject line" error={errors.subject} counter={{ n: form.subject.length, max: 300, ideal: [20, 60] }}
                help={<>Around 30–60 characters reads best on phones. <button type="button" onClick={insertFirstNameInSubject} className="text-[#8a6e2a] underline">Add first name</button></>}>
                <input ref={subjectRef} value={form.subject} onChange={e => update('subject', e.target.value)} maxLength={300}
                  placeholder="New arrivals: Ceylon sapphires, hand-selected" className={inputCls(!!errors.subject)} />
              </Field>
              <Field label="Preview text" counter={{ n: form.preheader.length, max: 200, ideal: [40, 130] }}
                help="The grey line shown after the subject in most inboxes. Leave empty and mail apps pull the first words of the email instead.">
                <input value={form.preheader} onChange={e => update('preheader', e.target.value)} maxLength={200}
                  placeholder="Twelve stones, one week only — see them before they’re gone." className={inputCls()} />
              </Field>
            </Section>

            <Section title="Header" hint="The top of the email: banner, headline and colours.">
              <Field label="Headline" error={errors.title} counter={{ n: form.title.length, max: 200 }}
                help="Shown large at the top of the email, and used as this campaign’s name in your list.">
                <input value={form.title} onChange={e => update('title', e.target.value)} maxLength={200}
                  placeholder="The Autumn Sapphire Edit" className={inputCls(!!errors.title)} />
              </Field>
              <Field label="Sub-headline (optional)" counter={{ n: form.subtitle.length, max: 300 }}>
                <input value={form.subtitle} onChange={e => update('subtitle', e.target.value)} maxLength={300}
                  placeholder="Deep cornflower blues from Sri Lanka, each with a lab report." className={inputCls()} />
              </Field>

              <Field label="Banner image (optional)" help="Wide images work best — about 1280 × 640 px. Clicking it opens the button link.">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ''; }} />
                {form.image ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#ede9e1]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image} alt="Banner" className="w-full max-h-44 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button type="button" onClick={() => imageInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-md bg-white/90 text-[0.7rem] font-semibold text-[#1a1714] hover:bg-white">Replace</button>
                      <button type="button" onClick={() => update('image', '')}
                        className="px-2.5 py-1 rounded-md bg-white/90 text-[0.7rem] font-semibold text-red-600 hover:bg-white">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}
                    className="w-full py-7 rounded-xl border-2 border-dashed border-[#e4e4e7] flex flex-col items-center gap-2 text-[#a09a90] hover:border-[#c9a84c] hover:text-[#8a6e2a] transition-colors">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} strokeWidth={1.5} />}
                    <span className="text-[0.72rem] font-medium">{uploading ? 'Uploading…' : 'Upload a banner image'}</span>
                  </button>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Header style">
                  <div className="flex gap-2">
                    {HEADERS.map(h => (
                      <button key={h.key} type="button" onClick={() => update('headerStyle', h.key)} aria-pressed={form.headerStyle === h.key}
                        className={`flex-1 rounded-lg border-[1.5px] p-1.5 text-left transition-colors ${form.headerStyle === h.key ? 'border-[#c9a84c]' : 'border-[#e4e4e7] hover:border-[#d4cfc6]'}`}>
                        <div className="h-8 rounded-md flex items-center justify-center font-['Cormorant_Garamond',serif] text-[0.95rem]" style={{ background: h.bg, color: h.fg }}>Aa</div>
                        <p className="text-[0.7rem] font-medium text-[#4a4540] mt-1 px-0.5">{h.label}</p>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Accent stone">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ACCENTS.map(a => (
                      <button key={a.key} type="button" onClick={() => update('accent', a.key)} aria-pressed={form.accent === a.key} title={a.label}
                        className={`w-9 h-9 rounded-full flex items-center justify-center ring-offset-2 transition-shadow ${form.accent === a.key ? 'ring-2 ring-[#1a1714]' : 'hover:ring-2 hover:ring-[#d4cfc6]'}`}
                        style={{ background: a.color }}>
                        {form.accent === a.key && <Check size={14} className="text-white" />}
                        <span className="sr-only">{a.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.68rem] text-[#a09a90] mt-1.5">{ACCENTS.find(a => a.key === form.accent)?.label} — used for the button, links and divider.</p>
                </Field>
              </div>
            </Section>

            <Section title="Message">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.greeting} onChange={e => update('greeting', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#c9a84c]" />
                <span>
                  <span className="block text-[0.8rem] font-medium text-[#1a1714]">Start with a personal greeting</span>
                  <span className="block text-[0.7rem] text-[#a09a90]">“Dear Sarah,” using each person’s first name, or “Hello,” when we don’t have one.</span>
                </span>
              </label>
              <Field label="Body" error={errors.message}
                help={<>Type <code className="px-1 bg-[#f4f1ec] rounded">{'{{first_name}}'}</code> anywhere to insert the reader’s first name. Images you add here are uploaded to your media library.</>}>
                <RichTextEditor
                  value={form.message}
                  onChange={val => update('message', val)}
                  placeholder="Tell your customers what’s new…"
                  onImageUpload={uploadFile}
                  error={!!errors.message}
                />
              </Field>
            </Section>

            <Section title="Button" hint="One clear next step. Leave the text empty to hide the button.">
              <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                <Field label="Button text">
                  <input value={form.ctaText} onChange={e => update('ctaText', e.target.value)} maxLength={60} placeholder="Shop the Collection" className={inputCls()} />
                </Field>
                <Field label="Button link">
                  <input value={form.ctaUrl} onChange={e => update('ctaUrl', e.target.value)} maxLength={500} placeholder="/products/gemstones" className={inputCls()} />
                </Field>
              </div>
              <p className="text-[0.68rem] text-[#a09a90] -mt-2">Links starting with “/” point to your store. Empty means all products.</p>
            </Section>

            <Section title="Promo code" hint="Optional. Shown as a ticket under the message.">
              <div className="grid grid-cols-[0.8fr_1.6fr] gap-3">
                <Field label="Code" error={errors.promoCode}>
                  <input value={form.promoCode} onChange={e => update('promoCode', e.target.value.toUpperCase().replace(/\s/g, ''))} maxLength={40}
                    placeholder="SAPPHIRE15" className={`${inputCls(!!errors.promoCode)} font-mono tracking-wider`} />
                </Field>
                <Field label="Offer line">
                  <input value={form.promoText} onChange={e => update('promoText', e.target.value)} maxLength={200}
                    placeholder="15% off any sapphire until Sunday" className={inputCls()} />
                </Field>
              </div>
              <p className="text-[0.68rem] text-[#a09a90] -mt-2">Create the code under Coupons first — this only displays it.</p>
            </Section>

            <Section title="Featured products" hint="Up to six pieces shown as a grid with photo, price and link. Prices refresh automatically when you send.">
              <Field label="Section heading">
                <input value={form.productsHeading} onChange={e => update('productsHeading', e.target.value)} maxLength={120}
                  placeholder="Hand-picked for you" className={inputCls()} />
              </Field>
              <ProductPicker value={form.products} onChange={v => update('products', v)} authFetch={authFetch} />
            </Section>

            <Section title="Audience" hint="Who receives this campaign. Anyone on more than one list gets it once, and people who unsubscribed are always skipped.">
              <div className="space-y-2">
                {(Object.keys(AUDIENCE_LABELS) as (keyof Audience)[]).map(key => {
                  const on = form.audience[key];
                  const n = sourceCounts?.[key];
                  return (
                    <label key={key}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border-[1.5px] cursor-pointer transition-colors ${on ? 'border-[#c9a84c] bg-[#fdfaf2]' : 'border-[#e4e4e7] hover:border-[#d4cfc6]'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleAudience(key)} className="w-4 h-4 accent-[#c9a84c]" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[0.8rem] font-medium text-[#1a1714]">{AUDIENCE_LABELS[key].label}</span>
                        <span className="block text-[0.7rem] text-[#a09a90]">{AUDIENCE_LABELS[key].help}</span>
                      </span>
                      <span className="text-[0.8rem] font-semibold tabular-nums text-[#4a4540]">{n === undefined ? '…' : n.toLocaleString()}</span>
                    </label>
                  );
                })}
              </div>
              {errors.audience && <p className="text-[0.7rem] text-red-500">{errors.audience}</p>}
              {selection && (
                <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-[#0f172a] text-white">
                  <UserRound size={15} className="text-[#c9a84c]" />
                  <p className="text-[0.78rem]">
                    Reaches <strong className="font-semibold tabular-nums">{selection.total.toLocaleString()}</strong> unique {selection.total === 1 ? 'person' : 'people'}
                    {selection.suppressed > 0 && <span className="text-white/60"> · {selection.suppressed.toLocaleString()} unsubscribed skipped</span>}
                  </p>
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* ── Preview column ── */}
        <div className={`min-h-0 overflow-y-auto ${mobilePane === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="sticky top-0 z-[1] bg-[#f6f4f0]/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center gap-3 border-b border-[#ede9e1]">
            <div className="flex bg-white border border-[#ede9e1] p-0.5 rounded-lg">
              {([['desktop', Monitor], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
                <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} title={d === 'desktop' ? 'Desktop width' : 'Phone width'}
                  className={`w-8 h-7 rounded-md flex items-center justify-center ${device === d ? 'bg-[#0f172a] text-white' : 'text-[#a09a90] hover:text-[#1a1714]'}`}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[0.72rem] text-[#a09a90]">
              Preview as
              <select value={previewAs} onChange={e => setPreviewAs(e.target.value as typeof previewAs)}
                className="px-2 py-1.5 rounded-md border border-[#e4e4e7] bg-white text-[#374151] text-[0.72rem] outline-none">
                <option value="website">Subscriber</option>
                <option value="user">Registered customer</option>
                <option value="legacy">Old website contact</option>
              </select>
            </label>
            {previewLoading && <Loader2 size={14} className="animate-spin text-[#c9a84c] ml-auto" />}
          </div>

          <div className="px-4 sm:px-6 py-6">
            {/* Faux inbox row so subject + preview text can be judged in context */}
            <div className="mx-auto mb-4 bg-white border border-[#ede9e1] rounded-xl px-4 py-3 transition-[max-width] duration-300"
              style={{ maxWidth: device === 'mobile' ? 390 : 700 }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.78rem] font-semibold text-[#1a1714]">Alpha Gemstone</p>
                <p className="text-[0.68rem] text-[#a09a90] shrink-0">now</p>
              </div>
              <p className="text-[0.78rem] text-[#1a1714] truncate">
                {(form.subject || 'Your subject line').replace(/\{\{\s*first_?name\s*\}\}/gi, (adminName || 'Sarah').split(' ')[0])}
              </p>
              <p className="text-[0.74rem] text-[#a09a90] truncate">{form.preheader || 'Preview text appears here…'}</p>
            </div>

            <div className="mx-auto rounded-xl overflow-hidden border border-[#ede9e1] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-[max-width] duration-300"
              style={{ maxWidth: device === 'mobile' ? 390 : 700 }}>
              {previewHtml ? (
                <iframe
                  ref={iframeRef}
                  title="Email preview"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  onLoad={syncIframeHeight}
                  className="w-full block border-0"
                  style={{ height: iframeHeight }}
                />
              ) : (
                <div className="h-[600px] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#c9a84c]" /></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
