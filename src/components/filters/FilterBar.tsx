'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  SHAPES, CLARITIES,
  WATCH_GENDERS, WATCH_BRANDS, WATCH_MOVEMENTS,
  WATCH_STRAP_TYPES, WATCH_CASE_MATERIALS, WATCH_DIAL_COLORS,
  WATCH_FEATURES, WATCH_STYLES, WATCH_CASE_SIZES,
} from '@/models/Product';

const DISPLAY_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'fancy-yellow', 'fancy-pink', 'fancy-blue'];

const COLOR_SWATCH: Record<string, string> = {
  D: '#fbfbfa', E: '#fbfbfa', F: '#fbfbfa', G: '#f8f6ee', H: '#f5f1e2',
  I: '#f1ead2', J: '#ece2c0', K: '#e6d7a9',
  'fancy-yellow': '#e8cf5a', 'fancy-pink': '#e7b3bd', 'fancy-blue': '#a9c6d8',
};

const dedupe = <T,>(arr: readonly T[]): T[] => Array.from(new Set(arr));

interface FacetCount { _id: string; count: number }

interface CategoryWithSubs {
  _id: string;
  name: string;
  slug: string;
  subcategories: { _id: string; name: string; slug: string; image?: string }[];
}

interface FilterBarProps {
  productType?: 'diamond' | 'watch' | 'gemstone';
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
  categories?: CategoryWithSubs[];
}

const PRICE_BRACKETS = [
  { label: 'Under $1,000', min: '', max: '1000' },
  { label: '$1,000 – $5,000', min: '1000', max: '5000' },
  { label: '$5,000 – $15,000', min: '5000', max: '15000' },
  { label: '$15,000 – $50,000', min: '15000', max: '50000' },
  { label: 'Over $50,000', min: '50000', max: '' },
];

/* ---------------------------------------------------------------------- */
/*  Design tokens — quiet ink + brushed-brass palette, tuned for a fine    */
/*  jewelry / watch marketplace instead of a generic purple admin theme.  */
/* ---------------------------------------------------------------------- */
const T = {
  ink: '#161513',
  inkSoft: '#57534e',
  paper: '#ffffff',
  line: '#e7e3db',
  lineStrong: '#d8d2c4',
  gold: '#9c7a3c',
  goldDeep: '#7c5f2c',
  goldSoft: '#f3ead3',
  goldFaint: '#faf6ea',
  clear: '#8a3b32',
};

