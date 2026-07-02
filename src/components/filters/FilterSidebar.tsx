'use client';
import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  SHAPES, CLARITIES,
  WATCH_GENDERS, WATCH_BRANDS, WATCH_MOVEMENTS,
  WATCH_STRAP_TYPES, WATCH_CASE_MATERIALS, WATCH_DIAL_COLORS,
  WATCH_FEATURES, WATCH_STYLES, WATCH_CASE_SIZES,
} from '@/models/Product';

const DISPLAY_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'fancy-yellow', 'fancy-pink', 'fancy-blue'];

// dedupe helper — guards against duplicate values in the model's constant arrays
// (e.g. "other" listed twice), which otherwise produce duplicate React keys.
const dedupe = <T,>(arr: readonly T[]): T[] => Array.from(new Set(arr));

interface FacetCount { _id: string; count: number }

interface FilterSidebarProps {
  productType?: 'diamond' | 'watch';
  facets?: {
    shapes?: FacetCount[];
    colors?: FacetCount[];
    clarities?: FacetCount[];
    priceRange?: Array<{ min: number; max: number }>;
    sizeRange?: Array<{ min: number; max: number }>;
    watchGenders?: FacetCount[];
    watchBrands?: FacetCount[];
    watchMovements?: FacetCount[];
    watchStrapTypes?: FacetCount[];
    watchCaseMaterials?: FacetCount[];
    watchDialColors?: FacetCount[];
    watchFeatures?: FacetCount[];
    watchStyles?: FacetCount[];
    watchCaseSizes?: FacetCount[];
  };
}

const PRICE_BRACKETS = [
  { label: 'Under $1,000',      min: '',      max: '1000'  },
  { label: '$1,000 – $5,000',   min: '1000',  max: '5000'  },
  { label: '$5,000 – $15,000',  min: '5000',  max: '15000' },
  { label: '$15,000 – $50,000', min: '15000', max: '50000' },
  { label: 'Over $50,000',      min: '50000', max: ''      },
];

