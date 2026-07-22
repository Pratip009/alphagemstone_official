'use client';
import { useState } from 'react';
import FilterSidebar from '@/components/filters/FilterSidebar';

interface MobileFilterDrawerProps {
  facets: Parameters<typeof FilterSidebar>[0]['facets'];
}

export default function MobileFilterDrawer({ facets }: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border-2 border-violet-500 text-violet-700 text-[10px] font-bold tracking-[0.12em] uppercase px-3.5 py-2 rounded-full bg-gradient-to-br from-violet-50 to-white hover:from-violet-100 shadow-sm hover:shadow transition-all"
      >
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <path d="M1 1h12M3 6h8M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Filters
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-white shadow-[4px_0_24px_rgba(124,58,237,0.18)] transform transition-transform duration-300 ease-in-out flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 shrink-0">
          <span className="font-serif text-base font-medium text-violet-800 tracking-wide">Filters</span>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center border-2 border-violet-200 rounded-full hover:border-violet-500 hover:bg-violet-50 transition-colors"
            aria-label="Close filters"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="#7c3aed" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FilterSidebar facets={facets} />
        </div>

        {/* Done button pinned at bottom */}
        <div className="shrink-0 px-5 py-4 border-t-2 border-violet-100">
          <button
            onClick={() => setOpen(false)}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[10px] font-bold tracking-[0.14em] uppercase py-3 rounded-full hover:from-violet-700 hover:to-fuchsia-700 shadow-sm hover:shadow-md transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}