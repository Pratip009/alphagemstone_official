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

// Swatch colors for the Color Grade section — purely visual, doesn't affect the value sent.
const COLOR_SWATCH: Record<string, string> = {
  D: '#fbfbfa', E: '#fbfbfa', F: '#fbfbfa', G: '#f8f6ee', H: '#f5f1e2',
  I: '#f1ead2', J: '#ece2c0', K: '#e6d7a9',
  'fancy-yellow': '#e8cf5a', 'fancy-pink': '#e7b3bd', 'fancy-blue': '#a9c6d8',
};

// dedupe helper — guards against duplicate values in the model's constant arrays
// (e.g. "other" listed twice), which otherwise produce duplicate React keys.
const dedupe = <T,>(arr: readonly T[]): T[] => Array.from(new Set(arr));

interface FacetCount { _id: string; count: number }

interface CategoryWithSubs {
  _id: string;
  name: string;
  slug: string;
  subcategories: { _id: string; name: string; slug: string }[];
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
  /**
   * Pre-fetched categories (with nested subcategories). Optional — if not
   * supplied, the bar fetches them itself from GET /api/categories?withSubcategories=true.
   * Passing this from a server component avoids a client-side waterfall.
   */
  categories?: CategoryWithSubs[];
}

const PRICE_BRACKETS = [
  { label: 'Under $1,000',      min: '',      max: '1000'  },
  { label: '$1,000 – $5,000',   min: '1000',  max: '5000'  },
  { label: '$5,000 – $15,000',  min: '5000',  max: '15000' },
  { label: '$15,000 – $50,000', min: '15000', max: '50000' },
  { label: 'Over $50,000',      min: '50000', max: ''      },
];

// ─── Single vibrant accent theme ────────────────────────────────────────────
// One consistent color story for the whole bar (violet → fuchsia), used
// everywhere instead of a different hue per filter group.
const ACCENT = {
  border:        'border-gray-200',
  borderHover:   'hover:border-gray-600',
  from:          'from-gray-50',
  text:          'text-black',
  dot:           'bg-gray-600',
  badge:         'bg-gray-600',
  solid:         'bg-gray-600',
  chipActive:    'bg-gray-600 border-gray-600 text-white',
  ring:          'focus:ring-gray-300',
  track:         'bg-gray-600/20',
  handle:        'border-gray-600',
  checkedBorder: 'border-gray-600',
  swatchRing:    'ring-gray-400',
};