export default function FilterSidebar({ productType = 'diamond', facets }: FilterSidebarProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const baseRoute = pathname.includes('/watches')
    ? '/products/watches'
    : pathname.includes('/diamonds')
      ? '/products/diamonds'
      : '/products';

  const [mode, setMode] = useState<'watch' | 'diamond'>(productType);

  const activeShapes    = searchParams.get('shape')?.split(',').filter(Boolean)   || [];
  const activeColors    = searchParams.get('color')?.split(',').filter(Boolean)   || [];
  const activeClarities = searchParams.get('clarity')?.split(',').filter(Boolean) || [];
  const priceMin        = searchParams.get('priceMin') || '';
  const priceMax        = searchParams.get('priceMax') || '';
  const sizeMin         = searchParams.get('sizeMin')  || '';
  const sizeMax         = searchParams.get('sizeMax')  || '';

  const activeWatchGender        = searchParams.get('watchGender') || '';
  const activeWatchBrands        = searchParams.get('watchBrand')?.split(',').filter(Boolean)        || [];
  const activeWatchMovements     = searchParams.get('watchMovement')?.split(',').filter(Boolean)     || [];
  const activeWatchStrapTypes    = searchParams.get('watchStrapType')?.split(',').filter(Boolean)    || [];
  const activeWatchCaseMaterials = searchParams.get('watchCaseMaterial')?.split(',').filter(Boolean) || [];
  const activeWatchDialColors    = searchParams.get('watchDialColor')?.split(',').filter(Boolean)    || [];
  const activeWatchFeatures      = searchParams.get('watchFeatures')?.split(',').filter(Boolean)     || [];
  const activeWatchStyles        = searchParams.get('watchStyle')?.split(',').filter(Boolean)        || [];
  const activeWatchCaseSize      = searchParams.get('watchCaseSize') || '';

  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);
  const [localSizeMin,  setLocalSizeMin]  = useState(sizeMin);
  const [localSizeMax,  setLocalSizeMax]  = useState(sizeMax);

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      value ? params.set(key, value) : params.delete(key);
      params.set('page', '1');
      router.push(`${baseRoute}?${params.toString()}`);
    },
    [router, searchParams, baseRoute]
  );

  const toggleMultiSelect = useCallback(
    (key: string, current: string[], value: string) => {
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      updateFilter(key, next.length ? next.join(',') : null);
    },
    [updateFilter]
  );

  const applyRanges = () => {
    const params = new URLSearchParams(searchParams.toString());
    localPriceMin ? params.set('priceMin', localPriceMin) : params.delete('priceMin');
    localPriceMax ? params.set('priceMax', localPriceMax) : params.delete('priceMax');
    localSizeMin  ? params.set('sizeMin',  localSizeMin)  : params.delete('sizeMin');
    localSizeMax  ? params.set('sizeMax',  localSizeMax)  : params.delete('sizeMax');
    params.set('page', '1');
    router.push(`${baseRoute}?${params.toString()}`);
  };

  const applyPriceBracket = (min: string, max: string) => {
    setLocalPriceMin(min);
    setLocalPriceMax(max);
    const params = new URLSearchParams(searchParams.toString());
    min ? params.set('priceMin', min) : params.delete('priceMin');
    max ? params.set('priceMax', max) : params.delete('priceMax');
    params.set('page', '1');
    router.push(`${baseRoute}?${params.toString()}`);
  };

  const clearAll = () => router.push(baseRoute);

  const switchMode = (next: 'watch' | 'diamond') => {
    setMode(next);
    router.push(next === 'watch' ? '/products/watches' : '/products/diamonds');
  };

  const hasActiveFilters =
    activeShapes.length || activeColors.length || activeClarities.length ||
    priceMin || priceMax || sizeMin || sizeMax ||
    activeWatchGender || activeWatchBrands.length || activeWatchMovements.length ||
    activeWatchStrapTypes.length || activeWatchCaseMaterials.length ||
    activeWatchDialColors.length || activeWatchFeatures.length ||
    activeWatchStyles.length || activeWatchCaseSize;

  const countFor = (list: FacetCount[] | undefined, id: string) =>
    list?.find((f) => f._id === id)?.count;

  return (
    <aside
      className="w-full space-y-0 bg-white"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
    

      {/* ── Type switcher ──────────────────────────────────────────────────── */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white mb-5">
        <button
          onClick={() => switchMode('diamond')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-200 ${
            mode === 'diamond'
              ? 'bg-gray-900 text-white rounded-md m-0.5'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <DiamondIcon active={mode === 'diamond'} />
          Diamonds
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={() => switchMode('watch')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-200 ${
            mode === 'watch'
              ? 'bg-gray-900 text-white rounded-md m-0.5'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <WatchIcon active={mode === 'watch'} />
          Watches
        </button>
      </div>

      {/* ── Filters header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1 px-0.5">
        <span className="text-[9px] tracking-[0.35em] uppercase font-semibold text-gray-300">
          Refine
        </span>
        {hasActiveFilters ? (
          <button
            onClick={clearAll}
            className="text-[10px] text-[#B8975A] hover:text-[#8A6C38] font-medium transition-colors"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {/* ── Price (shared) ─────────────────────────────────────────────────── */}
      <FilterGroup label="Price (USD)">
        <div className="space-y-0.5 mb-3">
          {PRICE_BRACKETS.map(({ label, min, max }) => {
            const isActive = localPriceMin === min && localPriceMax === max
              && (priceMin === min || priceMax === max);
            return (
              <button
                key={label}
                onClick={() => applyPriceBracket(min, max)}
                className={`block w-full text-left px-2.5 py-[5px] rounded-md text-[11px] transition-all duration-150 ${
                  isActive
                    ? 'bg-[#B8975A]/10 text-[#8A6C38] font-semibold'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mb-2">
          <input
            type="number"
            placeholder="Min $"
            value={localPriceMin}
            onChange={(e) => setLocalPriceMin(e.target.value)}
            className="w-0 min-w-0 flex-1 px-2 py-1.5 text-[11px] border border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-[#B8975A] focus:ring-1 focus:ring-[#B8975A]/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <input
            type="number"
            placeholder="Max $"
            value={localPriceMax}
            onChange={(e) => setLocalPriceMax(e.target.value)}
            className="w-0 min-w-0 flex-1 px-2 py-1.5 text-[11px] border border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-[#B8975A] focus:ring-1 focus:ring-[#B8975A]/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <ApplyButton onClick={applyRanges} />
      </FilterGroup>

      {/* ── Availability (shared) ──────────────────────────────────────────── */}
      <FilterGroup label="Availability">
        <CheckItem
          label="In Stock Only"
          checked={searchParams.get('inStock') === 'true'}
          onChange={() =>
            updateFilter('inStock', searchParams.get('inStock') === 'true' ? null : 'true')
          }
        />
      </FilterGroup>

      {/* ══════════════════════════════════════════════════════════════════════
          WATCH FILTERS
         ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'watch' && (
        <>
          <FilterGroup label="Gender">
            {dedupe(WATCH_GENDERS).map((g) => (
              <CheckItem
                key={g} label={g}
                count={countFor(facets?.watchGenders, g)}
                checked={activeWatchGender === g}
                onChange={() => updateFilter('watchGender', activeWatchGender === g ? null : g)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Brand">
            {dedupe(WATCH_BRANDS).map((b) => (
              <CheckItem
                key={b} label={b}
                count={countFor(facets?.watchBrands, b)}
                checked={activeWatchBrands.includes(b)}
                onChange={() => toggleMultiSelect('watchBrand', activeWatchBrands, b)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Movement">
            {dedupe(WATCH_MOVEMENTS).map((m) => (
              <CheckItem
                key={m} label={m}
                count={countFor(facets?.watchMovements, m)}
                checked={activeWatchMovements.includes(m)}
                onChange={() => toggleMultiSelect('watchMovement', activeWatchMovements, m)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Strap Type">
            {dedupe(WATCH_STRAP_TYPES).map((s) => (
              <CheckItem
                key={s} label={s}
                count={countFor(facets?.watchStrapTypes, s)}
                checked={activeWatchStrapTypes.includes(s)}
                onChange={() => toggleMultiSelect('watchStrapType', activeWatchStrapTypes, s)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Case Material">
            {dedupe(WATCH_CASE_MATERIALS).map((m) => (
              <CheckItem
                key={m} label={m}
                count={countFor(facets?.watchCaseMaterials, m)}
                checked={activeWatchCaseMaterials.includes(m)}
                onChange={() => toggleMultiSelect('watchCaseMaterial', activeWatchCaseMaterials, m)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Dial Color">
            {dedupe(WATCH_DIAL_COLORS).map((c) => (
              <CheckItem
                key={c} label={c}
                count={countFor(facets?.watchDialColors, c)}
                checked={activeWatchDialColors.includes(c)}
                onChange={() => toggleMultiSelect('watchDialColor', activeWatchDialColors, c)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Features">
            {dedupe(WATCH_FEATURES).map((f) => (
              <CheckItem
                key={f} label={f}
                count={countFor(facets?.watchFeatures, f)}
                checked={activeWatchFeatures.includes(f)}
                onChange={() => toggleMultiSelect('watchFeatures', activeWatchFeatures, f)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Style">
            {dedupe(WATCH_STYLES).map((s) => (
              <CheckItem
                key={s} label={s}
                count={countFor(facets?.watchStyles, s)}
                checked={activeWatchStyles.includes(s)}
                onChange={() => toggleMultiSelect('watchStyle', activeWatchStyles, s)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Case Size">
            {dedupe(WATCH_CASE_SIZES).map((sz) => (
              <CheckItem
                key={sz} label={sz}
                count={countFor(facets?.watchCaseSizes, sz)}
                checked={activeWatchCaseSize === sz}
                onChange={() => updateFilter('watchCaseSize', activeWatchCaseSize === sz ? null : sz)}
              />
            ))}
          </FilterGroup>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DIAMOND FILTERS
         ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'diamond' && (
        <>
          <FilterGroup label="Shape">
            {dedupe(SHAPES).map((shape) => (
              <CheckItem
                key={shape}
                label={shape.charAt(0).toUpperCase() + shape.slice(1)}
                count={facets?.shapes?.find((f) => f._id === shape)?.count}
                checked={activeShapes.includes(shape)}
                onChange={() => toggleMultiSelect('shape', activeShapes, shape)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Color Grade">
            {dedupe(DISPLAY_COLORS).map((color) => (
              <CheckItem
                key={color} label={color}
                count={facets?.colors?.find((f) => f._id === color)?.count}
                checked={activeColors.includes(color)}
                onChange={() => toggleMultiSelect('color', activeColors, color)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Clarity">
            {dedupe(CLARITIES).map((clarity) => (
              <CheckItem
                key={clarity} label={clarity}
                count={facets?.clarities?.find((f) => f._id === clarity)?.count}
                checked={activeClarities.includes(clarity)}
                onChange={() => toggleMultiSelect('clarity', activeClarities, clarity)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Carat Weight">
            <div className="flex gap-1.5 mb-2">
              <input
                type="number"
                placeholder="Min ct"
                step="0.01"
                value={localSizeMin}
                onChange={(e) => setLocalSizeMin(e.target.value)}
                className="w-0 min-w-0 flex-1 px-2 py-1.5 text-[11px] border border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-[#B8975A] focus:ring-1 focus:ring-[#B8975A]/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input
                type="number"
                placeholder="Max ct"
                step="0.01"
                value={localSizeMax}
                onChange={(e) => setLocalSizeMax(e.target.value)}
                className="w-0 min-w-0 flex-1 px-2 py-1.5 text-[11px] border border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-[#B8975A] focus:ring-1 focus:ring-[#B8975A]/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <ApplyButton onClick={applyRanges} />
          </FilterGroup>
        </>
      )}

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <div className="pt-5 pb-2 text-center">
        <p className="text-[9px] tracking-[0.2em] uppercase text-gray-300">
          All stones GIA / IGI certified
        </p>
      </div>
    </aside>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function DiamondIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 18 18" fill="none"
      style={{ color: active ? 'white' : 'currentColor' }}>
      <path d="M9 16L2 7l2.5-5h9L16 7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 7h14M9 16L5 7l4-5 4 5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function WatchIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 18 18" fill="none"
      style={{ color: active ? 'white' : 'currentColor' }}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 6v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="1.5" width="4" height="2" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <rect x="7" y="14.5" width="4" height="2" rx="0.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ApplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase border border-[#B8975A] text-[#B8975A] rounded-md hover:bg-[#B8975A] hover:text-white transition-all duration-200"
    >
      Apply
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3.5 text-left group"
      >
        <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-gray-500 group-hover:text-[#B8975A] transition-colors">
          {label}
        </span>
        <span
          className="text-gray-300 text-[10px] transition-transform duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="space-y-0.5 pb-3.5">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckItem({
  label, count, checked, onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group py-[3px]">
      <span
        className={`w-3.5 h-3.5 flex-shrink-0 rounded-[3px] border flex items-center justify-center transition-all duration-150 ${
          checked
            ? 'bg-[#B8975A] border-[#B8975A]'
            : 'border-gray-200 bg-white group-hover:border-[#B8975A]'
        }`}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <polyline
              points="1.5,4 3.2,5.8 6.5,2"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`text-[11px] flex-1 transition-colors leading-snug ${
          checked ? 'text-gray-900 font-medium' : 'text-gray-400 group-hover:text-gray-800'
        }`}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] text-gray-300 ml-auto">{count}</span>
      )}
    </label>
  );
}