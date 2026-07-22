'use client';
import { useState } from 'react';
import FilterBar from '@/components/filters/FilterBar'; // ← Updated import

interface MobileFilterDrawerProps {
  facets?: Parameters<typeof FilterBar>[0]['facets'];
  categories?: Parameters<typeof FilterBar>[0]['categories'];
  productType?: Parameters<typeof FilterBar>[0]['productType'];
}

export default function MobileFilterDrawer({ 
  facets, 
  categories, 
  productType = 'diamond' 
}: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border-2 border-violet-500 text-violet-700 text-[10px] font-bold tracking-[0.12em] uppercase px-3.5 py-2 rounded-full bg-gradient-to-br from-violet-50 to-white hover:from-violet-100 shadow-sm hover:shadow transition-all active:scale-95"
      >
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <path d="M1 1h12M3 6h8M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Filters
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-[60] w-[300px] max-w-[85vw] bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-white shrink-0">
          <span className="font-serif text-lg font-medium text-gray-900">Filters</span>
          <button
            onClick={() => setOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close filters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 18L18 6M6 6h12v12" />
            </svg>
          </button>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <FilterBar 
            productType={productType}
            facets={facets}
            categories={categories}
          />
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-4 border-t border-gray-100 bg-white">
          <button
            onClick={() => setOpen(false)}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold tracking-wider uppercase py-3.5 rounded-2xl hover:from-violet-700 hover:to-fuchsia-700 transition-all active:scale-[0.985]"
          >
            Show Results
          </button>
        </div>
      </div>
    </>
  );
}