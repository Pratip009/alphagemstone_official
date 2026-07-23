'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import FilterBar from '@/components/filters/FilterBar';

interface MobileFilterDrawerProps {
  facets?: Parameters<typeof FilterBar>[0]['facets'];
  categories?: Parameters<typeof FilterBar>[0]['categories'];
  productType?: Parameters<typeof FilterBar>[0]['productType'];
}

const T = {
  ink: '#161513',
  inkSoft: '#57534e',
  paper: '#ffffff',
  line: '#e7e3db',
  gold: '#9c7a3c',
  goldDeep: '#7c5f2c',
  goldSoft: '#f3ead3',
  goldFaint: '#faf6ea',
};

export default function MobileFilterDrawer({
  facets,
  categories,
  productType = 'diamond',
}: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  // Count active filters across every recognised param, for the trigger badge
  const activeCount = (() => {
    const multiKeys = [
      'shape', 'color', 'clarity', 'watchBrand', 'watchMovement',
      'watchStrapType', 'watchCaseMaterial', 'watchDialColor',
      'watchFeatures', 'watchStyle',
    ];
    const singleKeys = ['watchGender', 'watchCaseSize', 'category', 'subcategory', 'inStock'];
    let count = 0;
    multiKeys.forEach((k) => {
      count += searchParams.get(k)?.split(',').filter(Boolean).length ?? 0;
    });
    singleKeys.forEach((k) => {
      if (searchParams.get(k)) count += 1;
    });
    if (searchParams.get('priceMin') || searchParams.get('priceMax')) count += 1;
    if (searchParams.get('sizeMin') || searchParams.get('sizeMax')) count += 1;
    return count;
  })();

  const close = useCallback(() => setOpen(false), []);

  // Lock body scroll + handle Escape while drawer is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Mount the backdrop/panel only once opened at least once, so the
  // transition classes have something to transition *from*.
  useEffect(() => { if (open) setMounted(true); }, [open]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-2 rounded-full px-4 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.97]"
        style={{ border: `1px solid ${T.line}`, backgroundColor: '#fff', color: T.ink }}
      >
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <path d="M1 1h12M3 6h8M5 11h4" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span
            className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold"
            style={{ backgroundColor: T.gold }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {mounted && (
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            className="fixed inset-0 z-50 transition-opacity duration-300 ease-out"
            style={{
              backgroundColor: 'rgba(22,21,19,0.45)',
              backdropFilter: 'blur(2px)',
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
            }}
          />

          {/* Slide-in Drawer */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className={`fixed inset-y-0 left-0 z-[60] w-[320px] max-w-[88vw] flex flex-col rounded-r-3xl transition-transform duration-300 ease-out ${
              open ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ backgroundColor: T.paper, boxShadow: '8px 0 32px rgba(22,21,19,0.18)' }}
          >
            {/* Gold accent line */}
            <div className="h-1 w-full shrink-0 rounded-tr-3xl" style={{ background: `linear-gradient(90deg, ${T.gold}, ${T.goldSoft})` }} />

            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: `1px solid ${T.line}`, backgroundColor: T.goldFaint }}
            >
              <div>
                <span className="block text-[15px] font-semibold tracking-tight" style={{ color: T.ink }}>
                  Refine your search
                </span>
                <span className="text-[9px] tracking-[0.22em] uppercase font-semibold" style={{ color: T.gold }}>
                  {activeCount > 0 ? `${activeCount} active` : 'No filters applied'}
                </span>
              </div>
              <button
                onClick={close}
                aria-label="Close filters"
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-150 hover:brightness-95"
                style={{ backgroundColor: '#fff', border: `1px solid ${T.line}` }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.inkSoft} strokeWidth="2" strokeLinecap="round">
                  <path d="M6 18L18 6M6 6h12v12" />
                </svg>
              </button>
            </div>

            {/* Filter Content */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <FilterBar
                productType={productType}
                facets={facets}
                categories={categories}
              />
            </div>

            {/* Footer Actions */}
            <div
              className="shrink-0 flex items-center gap-2 p-4"
              style={{ borderTop: `1px solid ${T.line}`, backgroundColor: '#fff' }}
            >
              <button
                onClick={close}
                className="flex-1 py-3 rounded-2xl text-[11px] font-bold tracking-[0.18em] uppercase text-white transition-all duration-150 active:scale-[0.98]"
                style={{ backgroundColor: T.ink }}
              >
                Show Results
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}