export default function FilterBar({ productType = 'diamond', facets, categories: categoriesProp }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const baseRoute = pathname.includes('/watches')
    ? '/products/watches'
    : pathname.includes('/gemstones')
      ? '/products/gemstones'
      : pathname.includes('/diamonds')
        ? '/products/diamonds'
        : '/products';

  const [mode, setMode] = useState<'watch' | 'diamond' | 'gemstone'>(productType);

  const activeCategorySlug = searchParams.get('category') || '';
  const activeSubcategorySlug = searchParams.get('subcategory') || '';

  const [categories, setCategories] = useState<CategoryWithSubs[]>(categoriesProp ?? []);
  const [categoriesLoading, setCategoriesLoading] = useState(!categoriesProp);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    activeCategorySlug || (categoriesProp && categoriesProp.length > 0 ? categoriesProp[0].slug : null)
  );

  useEffect(() => {
    if (categoriesProp) return;
    let cancelled = false;
    setCategoriesLoading(true);
    setExpandedCategory(activeCategorySlug || null);
    (async () => {
      try {
        const res = await fetch(`/api/categories?withSubcategories=true&productKind=${mode}`);
        const json = await res.json();
        const list: CategoryWithSubs[] = (json?.data ?? json ?? []).map((c: any) => ({
          _id: c._id,
          name: c.name,
          slug: c.slug,
          subcategories: (c.subcategories ?? []).map((s: any) => ({ _id: s._id, name: s.name, slug: s.slug, image: s.imageUrl ?? s.image })),
        }));
        if (!cancelled) {
          setCategories(list);
          if (!activeCategorySlug) {
            setExpandedCategory(list.length > 0 ? list[0].slug : null);
          }
        }
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoriesProp, mode, activeCategorySlug]);

  const activeShapes = searchParams.get('shape')?.split(',').filter(Boolean) || [];
  const activeColors = searchParams.get('color')?.split(',').filter(Boolean) || [];
  const activeClarities = searchParams.get('clarity')?.split(',').filter(Boolean) || [];
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  const sizeMin = searchParams.get('sizeMin') || '';
  const sizeMax = searchParams.get('sizeMax') || '';

  const activeWatchGender = searchParams.get('watchGender') || '';
  const activeWatchBrands = searchParams.get('watchBrand')?.split(',').filter(Boolean) || [];
  const activeWatchMovements = searchParams.get('watchMovement')?.split(',').filter(Boolean) || [];
  const activeWatchStrapTypes = searchParams.get('watchStrapType')?.split(',').filter(Boolean) || [];
  const activeWatchCaseMaterials = searchParams.get('watchCaseMaterial')?.split(',').filter(Boolean) || [];
  const activeWatchDialColors = searchParams.get('watchDialColor')?.split(',').filter(Boolean) || [];
  const activeWatchFeatures = searchParams.get('watchFeatures')?.split(',').filter(Boolean) || [];
  const activeWatchStyles = searchParams.get('watchStyle')?.split(',').filter(Boolean) || [];
  const activeWatchCaseSize = searchParams.get('watchCaseSize') || '';

  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);
  const [localSizeMin, setLocalSizeMin] = useState(sizeMin);
  const [localSizeMax, setLocalSizeMax] = useState(sizeMax);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    price: false, shape: false, color: false, clarity: false, carat: false,
    gender: false, brand: false, movement: false, strap: false, caseMaterial: false,
    dialColor: false, features: false, style: false, caseSize: false, availability: false,
  });

  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    value ? params.set(key, value) : params.delete(key);
    params.set('page', '1');
    router.push(`${baseRoute}?${params.toString()}`);
  }, [router, searchParams, baseRoute]);

  const toggleMultiSelect = useCallback((key: string, current: string[], value: string) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, next.length ? next.join(',') : null);
  }, [updateFilter]);

  const applyRanges = () => {
    const params = new URLSearchParams(searchParams.toString());
    localPriceMin ? params.set('priceMin', localPriceMin) : params.delete('priceMin');
    localPriceMax ? params.set('priceMax', localPriceMax) : params.delete('priceMax');
    localSizeMin ? params.set('sizeMin', localSizeMin) : params.delete('sizeMin');
    localSizeMax ? params.set('sizeMax', localSizeMax) : params.delete('sizeMax');
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

  const clearAll = () => {
    setExpandedCategory(null);
    router.push(baseRoute);
  };

  const switchMode = (next: 'watch' | 'diamond' | 'gemstone') => {
    setMode(next);
    setExpandedCategory(null);
    router.push(
      next === 'watch' ? '/products/watches'
      : next === 'gemstone' ? '/products/gemstones'
      : '/products/diamonds'
    );
  };

  const selectCategory = (slug: string) => {
    if (expandedCategory === slug) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(slug);
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', slug);
    params.delete('subcategory');
    params.set('page', '1');
    router.push(`${baseRoute}?${params.toString()}`);
  };

  const selectSubcategory = (categorySlug: string, subSlug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', categorySlug);
    if (activeSubcategorySlug === subSlug) params.delete('subcategory');
    else params.set('subcategory', subSlug);
    params.set('page', '1');
    router.push(`${baseRoute}?${params.toString()}`);
  };

  const hasActiveFilters =
    activeShapes.length || activeColors.length || activeClarities.length ||
    priceMin || priceMax || sizeMin || sizeMax ||
    activeWatchGender || activeWatchBrands.length || activeWatchMovements.length ||
    activeWatchStrapTypes.length || activeWatchCaseMaterials.length ||
    activeWatchDialColors.length || activeWatchFeatures.length ||
    activeWatchStyles.length || activeWatchCaseSize ||
    activeCategorySlug || activeSubcategorySlug;

  const activeFilterCount =
    activeShapes.length + activeColors.length + activeClarities.length +
    (priceMin || priceMax ? 1 : 0) + (sizeMin || sizeMax ? 1 : 0) +
    (activeWatchGender ? 1 : 0) + activeWatchBrands.length + activeWatchMovements.length +
    activeWatchStrapTypes.length + activeWatchCaseMaterials.length +
    activeWatchDialColors.length + activeWatchFeatures.length +
    activeWatchStyles.length + (activeWatchCaseSize ? 1 : 0) +
    (activeCategorySlug ? 1 : 0) + (activeSubcategorySlug ? 1 : 0);

  const countFor = (list: FacetCount[] | undefined, id: string) =>
    list?.find((f) => f._id === id)?.count;

  const expandedCategoryData = categories.find((c) => c.slug === expandedCategory);

  const modeIndex = mode === 'diamond' ? 0 : mode === 'gemstone' ? 1 : 2;

  return (
    <div
      className="sticky z-40 w-full border-b"
      style={{ fontFamily: '"Elms Sans", sans-serif', top: 'var(--navbar-height, 64px)', backgroundColor: T.paper, borderColor: T.line }}
    >
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6">
        {/* Tabs + Clear All */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-3">
          <div className="relative flex w-full max-w-[22rem] rounded-full p-1 shrink-0" style={{ backgroundColor: T.goldFaint, border: `1px solid ${T.line}` }}>
            <div
              className="absolute top-1 bottom-1 rounded-full shadow-sm transition-transform duration-300 ease-out"
              style={{ width: 'calc(33.333% - 4px)', left: '2px', backgroundColor: T.ink, transform: `translateX(${modeIndex * 100}%)` }}
            />
            <TabButton active={mode === 'diamond'} onClick={() => switchMode('diamond')} icon={<DiamondIcon active={mode === 'diamond'} />} label="Diamonds" />
            <TabButton active={mode === 'gemstone'} onClick={() => switchMode('gemstone')} icon={<GemstoneIcon active={mode === 'gemstone'} />} label="Gemstones" />
            <TabButton active={mode === 'watch'} onClick={() => switchMode('watch')} icon={<WatchIcon active={mode === 'watch'} />} label="Watches" />
          </div>

          <div className="flex items-center gap-3 ml-auto shrink-0">
            {hasActiveFilters ? (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase text-white px-3.5 py-2 rounded-full shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-px"
                style={{ backgroundColor: T.clear }}
              >
                Clear all
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-[9px] font-bold" style={{ color: T.clear }}>{activeFilterCount}</span>
              </button>
            ) : (
              <span className="text-[9px] tracking-[0.32em] uppercase font-semibold" style={{ color: T.gold }}>Refine your search</span>
            )}
          </div>
        </div>

        {/* Categories */}
        {!categoriesLoading && categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {categories.map((cat) => {
              const active = activeCategorySlug === cat.slug;
              return (
                <button
                  key={cat._id}
                  onClick={() => selectCategory(cat.slug)}
                  className="relative px-4 py-1.5 rounded-full text-[10.5px] font-bold tracking-[0.06em] uppercase border transition-all duration-200"
                  style={active
                    ? { backgroundColor: T.ink, borderColor: T.ink, color: '#fff' }
                    : { backgroundColor: '#fff', borderColor: T.line, color: T.inkSoft }}
                >
                  {cat.name}
                  {active && (
                    <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45" style={{ backgroundColor: T.gold }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Subcategories — shown as image roundels, boutique lookbook style */}
        {expandedCategoryData && expandedCategoryData.subcategories.length > 0 && (
         <div className="flex flex-wrap items-start gap-x-6 gap-y-4 pb-4 pt-1" style={{ borderTop: `1px dashed ${T.line}` }}>
            {expandedCategoryData.subcategories.map((sub) => {
              const active = activeSubcategorySlug === sub.slug;
              return (
                <button
                  key={sub._id}
                  onClick={() => selectSubcategory(expandedCategoryData.slug, sub.slug)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group mt-2"
                >
                  <span
                    className="relative w-16 h-16 rounded-full overflow-hidden transition-all duration-200"
                    style={{
                      padding: active ? 2 : 0,
                      border: active ? `2px solid ${T.gold}` : `1px solid ${T.line}`,
                      boxShadow: active ? '0 4px 14px rgba(156,122,60,0.28)' : 'none',
                    }}
                  >
                    {sub.image ? (
                      <img src={sub.image} alt={sub.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span
                        className="w-full h-full flex items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: `linear-gradient(135deg, ${T.goldSoft}, ${T.line})`, color: T.ink }}
                      >
                        {sub.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span
                    className="text-[10px] font-semibold whitespace-nowrap max-w-[4.5rem] truncate transition-colors"
                    style={{ color: active ? T.ink : T.inkSoft }}
                  >
                    {sub.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters Container */}
        <div className="flex flex-wrap items-start gap-3 pb-5 lg:flex-col lg:flex-nowrap lg:items-stretch">
          {/* === Price + Carat + Availability in ONE ROW === */}
          <div className="flex flex-wrap items-start gap-3 lg:flex-row lg:flex-nowrap lg:w-full">
            <FilterCard label="Price" collapsed={!!collapsed.price} onToggle={() => toggleCollapsed('price')} active={!!(priceMin || priceMax)}>
              <div className="flex flex-wrap gap-1.5 mb-2 max-w-[19rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                {PRICE_BRACKETS.map(({ label, min, max }) => {
                  const isActive = localPriceMin === min && localPriceMax === max;
                  return (
                    <button
                      key={label}
                      onClick={() => applyPriceBracket(min, max)}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10.5px] border transition-all duration-150"
                      style={isActive
                        ? { backgroundColor: T.ink, borderColor: T.ink, color: '#fff', fontWeight: 600 }
                        : { color: T.inkSoft, borderColor: T.line }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <RangeSlider
                min={0} max={100000} step={500}
                valueMin={Number(localPriceMin) || 0}
                valueMax={Number(localPriceMax) || 100000}
                onChange={(lo, hi) => { setLocalPriceMin(String(lo)); setLocalPriceMax(String(hi)); }}
                formatLabel={(v) => `$${v.toLocaleString()}`}
              />
              <div className="flex gap-1.5 my-2 w-56">
                <RangeInput placeholder="Min $" value={localPriceMin} onChange={setLocalPriceMin} />
                <RangeInput placeholder="Max $" value={localPriceMax} onChange={setLocalPriceMax} />
              </div>
              <ApplyButton onClick={applyRanges} small />
            </FilterCard>

            {(mode === 'diamond' || mode === 'gemstone') && (
              <FilterCard label="Carat" collapsed={!!collapsed.carat} onToggle={() => toggleCollapsed('carat')} active={!!(sizeMin || sizeMax)}>
                <div className="w-56">
                  <RangeSlider
                    min={0} max={20} step={0.1}
                    valueMin={Number(localSizeMin) || 0}
                    valueMax={Number(localSizeMax) || 20}
                    onChange={(lo, hi) => { setLocalSizeMin(String(lo)); setLocalSizeMax(String(hi)); }}
                    formatLabel={(v) => `${v.toFixed(1)}ct`}
                  />
                  <div className="flex gap-1.5 mb-2 mt-2">
                    <RangeInput placeholder="Min ct" value={localSizeMin} onChange={setLocalSizeMin} step="0.01" />
                    <RangeInput placeholder="Max ct" value={localSizeMax} onChange={setLocalSizeMax} step="0.01" />
                  </div>
                  <ApplyButton onClick={applyRanges} />
                </div>
              </FilterCard>
            )}

            <FilterCard label="Availability" collapsed={!!collapsed.availability} onToggle={() => toggleCollapsed('availability')} active={searchParams.get('inStock') === 'true'}>
              <CheckItem
                label="In Stock Only"
                checked={searchParams.get('inStock') === 'true'}
                onChange={() => updateFilter('inStock', searchParams.get('inStock') === 'true' ? null : 'true')}
              />
            </FilterCard>
          </div>

          {/* Other Filters */}
          {(mode === 'diamond' || mode === 'gemstone') && (
            <>
              <FilterCard label="Shape" collapsed={!!collapsed.shape} onToggle={() => toggleCollapsed('shape')} active={activeShapes.length > 0} count={activeShapes.length}>
                <div className="flex flex-wrap gap-1.5 max-w-[22rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(SHAPES).map((shape) => (
                    <ShapeOption
                      key={shape}
                      shape={shape}
                      count={facets?.shapes?.find((f) => f._id === shape)?.count}
                      checked={activeShapes.includes(shape)}
                      onChange={() => toggleMultiSelect('shape', activeShapes, shape)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Color" collapsed={!!collapsed.color} onToggle={() => toggleCollapsed('color')} active={activeColors.length > 0} count={activeColors.length}>
                <div className="flex flex-wrap gap-2 max-w-[16rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(DISPLAY_COLORS).map((color) => (
                    <SwatchOption
                      key={color}
                      label={color}
                      swatch={COLOR_SWATCH[color] ?? '#e5e5e5'}
                      count={facets?.colors?.find((f) => f._id === color)?.count}
                      checked={activeColors.includes(color)}
                      onChange={() => toggleMultiSelect('color', activeColors, color)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Clarity" collapsed={!!collapsed.clarity} onToggle={() => toggleCollapsed('clarity')} active={activeClarities.length > 0} count={activeClarities.length}>
                <div className="flex flex-wrap gap-2 max-w-[16rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(CLARITIES).map((clarity) => (
                    <CheckItem
                      key={clarity}
                      label={clarity}
                      count={facets?.clarities?.find((f) => f._id === clarity)?.count}
                      checked={activeClarities.includes(clarity)}
                      onChange={() => toggleMultiSelect('clarity', activeClarities, clarity)}
                    />
                  ))}
                </div>
              </FilterCard>
            </>
          )}

          {mode === 'watch' && (
            <>
              <FilterCard label="Gender" collapsed={!!collapsed.gender} onToggle={() => toggleCollapsed('gender')} active={!!activeWatchGender}>
                <div className="flex flex-wrap gap-2 max-w-[14rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_GENDERS).map((g) => (
                    <CheckItem key={g} label={g} count={countFor(facets?.watchGenders, g)} checked={activeWatchGender === g} onChange={() => updateFilter('watchGender', activeWatchGender === g ? null : g)} />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Brand" collapsed={!!collapsed.brand} onToggle={() => toggleCollapsed('brand')} active={activeWatchBrands.length > 0} count={activeWatchBrands.length}>
                <div className="flex flex-wrap gap-2 max-w-[20rem] max-h-32 overflow-y-auto pr-1 lg:flex-nowrap lg:max-w-none lg:max-h-none lg:overflow-x-auto lg:overflow-y-visible lg:pr-0 lg:pb-1">
                  {dedupe(WATCH_BRANDS).map((b) => (
                    <CheckItem key={b} label={b} count={countFor(facets?.watchBrands, b)} checked={activeWatchBrands.includes(b)} onChange={() => toggleMultiSelect('watchBrand', activeWatchBrands, b)} />
                  ))}
                </div>
              </FilterCard>

              {/* Add remaining watch filters (Movement, Strap, etc.) as needed from your original code */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== All Helper Components ==================== */

function DiamondIcon({ active }: { active: boolean }) {
  return <svg width="11" height="11" viewBox="0 0 18 18" fill="none" style={{ color: active ? 'white' : 'currentColor' }}><path d="M9 16L2 7l2.5-5h9L16 7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M2 7h14M9 16L5 7l4-5 4 5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /></svg>;
}

function GemstoneIcon({ active }: { active: boolean }) {
  return <svg width="11" height="11" viewBox="0 0 18 18" fill="none" style={{ color: active ? 'white' : 'currentColor' }}><path d="M5 3h8l3 4-7 8-7-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M2 7h14M9 15V7M6.5 7 5 3M11.5 7 13 3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /></svg>;
}

function WatchIcon({ active }: { active: boolean }) {
  return <svg width="11" height="11" viewBox="0 0 18 18" fill="none" style={{ color: active ? 'white' : 'currentColor' }}><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.4" /><path d="M9 6v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><rect x="7" y="1.5" width="4" height="2" rx="0.5" stroke="currentColor" strokeWidth="1" /><rect x="7" y="14.5" width="4" height="2" rx="0.5" stroke="currentColor" strokeWidth="1" /></svg>;
}

const SHAPE_PATHS: Record<string, string> = {
  round:            'M9 2.2a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6zM9 4.2v9.6M4.2 9h9.6M5.6 5.6l6.8 6.8M12.4 5.6l-6.8 6.8',
  oval:             'M9 1.8c3.6 0 5.6 3.2 5.6 7.2s-2 7.2-5.6 7.2S3.4 13 3.4 9 5.4 1.8 9 1.8z M9 1.8v14.4M3.4 9h11.2',
  princess:         'M2.5 2.5h13v13h-13z M2.5 2.5l6.5 6.5 6.5-6.5 M2.5 15.5l6.5-6.5 6.5 6.5',
  cushion:          'M9 2.3c3.9 0 6.7 2.8 6.7 6.7s-2.8 6.7-6.7 6.7-6.7-2.8-6.7-6.7 2.8-6.7 6.7-6.7z M9 4.6v8.8M4.6 9h8.8',
  emerald:          'M4 2.5h10l2.5 2.5v8l-2.5 2.5H4L1.5 13V5z M1.5 5h15M1.5 13h15M4 2.5v13M14 2.5v13',
  pear:             'M9 1.6c1.8 2.2 4.6 4.9 4.6 8.2a4.6 4.6 0 1 1-9.2 0c0-3.3 2.8-6 4.6-8.2z',
  marquise:         'M9 1.5C11.5 4 15 6.3 15 9s-3.5 5-6 7.5C6.5 14 3 11.7 3 9s3.5-5 6-7.5z M9 1.5v15',
  radiant:          'M3.2 2.5h11.6l1.7 1.7v9.6l-1.7 1.7H3.2l-1.7-1.7V4.2z M9 2.5v13M1.5 9h15',
  asscher:          'M3.6 2.5h10.8l2.1 2.1v8.8l-2.1 2.1H3.6l-2.1-2.1V4.6z M9 2.5v13M2.5 9h13',
  heart:            'M9 15.5S2 10.8 2 6.4A3.6 3.6 0 0 1 9 5a3.6 3.6 0 0 1 7 1.4c0 4.4-7 9.1-7 9.1z',

  trillion:         'M9 1.8c3 3 6.5 6.4 6.5 12.3H2.5C2.5 8.2 6 4.8 9 1.8z M9 1.8v12.3M2.5 14.1h13',
  triangle:         'M9 2L16 15.5H2z M9 2v13.5M4.7 15.5l4.3-6.7 4.3 6.7',
  baguette:         'M4 5h10v8H4z M4 9h10',
  'tapered-baguette': 'M6.2 5h5.6l1.8 8H4.4z M4.4 13h9.2',
  bullet:           'M4 5h4.5a3.5 4 0 0 1 3.5 4 3.5 4 0 0 1-3.5 4H4z M4 9h4.5',
  kite:             'M9 1.5L15 9L9 16.5L3 9Z M9 1.5v15M3 9h12',
  hexagon:          'M6.2 2h5.6l3.7 7-3.7 7H6.2l-3.7-7z M2.5 9h13',
  octagon:          'M6.5 2h5l3.5 3.5v7l-3.5 3.5h-5L3 12.5v-7z M3 9h12M9 2v14',
  shield:           'M9 1.5c3 0 6 1 6 1v6c0 4-3 7-6 8-3-1-6-4-6-8v-6s3-1 6-1z',
  'rose-cut':       'M9 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M9 2v14M2 9h14M4.5 4.5l9 9M13.5 4.5l-9 9',
  cabochon:         'M2 9a7 5 0 1 0 14 0 7 5 0 1 0-14 0z',
  other:            'M9 16L2 7l2.5-5h9L16 7z M2 7h14M9 16L5 7l4-5 4 5z',
};

function ShapeIcon({ shape }: { shape: string }) {
  const d = SHAPE_PATHS[shape];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      {d ? <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /> : <path d="M9 16L2 7l2.5-5h9L16 7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />}
    </svg>
  );
}

function dialColorToHex(name: string) {
  const map: Record<string, string> = {
    black: '#373737', white: '#f7f7f5', blue: '#3b5a8a', green: '#3d5c45',
    gold: '#c9a552', silver: '#c8c8c8', brown: '#6b4a33', grey: '#8a8a8a', gray: '#8a8a8a',
  };
  return map[name.toLowerCase()] ?? '#d8d8d8';
}

/* Sub-components */
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[9.5px] font-bold tracking-[0.14em] uppercase transition-colors duration-200"
      style={{ color: active ? '#fff' : T.inkSoft }}
    >
      {icon}{label}
    </button>
  );
}

function FilterCard({ label, active, count, collapsed, onToggle, children }: { label: string; active?: boolean; count?: number; collapsed: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 rounded-2xl p-3 transition-all duration-150 lg:w-full lg:shrink"
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${active ? T.gold : T.line}`,
        boxShadow: active ? '0 2px 10px rgba(156,122,60,0.14)' : '0 1px 2px rgba(22,21,19,0.03)',
      }}
    >
      <button onClick={onToggle} className="flex items-center gap-1.5 w-full mb-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap" style={{ color: T.ink }}>{label}</span>
        {!!count && (
          <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-white text-[8px] font-bold" style={{ backgroundColor: T.gold }}>
            {count}
          </span>
        )}
        <svg width="9" height="9" viewBox="0 0 8 8" fill="none" className="ml-auto shrink-0 transition-transform duration-150" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', color: T.inkSoft }}>
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}

function ApplyButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={small ? 'px-4 py-1 text-[9px] font-bold tracking-[0.15em] uppercase rounded-full text-white transition-all duration-150 hover:opacity-90' : 'w-full py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-full text-white transition-all duration-150 hover:opacity-90'}
      style={{ backgroundColor: T.ink }}
    >
      Apply
    </button>
  );
}

function CheckItem({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group py-[3px] whitespace-nowrap">
      <span
        className="w-3.5 h-3.5 flex-shrink-0 rounded-[4px] border flex items-center justify-center transition-all duration-150"
        style={checked ? { backgroundColor: T.ink, borderColor: T.ink } : { borderColor: T.line, backgroundColor: '#fff' }}
      >
        {checked && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><polyline points="1.5,4 3.2,5.8 6.5,2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-[11px] transition-colors leading-snug capitalize" style={{ color: checked ? T.ink : T.inkSoft, fontWeight: checked ? 600 : 400 }}>{label}</span>
      {count !== undefined && <span className="text-[10px]" style={{ color: T.inkSoft, opacity: 0.6 }}>{count}</span>}
    </label>
  );
}

function ShapeOption({ shape, count, checked, onChange }: { shape: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={shape}
      className="flex flex-col items-center gap-1 py-2 px-2 rounded-xl border transition-all duration-150"
      style={checked ? { borderColor: T.gold, backgroundColor: T.goldFaint, color: T.ink } : { borderColor: T.line, color: T.inkSoft }}
    >
      <ShapeIcon shape={shape} />
      <span className="text-[8.5px] uppercase tracking-[0.04em] leading-none capitalize whitespace-nowrap">{shape}</span>
      {count !== undefined && <span className="text-[8px]" style={{ opacity: 0.6 }}>{count}</span>}
    </button>
  );
}

function SwatchOption({ label, swatch, count, checked, onChange }: { label: string; swatch: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={label}
      className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl border transition-all duration-150"
      style={checked ? { borderColor: T.gold, backgroundColor: T.goldFaint } : { borderColor: 'transparent' }}
    >
      <span
        className="w-5 h-5 rounded-full border"
        style={{ backgroundColor: swatch, borderColor: checked ? T.gold : T.line, boxShadow: checked ? `0 0 0 2px ${T.goldFaint}` : 'none' }}
      />
      <span className="text-[8.5px] uppercase tracking-[0.04em] leading-none capitalize whitespace-nowrap" style={{ color: T.inkSoft }}>{label}</span>
      {count !== undefined && <span className="text-[8px]" style={{ color: T.inkSoft, opacity: 0.6 }}>{count}</span>}
    </button>
  );
}

function RangeInput({ placeholder, value, onChange, step = '1' }: { placeholder: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-0 min-w-0 flex-1 px-2 py-1.5 text-[11px] rounded-lg outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      style={{ border: `1px solid ${T.line}`, backgroundColor: '#fff', color: T.ink }}
    />
  );
}

function RangeSlider({ min, max, step, valueMin, valueMax, onChange, formatLabel }: { min: number; max: number; step: number; valueMin: number; valueMax: number; onChange: (lo: number, hi: number) => void; formatLabel: (v: number) => string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'lo' | 'hi' | null>(null);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const valueFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return min;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    return Math.round(raw / step) * step;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const v = valueFromClientX(e.clientX);
      if (dragging.current === 'lo') onChange(Math.min(v, valueMax), valueMax);
      else onChange(valueMin, Math.max(v, valueMin));
    };
    const onUp = () => { dragging.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current || !e.touches[0]) return;
      const v = valueFromClientX(e.touches[0].clientX);
      if (dragging.current === 'lo') onChange(Math.min(v, valueMax), valueMax);
      else onChange(valueMin, Math.max(v, valueMin));
    };
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [valueMin, valueMax, onChange]);

  return (
    <div className="px-1 pt-1 pb-2 w-56">
      <div className="flex justify-between text-[9px] mb-2 font-medium" style={{ color: T.inkSoft }}>
        <span>{formatLabel(valueMin)}</span>
        <span>{formatLabel(valueMax)}</span>
      </div>
      <div ref={trackRef} className="relative h-1.5 rounded-full" style={{ backgroundColor: T.line }}>
        <div className="absolute h-1.5 rounded-full" style={{ left: `${pct(valueMin)}%`, right: `${100 - pct(valueMax)}%`, backgroundColor: T.gold, opacity: 0.5 }} />
        <div onMouseDown={() => { dragging.current = 'lo'; }} onTouchStart={() => { dragging.current = 'lo'; }} className="absolute w-4 h-4 -mt-[7px] -ml-2 top-1/2 rounded-full bg-white border-2 cursor-pointer shadow" style={{ left: `${pct(valueMin)}%`, borderColor: T.gold }} />
        <div onMouseDown={() => { dragging.current = 'hi'; }} onTouchStart={() => { dragging.current = 'hi'; }} className="absolute w-4 h-4 -mt-[7px] -ml-2 top-1/2 rounded-full bg-white border-2 cursor-pointer shadow" style={{ left: `${pct(valueMax)}%`, borderColor: T.gold }} />
      </div>
    </div>
  );
}