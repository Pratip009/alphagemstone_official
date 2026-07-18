'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductKind } from '@/models/Product';
import './CompareStones.css';

const KIND_LABELS: Record<ProductKind, string> = {
  diamond: 'Diamond',
  gemstone: 'Gemstone',
  watch: 'Watch',
  jewelry: 'Jewelry',
};

// Shape returned by /api/products/search (and reusable for a product already
// on hand, e.g. the product detail page prefilling slot one).
export interface SearchProduct {
  _id: string;
  name: string;
  price?: number;
  productKind?: ProductKind;
  shape?: string | string[];
  shapeRaw?: string;
  size?: number;
  color?: string | string[];
  colorRaw?: string;
  clarity?: string | string[];
  clarityRaw?: string;
  gradeRaw?: string;
  certification?: string | string[];
  gemstoneName?: string;
  legacyAttributes?: Record<string, string>;
  watchBrand?: string;
  watchModel?: string;
  watchGender?: string;
  watchMovement?: string;
  watchStrapType?: string;
  watchCaseMaterial?: string;
  watchDialColor?: string;
  watchStyle?: string;
  watchCaseSize?: string;
  watchFeatures?: string[];
  images?: string[];
  stock?: number;
}

export interface CompareSlotData {
  id: string;
  product: SearchProduct | null;
}

let uidCounter = 0;
function nextId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

export function makeEmptySlot(product: SearchProduct | null = null): CompareSlotData {
  return { id: nextId('slot'), product };
}

const MIN_SLOTS = 2;
const MAX_SLOTS = 4;

function first(v?: string | string[]): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}
function cap(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
}
function kindOf(p: SearchProduct): ProductKind {
  return p.productKind ?? (p.watchBrand ? 'watch' : p.gemstoneName ? 'gemstone' : 'diamond');
}

// legacyAttributes keys that are internal bookkeeping, not customer-facing
// specs — mirrors SKIP_ATTR_KEYS on the product detail page.
const SKIP_ATTR_KEYS = new Set(['legacyCategoryRaw', 'shippingWeight']);

// "metalMaterial" -> "Metal Material"
function titleCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

// Builds the ordered spec rows for a single product — same field priority
// and legacyAttributes fallbacks as buildSpecs() on the product detail page,
// so "Cut", "Origin", "Luster", "Treatment", "Hardness", "Grade", "Approx
// Weight" etc. (which live in legacyAttributes on most catalog items, not
// the clean enum fields) show up here too instead of being silently dropped.
function buildProductRows(p: SearchProduct): { label: string; value: string }[] {
  const kind = kindOf(p);
  const attrs = p.legacyAttributes ?? {};
  const rows: { label: string; value: string }[] = [];
  const used = new Set<string>();

  const push = (label: string, value?: string | number | null) => {
    if (value === undefined || value === null || value === '') return;
    rows.push({ label, value: String(value) });
  };
  const attr = (key: string): string | undefined => {
    used.add(key);
    return attrs[key] || undefined;
  };

  if (kind === 'diamond') {
    push('Polish', attr('polish'));
    push('Shape', p.shapeRaw || cap(first(p.shape)));
    push('Cut', attr('cut'));
    push('Color', p.colorRaw || first(p.color));
    push('Size', attr('dimensions'));
    push('Depth', attr('depth'));
    push('Treatment', attr('treatment'));
    push('Clarity', p.clarityRaw || first(p.clarity));
    const cert = first(p.certification);
    if (cert && cert !== 'none') push('Certification', cert);
    const aw = attr('approxWeight');
    push('Approx Weight', aw ? `${aw} ct.` : p.size ? `${p.size} ct.` : undefined);
  } else if (kind === 'gemstone') {
    push('Gemstone', p.gemstoneName);
    push('Shape', p.shapeRaw || cap(first(p.shape)));
    push('Cut', attr('cut'));
    push('Color', p.colorRaw || first(p.color));
    push('Origin', attr('origin'));
    push('Size', attr('dimensions'));
    push('Luster', attr('luster'));
    push('Treatment', attr('treatment'));
    push('Hardness', attr('hardness'));
    push('Clarity', p.clarityRaw || first(p.clarity));
    const gradeAttr = attr('grade');
    push('Grade', p.gradeRaw || gradeAttr);
    const aw = attr('approxWeight');
    push('Approx Weight', aw ? `${aw} ct.` : p.size ? `${p.size} ct.` : undefined);
  } else if (kind === 'watch') {
    push('Brand', p.watchBrand);
    push('Model', p.watchModel);
    push('Movement', p.watchMovement);
    push('Gender', p.watchGender);
    push('Style', p.watchStyle);
    push('Strap', p.watchStrapType);
    push('Case Material', p.watchCaseMaterial);
    push('Dial Color', p.watchDialColor);
    push('Case Size', p.watchCaseSize);
    push('Features', (p.watchFeatures ?? []).join(', '));
  } else {
    push('Metal', attr('metalMaterial'));
    push('Metal Weight', attr('metalWeight'));
    push('Ring Size', attr('ringSize'));
    push('Size Range', attr('sizeRange'));
    push('Carat Range', attr('caratRange'));
    push('Shape', p.shapeRaw || cap(first(p.shape)));
    push('Color', p.colorRaw || first(p.color));
  }

  // Anything left in legacyAttributes that wasn't already pulled out above —
  // keeps this honest instead of quietly dropping data that was captured at
  // import time (e.g. a stray attribute that doesn't fit the usual set).
  for (const [key, value] of Object.entries(attrs)) {
    if (used.has(key) || SKIP_ATTR_KEYS.has(key) || !value) continue;
    push(titleCase(key), value);
  }

  return rows;
}