export default function FilterBar({ productType = 'diamond', facets, categories: categoriesProp }: FilterBarProps) {
  const router       = useRouter();
  const pathname     = usePathname();
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

  // ── Category / subcategory taxonomy — fetched dynamically, never hardcoded ──
  const [categories, setCategories] = useState<CategoryWithSubs[]>(categoriesProp ?? []);
  const [categoriesLoading, setCategoriesLoading] = useState(!categoriesProp);

  // Which category's subcategory row is expanded — defaults to the active
  // one from the URL, or otherwise the first category, so the subcategory
  // row is visible right away (e.g. on the default Diamonds tab) instead of
  // requiring a click first.
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    activeCategorySlug || (categoriesProp && categoriesProp.length > 0 ? categoriesProp[0].slug : null)
  );

  useEffect(() => {
    if (categoriesProp) return; // already supplied by the server component
    let cancelled = false;
    setCategoriesLoading(true);
    setExpandedCategory(activeCategorySlug || null);
    (async () => {
      try {
        // Scoped to the active tab — a category only shows up here if it
        // actually contains a product of this kind, so Diamond categories
        // never leak into the Gemstones tab and vice versa.
        const res = await fetch(`/api/categories?withSubcategories=true&productKind=${mode}`);
        const json = await res.json();
        const list: CategoryWithSubs[] = (json?.data ?? json ?? []).map((c: any) => ({
          _id: c._id,
          name: c.name,
          slug: c.slug,
          subcategories: (c.subcategories ?? []).map((s: any) => ({ _id: s._id, name: s.name, slug: s.slug })),
        }));
        if (!cancelled) {
          setCategories(list);
          // No category selected yet (default state, e.g. the Diamonds tab
          // on first load) — expand the first one so its subcategories are
          // visible immediately instead of being hidden until a click.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesProp, mode]);

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

  // NOTE: filters no longer live in popovers — every group renders inline,
  // all the time, on every screen size. No open/close state is needed for
  // that anymore. We keep one tiny bit of state purely so a person can
  // collapse an individual card if they want a shorter page — but nothing
  // is ever hidden behind a dropdown or a "Filters" button.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    price: true, shape: true, color: true, clarity: true, carat: true,
    gender: true, brand: true, movement: true, strap: true, caseMaterial: true,
    dialColor: true, features: true, style: true, caseSize: true, availability: true,
  });
  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

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

  // Selecting a category: set ?category=<slug>, clear subcategory, expand its row.
  const selectCategory = (slug: string) => {
    if (expandedCategory === slug) {
      // second click on an already-selected category collapses it, doesn't clear the filter
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
    if (activeSubcategorySlug === subSlug) {
      params.delete('subcategory');
    } else {
      params.set('subcategory', subSlug);
    }
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

  return (
    <div
      className="sticky z-40 w-full bg-white shadow-sm"
      // The site nav (Navbar.tsx) is itself `position: sticky; top: 0` and
      // maintains a `--navbar-height` CSS var (its own bottom edge) for
      // exactly this situation. Sticking this bar at top:0 too would pin it
      // to the same spot as the nav, and — since the nav has a higher
      // z-index — the nav would render on top of it.
      style={{ fontFamily: '"Elms Sans", sans-serif', top: 'var(--navbar-height, 64px)' }}
    >
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6">

        {/* ── Row 1: product-kind tabs + clear all ─────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex rounded-xl overflow-hidden border-2 border-gray-200 bg-white shrink-0 shadow-sm">
            <TabButton active={mode === 'diamond'}  onClick={() => switchMode('diamond')}  icon={<DiamondIcon active={mode === 'diamond'} />}  label="Diamonds" />
            <div className="w-px bg-gray-200" />
            <TabButton active={mode === 'gemstone'} onClick={() => switchMode('gemstone')} icon={<GemstoneIcon active={mode === 'gemstone'} />} label="Gemstones" />
            <div className="w-px bg-gray-200" />
            <TabButton active={mode === 'watch'}    onClick={() => switchMode('watch')}    icon={<WatchIcon active={mode === 'watch'} />}      label="Watches" />
          </div>

          <div className="flex items-center gap-3 ml-auto shrink-0">
            {hasActiveFilters ? (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase text-white bg-gradient-to-r from-gray-600 to-gray-600 px-3 py-1.5 rounded-full shadow-sm hover:shadow-md hover:from-gray-700 hover:to-gray-700 transition-all duration-150"
              >
                Clear all
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              </button>
            ) : (
              <span className="text-[9px] tracking-[0.35em] uppercase font-bold text-violet-400">
                Refine your search
              </span>
            )}
          </div>
        </div>

        {/* ── Row 2: categories (dynamic, fetched from /api/categories) ────── */}
        {!categoriesLoading && categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3 -mt-1">
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => selectCategory(cat.slug)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.08em] uppercase border-2 transition-all duration-150 ${
                  activeCategorySlug === cat.slug
                    ? `${ACCENT.chipActive} shadow-md`
                    : `bg-white text-gray-500 border-gray-200 ${ACCENT.borderHover} hover:text-violet-700`
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Row 3: subcategories of the expanded category, revealed inline ─ */}
        {expandedCategoryData && expandedCategoryData.subcategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3 pl-3 border-l-4 border-violet-300 ml-1 -mt-1 animate-[fadeIn_150ms_ease-out]">
            {expandedCategoryData.subcategories.map((sub) => (
              <button
                key={sub._id}
                onClick={() => selectSubcategory(expandedCategoryData.slug, sub.slug)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-[0.04em] border-2 transition-all duration-150 ${
                  activeSubcategorySlug === sub.slug
                    ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                    : 'text-violet-500 border-violet-100 bg-violet-50/60 hover:border-violet-400'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Row 4: every filter, shown inline, all the time ────────────────
             No popovers, no "Filters" button, no drawer. On phone/tablet,
             cards sit in a wrapping row (unchanged from before). On desktop
             (lg+), each card stacks into its own full-width row — Price on
             its own row, then Shape on its own row, and so on. ─────────── */}
        <div className="flex flex-wrap items-start gap-3 pb-4 lg:flex-col lg:flex-nowrap lg:items-stretch">

          <FilterCard label="Price" collapsed={!!collapsed.price} onToggle={() => toggleCollapsed('price')}
            active={!!(priceMin || priceMax)}>
            <div className="flex flex-wrap gap-1.5 mb-2 max-w-[19rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
              {PRICE_BRACKETS.map(({ label, min, max }) => {
                const isActive = localPriceMin === min && localPriceMax === max
                  && (priceMin === min || priceMax === max);
                return (
                  <button
                    key={label}
                    onClick={() => applyPriceBracket(min, max)}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[10.5px] border-2 transition-all duration-150 ${
                      isActive
                        ? `${ACCENT.solid} text-white border-transparent font-semibold`
                        : 'text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                    }`}
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
            <>
              <FilterCard label="Shape" collapsed={!!collapsed.shape} onToggle={() => toggleCollapsed('shape')}
                active={activeShapes.length > 0} count={activeShapes.length}>
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

              <FilterCard label="Color" collapsed={!!collapsed.color} onToggle={() => toggleCollapsed('color')}
                active={activeColors.length > 0} count={activeColors.length}>
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

              <FilterCard label="Clarity" collapsed={!!collapsed.clarity} onToggle={() => toggleCollapsed('clarity')}
                active={activeClarities.length > 0} count={activeClarities.length}>
                <div className="flex flex-wrap gap-2 max-w-[16rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(CLARITIES).map((clarity) => (
                    <CheckItem
                      key={clarity} label={clarity}
                      count={facets?.clarities?.find((f) => f._id === clarity)?.count}
                      checked={activeClarities.includes(clarity)}
                      onChange={() => toggleMultiSelect('clarity', activeClarities, clarity)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Carat" collapsed={!!collapsed.carat} onToggle={() => toggleCollapsed('carat')}
                active={!!(sizeMin || sizeMax)}>
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
            </>
          )}

          {mode === 'watch' && (
            <>
              <FilterCard label="Gender" collapsed={!!collapsed.gender} onToggle={() => toggleCollapsed('gender')}
                active={!!activeWatchGender}>
                <div className="flex flex-wrap gap-2 max-w-[14rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_GENDERS).map((g) => (
                    <CheckItem
                      key={g} label={g}
                      count={countFor(facets?.watchGenders, g)}
                      checked={activeWatchGender === g}
                      onChange={() => updateFilter('watchGender', activeWatchGender === g ? null : g)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Brand" collapsed={!!collapsed.brand} onToggle={() => toggleCollapsed('brand')}
                active={activeWatchBrands.length > 0} count={activeWatchBrands.length}>
                <div className="flex flex-wrap gap-2 max-w-[20rem] max-h-32 overflow-y-auto pr-1 lg:flex-nowrap lg:max-w-none lg:max-h-none lg:overflow-x-auto lg:overflow-y-visible lg:pr-0 lg:pb-1">
                  {dedupe(WATCH_BRANDS).map((b) => (
                    <CheckItem
                      key={b} label={b}
                      count={countFor(facets?.watchBrands, b)}
                      checked={activeWatchBrands.includes(b)}
                      onChange={() => toggleMultiSelect('watchBrand', activeWatchBrands, b)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Movement" collapsed={!!collapsed.movement} onToggle={() => toggleCollapsed('movement')}
                active={activeWatchMovements.length > 0} count={activeWatchMovements.length}>
                <div className="flex flex-wrap gap-2 max-w-[16rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_MOVEMENTS).map((m) => (
                    <CheckItem
                      key={m} label={m}
                      count={countFor(facets?.watchMovements, m)}
                      checked={activeWatchMovements.includes(m)}
                      onChange={() => toggleMultiSelect('watchMovement', activeWatchMovements, m)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Strap" collapsed={!!collapsed.strap} onToggle={() => toggleCollapsed('strap')}
                active={activeWatchStrapTypes.length > 0} count={activeWatchStrapTypes.length}>
                <div className="flex flex-wrap gap-2 max-w-[16rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_STRAP_TYPES).map((s) => (
                    <CheckItem
                      key={s} label={s}
                      count={countFor(facets?.watchStrapTypes, s)}
                      checked={activeWatchStrapTypes.includes(s)}
                      onChange={() => toggleMultiSelect('watchStrapType', activeWatchStrapTypes, s)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Case Material" collapsed={!!collapsed.caseMaterial} onToggle={() => toggleCollapsed('caseMaterial')}
                active={activeWatchCaseMaterials.length > 0} count={activeWatchCaseMaterials.length}>
                <div className="flex flex-wrap gap-2 max-w-[16rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_CASE_MATERIALS).map((m) => (
                    <CheckItem
                      key={m} label={m}
                      count={countFor(facets?.watchCaseMaterials, m)}
                      checked={activeWatchCaseMaterials.includes(m)}
                      onChange={() => toggleMultiSelect('watchCaseMaterial', activeWatchCaseMaterials, m)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Dial Color" collapsed={!!collapsed.dialColor} onToggle={() => toggleCollapsed('dialColor')}
                active={activeWatchDialColors.length > 0} count={activeWatchDialColors.length}>
                <div className="flex flex-wrap gap-2 max-w-[14rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_DIAL_COLORS).map((c) => (
                    <SwatchOption
                      key={c}
                      label={c}
                      swatch={dialColorToHex(c)}
                      count={countFor(facets?.watchDialColors, c)}
                      checked={activeWatchDialColors.includes(c)}
                      onChange={() => toggleMultiSelect('watchDialColor', activeWatchDialColors, c)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Features" collapsed={!!collapsed.features} onToggle={() => toggleCollapsed('features')}
                active={activeWatchFeatures.length > 0} count={activeWatchFeatures.length}>
                <div className="flex flex-wrap gap-2 max-w-[18rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_FEATURES).map((f) => (
                    <CheckItem
                      key={f} label={f}
                      count={countFor(facets?.watchFeatures, f)}
                      checked={activeWatchFeatures.includes(f)}
                      onChange={() => toggleMultiSelect('watchFeatures', activeWatchFeatures, f)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Style" collapsed={!!collapsed.style} onToggle={() => toggleCollapsed('style')}
                active={activeWatchStyles.length > 0} count={activeWatchStyles.length}>
                <div className="flex flex-wrap gap-2 max-w-[14rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_STYLES).map((s) => (
                    <CheckItem
                      key={s} label={s}
                      count={countFor(facets?.watchStyles, s)}
                      checked={activeWatchStyles.includes(s)}
                      onChange={() => toggleMultiSelect('watchStyle', activeWatchStyles, s)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard label="Case Size" collapsed={!!collapsed.caseSize} onToggle={() => toggleCollapsed('caseSize')}
                active={!!activeWatchCaseSize}>
                <div className="flex flex-wrap gap-2 max-w-[14rem] lg:flex-nowrap lg:max-w-none lg:overflow-x-auto lg:pb-1">
                  {dedupe(WATCH_CASE_SIZES).map((sz) => (
                    <CheckItem
                      key={sz} label={sz}
                      count={countFor(facets?.watchCaseSizes, sz)}
                      checked={activeWatchCaseSize === sz}
                      onChange={() => updateFilter('watchCaseSize', activeWatchCaseSize === sz ? null : sz)}
                    />
                  ))}
                </div>
              </FilterCard>
            </>
          )}

          <FilterCard label="Availability" collapsed={!!collapsed.availability} onToggle={() => toggleCollapsed('availability')}
            active={searchParams.get('inStock') === 'true'}>
            <CheckItem
              label="In Stock Only"
              checked={searchParams.get('inStock') === 'true'}
              onChange={() =>
                updateFilter('inStock', searchParams.get('inStock') === 'true' ? null : 'true')
              }
            />
          </FilterCard>
        </div>
      </div>
    </div>
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

function GemstoneIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 18 18" fill="none"
      style={{ color: active ? 'white' : 'currentColor' }}>
      <path d="M5 3h8l3 4-7 8-7-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 7h14M9 15V7M6.5 7 5 3M11.5 7 13 3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
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

// Small per-shape glyph for the Shape icon picker. Falls back to a generic
// diamond outline for shapes without a bespoke path (bullet, kite, rose-cut, …).
const SHAPE_PATHS: Record<string, string> = {
  round:     'M9 2a7 7 0 100 14 7 7 0 000-14z',
  oval:      'M9 2C5.5 2 3 5 3 9s2.5 7 6 7 6-3 6-7-2.5-7-6-7z',
  princess:  'M2 2h14v14H2z',
  cushion:   'M3 3h12v12H3z',
  emerald:   'M3 4h12v10H3z',
  pear:      'M9 2c3 3 6 6 6 9a6 6 0 11-12 0c0-3 3-6 6-9z',
  marquise:  'M9 2c3 2.5 5 5 5 7s-2 4.5-5 7c-3-2.5-5-5-5-7s2-4.5 5-7z',
  radiant:   'M4 3h10l3 3v6l-3 3H4l-3-3V6z',
  asscher:   'M4 3h10l3 3v6l-3 3H4l-3-3V6z',
  heart:     'M9 15S2 10 2 6a4 4 0 018-1 4 4 0 018 1c0 4-7 9-9 9z',
  triangle:  'M9 2l7 13H2z',
  hexagon:   'M6 2h6l4 7-4 7H6l-4-7z',
  octagon:   'M6 2h6l4 4v6l-4 4H6l-4-4V6z',
};

function ShapeIcon({ shape }: { shape: string }) {
  const d = SHAPE_PATHS[shape];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      {d
        ? <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        : <path d="M9 16L2 7l2.5-5h9L16 7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />}
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-[9px] font-bold tracking-[0.18em] uppercase transition-all duration-200 ${
        active
          ? 'bg-gray-700 text-white rounded-lg m-0.5 shadow-sm'
          : 'text-gray-700 hover:text-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Always-visible filter card — replaces the old click-to-open popover pill.
// Cards sit side by side in a single wrapping row (not a fixed-column grid),
// and every group is fully rendered on the page at all times, on every
// screen size. The little chevron only collapses *this card's own body* —
// it never hides the group from the layout, and there's no "Filters"
// button or drawer gating access to it.
function FilterCard({
  label, active, count, collapsed, onToggle, children,
}: {
  label: string;
  active?: boolean;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`shrink-0 rounded-xl border-2 bg-gradient-to-br ${ACCENT.from} to-white p-2.5 shadow-sm transition-all duration-150 lg:w-full lg:shrink ${
        active ? `${ACCENT.border} shadow-md` : `border-gray-100`
      }`}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full mb-1.5"
      >
        <span className={`w-2 h-2 rounded-full ${ACCENT.dot} shrink-0`} />
        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${ACCENT.text} whitespace-nowrap`}>
          {label}
        </span>
        {!!count && (
          <span className={`flex items-center justify-center w-4 h-4 rounded-full ${ACCENT.badge} text-white text-[8px] font-bold`}>
            {count}
          </span>
        )}
        <svg
          width="9" height="9" viewBox="0 0 8 8" fill="none"
          className={`ml-auto shrink-0 transition-transform duration-150 ${ACCENT.text}`}
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}
        >
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
      className={
        small
          ? `px-4 py-1 text-[9px] font-bold tracking-[0.15em] uppercase rounded-md text-white ${ACCENT.solid} opacity-90 hover:opacity-100 transition-all duration-150`
          : `w-full py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-md text-white ${ACCENT.solid} opacity-90 hover:opacity-100 transition-all duration-150`
      }
    >
      Apply
    </button>
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
    <label className="flex items-center gap-1.5 cursor-pointer group py-[3px] whitespace-nowrap">
      <span
        className={`w-3.5 h-3.5 flex-shrink-0 rounded-[3px] border-2 flex items-center justify-center transition-all duration-150 ${
          checked ? `${ACCENT.dot} ${ACCENT.checkedBorder}` : `border-gray-200 bg-white ${ACCENT.borderHover}`
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
        className={`text-[11px] transition-colors leading-snug capitalize ${
          checked ? `${ACCENT.text} font-semibold` : 'text-gray-500 group-hover:text-gray-800'
        }`}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] text-gray-400">{count}</span>
      )}
    </label>
  );
}

// Icon-based option used in the Shape section.
function ShapeOption({
  shape, count, checked, onChange,
}: {
  shape: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      title={shape}
      className={`flex flex-col items-center gap-1 py-2 px-2 rounded-md border-2 transition-all duration-150 ${
        checked
          ? `border-violet-400 ${ACCENT.from} ${ACCENT.text}`
          : `border-gray-100 text-gray-400 ${ACCENT.borderHover} hover:text-violet-700`
      }`}
    >
      <ShapeIcon shape={shape} />
      <span className="text-[8.5px] uppercase tracking-[0.04em] leading-none capitalize whitespace-nowrap">{shape}</span>
      {count !== undefined && <span className="text-[8px] text-gray-400">{count}</span>}
    </button>
  );
}

// Swatch-based option used for Color Grade / Dial Color sections.
function SwatchOption({
  label, swatch, count, checked, onChange,
}: {
  label: string;
  swatch: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      title={label}
      className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-md border-2 transition-all duration-150 ${
        checked ? `border-violet-400 ${ACCENT.from}` : 'border-transparent hover:border-gray-200'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full border ${checked ? `ring-2 ${ACCENT.swatchRing} ring-offset-1` : 'border-gray-200'}`}
        style={{ backgroundColor: swatch }}
      />
      <span className="text-[8.5px] uppercase tracking-[0.04em] text-gray-500 leading-none capitalize whitespace-nowrap">{label}</span>
      {count !== undefined && <span className="text-[8px] text-gray-400">{count}</span>}
    </button>
  );
}

function RangeInput({
  placeholder, value, onChange, step = '1',
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-0 min-w-0 flex-1 px-2 py-1.5 text-[11px] border-2 border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-300 ${ACCENT.ring} focus:ring-2 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}

// Minimal dual-handle range slider — no external deps, drag either handle.
function RangeSlider({
  min, max, step, valueMin, valueMax, onChange, formatLabel,
}: {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (lo: number, hi: number) => void;
  formatLabel: (v: number) => string;
}) {
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
    // Touch support so dragging works the same way on mobile and tablets.
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
      <div className="flex justify-between text-[9px] text-gray-500 mb-2 font-medium">
        <span>{formatLabel(valueMin)}</span>
        <span>{formatLabel(valueMax)}</span>
      </div>
      <div ref={trackRef} className="relative h-1.5 rounded-full bg-gray-200">
        <div
          className={`absolute h-1.5 rounded-full ${ACCENT.track}`}
          style={{ left: `${pct(valueMin)}%`, right: `${100 - pct(valueMax)}%` }}
        />
        <div
          onMouseDown={() => { dragging.current = 'lo'; }}
          onTouchStart={() => { dragging.current = 'lo'; }}
          className={`absolute w-4 h-4 -mt-[7px] -ml-2 top-1/2 rounded-full bg-white border-2 cursor-pointer shadow ${ACCENT.handle}`}
          style={{ left: `${pct(valueMin)}%` }}
        />
        <div
          onMouseDown={() => { dragging.current = 'hi'; }}
          onTouchStart={() => { dragging.current = 'hi'; }}
          className={`absolute w-4 h-4 -mt-[7px] -ml-2 top-1/2 rounded-full bg-white border-2 cursor-pointer shadow ${ACCENT.handle}`}
          style={{ left: `${pct(valueMax)}%` }}
        />
      </div>
    </div>
  );
}