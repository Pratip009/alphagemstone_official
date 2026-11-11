'use client';
import { useEffect, useState } from 'react';
import { Search, Loader2, Plus, X, ChevronUp, ChevronDown, Gem } from 'lucide-react';
import type { CampaignProduct } from './types';

const MAX = 6;

interface ApiProduct {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  slug?: string;
}

function money(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProductPicker({
  value,
  onChange,
  authFetch,
}: {
  value: CampaignProduct[];
  onChange: (next: CampaignProduct[]) => void;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: 'active', limit: '8', sortBy: 'createdAt', sortDir: 'desc' });
        if (q.trim()) params.set('q', q.trim());
        const res = await authFetch(`/api/admin/products?${params}`);
        const d = await res.json();
        setResults(d.success ? d.data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open, authFetch]);

  const chosen = new Set(value.map(p => p.productId));
  const full = value.length >= MAX;

  const add = (p: ApiProduct) => {
    if (chosen.has(p._id) || full) return;
    onChange([...value, { productId: p._id, name: p.name, price: p.price, image: p.images?.[0] ?? '', slug: p.slug ?? '' }]);
  };
  const remove = (id: string) => onChange(value.filter(p => p.productId !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="border border-[#ede9e1] rounded-xl divide-y divide-[#f4f1ec] bg-white">
          {value.map((p, i) => (
            <li key={p.productId} className="flex items-center gap-3 px-3 py-2.5">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-11 h-11 rounded-lg object-cover border border-[#ede9e1] shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-[#f4f1ec] flex items-center justify-center shrink-0"><Gem size={16} className="text-[#c9a84c]" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[0.8rem] font-medium text-[#1a1714] truncate">{p.name}</p>
                <p className="text-[0.72rem] text-[#a09a90]">{money(p.price)}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] disabled:opacity-30"><ChevronUp size={14} /></button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === value.length - 1}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec] disabled:opacity-30"><ChevronDown size={14} /></button>
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p.productId)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#ef4444] hover:bg-[#fef2f2]"><X size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={full}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[#e4e4e7] flex items-center justify-center gap-2 text-[0.75rem] font-medium text-[#a09a90] hover:border-[#c9a84c] hover:text-[#8a6e2a] transition-colors disabled:opacity-50 disabled:hover:border-[#e4e4e7] disabled:hover:text-[#a09a90]"
        >
          <Plus size={14} />
          {full ? `Up to ${MAX} products per email` : value.length ? 'Add another product' : 'Add products to feature'}
        </button>
      ) : (
        <div className="border border-[#ede9e1] rounded-xl bg-[#fafaf9] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09a90]" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by product name or SKU"
                className="w-full pl-8 pr-3 py-2 text-[0.8rem] rounded-lg border border-[#e4e4e7] bg-white outline-none focus:border-[#c9a84c]"
              />
            </div>
            <button type="button" onClick={() => { setOpen(false); setQ(''); }}
              className="px-3 py-2 text-[0.75rem] font-semibold text-[#64748b] rounded-lg hover:bg-[#f4f1ec]">Done</button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[#c9a84c]" /></div>
            ) : results.length === 0 ? (
              <p className="text-center text-[0.75rem] text-[#a09a90] py-6">No active products match “{q}”.</p>
            ) : (
              <ul className="divide-y divide-[#f0ece4]">
                {results.map(p => {
                  const picked = chosen.has(p._id);
                  return (
                    <li key={p._id} className="flex items-center gap-3 py-2">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="w-10 h-10 rounded-md object-cover border border-[#ede9e1] shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-white border border-[#ede9e1] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.78rem] text-[#1a1714] truncate">{p.name}</p>
                        <p className="text-[0.7rem] text-[#a09a90]">{money(p.price)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => add(p)}
                        disabled={picked || full}
                        className="px-3 py-1.5 rounded-lg text-[0.72rem] font-semibold border border-[#e4e4e7] text-[#1a1714] bg-white hover:border-[#c9a84c] disabled:opacity-40 shrink-0"
                      >
                        {picked ? 'Added' : 'Add'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
