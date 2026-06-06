'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest'               },
  { value: 'price_asc',  label: 'Price: Low to High'   },
  { value: 'price_desc', label: 'Price: High to Low'   },
  { value: 'size_asc',   label: 'Carat: Small to Large' },
  { value: 'size_desc',  label: 'Carat: Large to Small' },
];

export default function SortBar({
  total,
  currentSort,
  query,
}: {
  total: number;
  currentSort?: string;
  query?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const active =
    SORT_OPTIONS.find((o) => o.value === (currentSort || 'newest')) ??
    SORT_OPTIONS[0];

  const handleSort = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('sortBy', value);
    params.set('page', '1');
    router.push(`/products?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div
      className="flex items-center justify-between gap-3 py-3 mb-1"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* ── Left: result count + optional query ─────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {query && (
          <>
            <span className="hidden sm:inline text-[10px] font-medium tracking-[0.18em] uppercase text-[#C4B8A8]">
              Results for
            </span>
            <span
              className="text-sm text-[#4A3F35] italic truncate max-w-[120px] sm:max-w-none"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              &ldquo;{query}&rdquo;
            </span>
            <span className="text-[#D4C4A0] text-xs">·</span>
          </>
        )}

        {/* Count */}
        <span
          className="text-xl sm:text-2xl font-semibold text-[#1A1612] tracking-tight leading-none shrink-0"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {total.toLocaleString()}
        </span>

        <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#B8975A] shrink-0 self-end mb-0.5">
          <span className="hidden xs:inline">pieces</span>
          <span className="xs:hidden">pcs</span>
        </span>
      </div>

      {/* ── Right: sort dropdown ─────────────────────────────────────────── */}
      <div className="relative shrink-0">
        {/* Trigger button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="
            flex items-center gap-2
            bg-white border border-[#EDE3D0]
            text-[#4A3F35] text-[10px] font-semibold tracking-[0.14em] uppercase
            px-3.5 py-2 sm:px-4 rounded-lg
            hover:border-[#B8975A] hover:text-[#8A6C38]
            transition-all duration-150 whitespace-nowrap
            shadow-[0_1px_4px_rgba(184,151,90,0.06)]
          "
        >
          {/* Sort lines icon */}
          <svg
            width="12" height="9" viewBox="0 0 12 9" fill="none"
            className="shrink-0 text-[#B8975A]"
          >
            <path
              d="M1 1h10M2.5 4.5h7M4.5 8h3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>

          <span className="hidden sm:inline">{active.label}</span>
          <span className="sm:hidden">Sort</span>

          {/* Chevron */}
          <svg
            width="8" height="5" viewBox="0 0 8 5" fill="none"
            className={`shrink-0 transition-transform duration-200 text-[#B8975A] ${
              open ? 'rotate-180' : ''
            }`}
          >
            <path
              d="M1 1l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Dropdown panel */}
        {open && (
          <>
            {/* Click-away backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />

            <div
              className="
                absolute right-0 top-full mt-2 z-20
                bg-white border border-[#EDE3D0] rounded-xl overflow-hidden
                min-w-[200px]
                shadow-[0_8px_32px_rgba(184,151,90,0.12)]
              "
            >
              {/* Panel header */}
              <div className="px-4 py-2.5 border-b border-[#EDE3D0] bg-[#FAF7F1]">
                <span className="text-[9px] font-semibold tracking-[0.28em] uppercase text-[#C4B8A8]">
                  Sort by
                </span>
              </div>

              {SORT_OPTIONS.map((opt) => {
                const isActive = opt.value === active.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSort(opt.value)}
                    className={`
                      w-full text-left px-4 py-2.5
                      text-[11px] font-medium tracking-[0.04em]
                      flex items-center justify-between gap-3
                      transition-colors duration-100
                      border-b border-[#F5EDD6] last:border-0
                      ${isActive
                        ? 'bg-[#F5EDD6] text-[#8A6C38]'
                        : 'text-[#8A7F72] hover:bg-[#FAF7F1] hover:text-[#1A1612]'
                      }
                    `}
                  >
                    {opt.label}

                    {/* Gold circle checkmark for active option */}
                    {isActive && (
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#B8975A] flex items-center justify-center">
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path
                            d="M1 3.5l2 2.5L7 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}