// Price + availability are always shown first, for every kind, computed
// directly rather than via legacyAttributes.
function buildLeadingRows(p: SearchProduct): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (p.price != null) rows.push({ label: 'Price', value: `$${p.price.toLocaleString()}` });
  if (p.stock != null) rows.push({ label: 'Availability', value: p.stock > 0 ? `${p.stock} in stock` : 'Out of stock' });
  return rows;
}

// Unions each product's row list into one ordered table: every row label
// that appears on ANY selected product becomes a row, in first-seen order
// across the slots, with a blank cell for products that don't have it.
function buildComparisonRows(products: SearchProduct[]): { label: string; values: Map<string, string> }[] {
  const order: string[] = [];
  const byLabel = new Map<string, Map<string, string>>(); // label -> (productId -> value)

  products.forEach((p) => {
    const rows = [...buildLeadingRows(p), ...buildProductRows(p)];
    rows.forEach(({ label, value }) => {
      if (!byLabel.has(label)) {
        byLabel.set(label, new Map());
        order.push(label);
      }
      byLabel.get(label)!.set(p._id, value);
    });
  });

  return order.map((label) => ({ label, values: byLabel.get(label)! }));
}

// ── Per-slot search box ─────────────────────────────────────────────────────

function SlotSearch({ onSelect }: { onSelect: (p: SearchProduct) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}&limit=8`);
        const json = await res.json();
        setResults(json?.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
  }, []);

  return (
    <div className="cmp-search">
      <input
        className="input"
        type="text"
        placeholder="Search by product name…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // small delay so a click on a result registers before we close
          blurTimeoutRef.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && query.trim().length >= 2 && (
        <div className="cmp-search-results">
          {loading && <div className="cmp-search-empty">Searching…</div>}
          {!loading && results.length === 0 && <div className="cmp-search-empty">No matching products</div>}
          {!loading &&
            results.map((p) => (
              <button
                type="button"
                key={p._id}
                className="cmp-search-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(p);
                  setQuery('');
                  setResults([]);
                  setOpen(false);
                }}
              >
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="cmp-search-thumb" />
                ) : (
                  <span className="cmp-search-thumb cmp-search-thumb-empty" />
                )}
                <span className="cmp-search-item-text">
                  <span className="cmp-search-item-name">{p.name}</span>
                  <span className="cmp-search-item-meta">
                    {KIND_LABELS[kindOf(p)]}
                    {p.price != null ? ` · $${p.price.toLocaleString()}` : ''}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main tool ────────────────────────────────────────────────────────────────

export default function CompareStonesTool({
  initialSlots,
}: {
  initialSlots?: CompareSlotData[];
}) {
  const [slots, setSlots] = useState<CompareSlotData[]>(() => {
    const base = initialSlots ?? [];
    const filled = [...base];
    while (filled.length < MIN_SLOTS) filled.push(makeEmptySlot());
    return filled;
  });

  const selectProduct = (slotId: string, product: SearchProduct) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, product } : s)));
  };

  const clearSlot = (slotId: string) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, product: null } : s)));
  };

  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;
    setSlots((prev) => [...prev, makeEmptySlot()]);
  };

  const removeSlot = (id: string) => {
    if (slots.length <= MIN_SLOTS) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const filledProducts = slots.filter((s) => s.product).map((s) => s.product as SearchProduct);
  const comparisonRows = useMemo(() => buildComparisonRows(filledProducts), [filledProducts]);

  return (
    <div className="cmp-wrap">
      <div className="cmp-slots">
        {slots.map((slot, idx) => (
          <div key={slot.id} className="card-luxury cmp-slot">
            <div className="cmp-slot-head">
              <span className="cmp-slot-title">Stone {String.fromCharCode(65 + idx)}</span>
              {slots.length > MIN_SLOTS && (
                <button type="button" className="cmp-slot-remove" onClick={() => removeSlot(slot.id)}>
                  Remove
                </button>
              )}
            </div>

            {slot.product ? (
              <div className="cmp-selected">
                {slot.product.images?.[0] ? (
                  <img src={slot.product.images[0]} alt="" className="cmp-selected-thumb" />
                ) : (
                  <span className="cmp-selected-thumb cmp-search-thumb-empty" />
                )}
                <div className="cmp-selected-text">
                  <span className="cmp-col-head-kind">{KIND_LABELS[kindOf(slot.product)]}</span>
                  <span className="cmp-selected-name">{slot.product.name}</span>
                </div>
                <button type="button" className="cmp-slot-remove" onClick={() => clearSlot(slot.id)}>
                  Change
                </button>
              </div>
            ) : (
              <SlotSearch onSelect={(p) => selectProduct(slot.id, p)} />
            )}
          </div>
        ))}

        {slots.length < MAX_SLOTS && (
          <div className="cmp-add-slot-wrap">
            <button type="button" className="cmp-add-slot" onClick={addSlot}>
              + Add another stone
            </button>
          </div>
        )}
      </div>

      {filledProducts.length >= 2 && (
        <div className="cmp-legend">
          <span className="cmp-legend-swatch" /> Highlighted rows show specs that differ between your stones.
        </div>
      )}

      {filledProducts.length > 0 && (
        <div className="cmp-table-scroll">
          <table className="table-luxury">
            <thead>
              <tr>
                <th>Spec</th>
                {slots.map((slot, idx) => (
                  <th key={slot.id}>
                    <div className="cmp-col-head">
                      <span className="cmp-col-head-kind">{slot.product ? KIND_LABELS[kindOf(slot.product)] : `Stone ${String.fromCharCode(65 + idx)}`}</span>
                      <span className="cmp-col-head-name">{slot.product?.name ?? '—'}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => {
                const values = slots.map((s) => (s.product ? row.values.get(s.product._id) ?? '' : ''));
                const filled = values.filter(Boolean);
                const isDiff = filled.length >= 2 && new Set(filled).size > 1;
                return (
                  <tr key={row.label} className={isDiff ? 'cmp-row-diff' : ''}>
                    <td>{row.label}</td>
                    {values.map((v, i) => (
                      <td key={slots[i].id} className={!v ? 'cmp-empty-cell' : ''}>
                        {v || '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="cmp-note">
        Note: this comparison pulls live specs, stock, and pricing directly from our current inventory, but
        prices and availability can change. Please call us at <a href="tel:+19143101480">1-914-310-1480</a> to
        confirm before you buy or to request a formal quote.
      </div>
    </div>
  );
}