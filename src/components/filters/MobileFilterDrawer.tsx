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
        className="flex items-center gap-2 border-[1.5px] border-[#0f0f0f] text-[#0f0f0f] text-[10px] font-semibold tracking-[0.12em] uppercase px-3.5 py-2 rounded-[2px] bg-white hover:bg-[#ffffff] transition-colors"
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
        className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-[#ffffff] shadow-[4px_0_24px_rgba(0,0,0,0.12)] transform transition-transform duration-300 ease-in-out flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-[1.5px] border-[#0f0f0f] shrink-0">
          <span className="font-serif text-base font-medium text-[#0f0f0f] tracking-wide">Filters</span>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center border border-[#e8e6e1] rounded-[2px] hover:border-[#0f0f0f] transition-colors"
            aria-label="Close filters"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="#0f0f0f" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FilterSidebar facets={facets} />
        </div>

        {/* Done button pinned at bottom */}
        <div className="shrink-0 px-5 py-4 border-t border-[#e8e6e1]">
          <button
            onClick={() => setOpen(false)}
            className="w-full bg-[#0f0f0f] text-white text-[10px] font-semibold tracking-[0.14em] uppercase py-3 rounded-[2px] hover:opacity-80 transition-opacity"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}