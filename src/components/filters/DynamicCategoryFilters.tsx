'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Option {
  value: string;
  count: number;
  selected: boolean;
}

interface Group {
  filterName: string;
  attributeId: number;
  options: Option[];
}

interface Props {
  groups: Group[];
}

// Renders the category-specific filters imported from
// final_category_filters.csv. Multiple values within one filter (e.g. two
// SHAPE options) are OR'd; selections across different filters (SHAPE +
// COLOR + WEIGHT ...) are AND'd — this only ever writes the URL, matching
// the app's existing "filters live in the URL, server renders the result"
// pattern (see FilterBar.tsx), so back/forward and shareable links keep
// working exactly as they do for the rest of the site's filters.
//
// Presented as a single horizontal row of dropdown buttons that sits above
// the product grid (same "Filter by" trigger works on every screen size,
// including mobile) — previously this was a permanent left sidebar on
// desktop and a bottom-sheet drawer on mobile.
export default function DynamicCategoryFilters({ groups }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selection = useMemo(() => {
    const sel: Record<string, string[]> = {};
    for (const g of groups) {
      sel[g.filterName] = g.options.filter((o) => o.selected).map((o) => o.value);
    }
    return sel;
  }, [groups]);

  const totalActive = useMemo(
    () => Object.values(selection).reduce((sum, vals) => sum + vals.length, 0),
    [selection]
  );

  const toggleValue = useCallback(
    (filterName: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = new Set(
        (params.get(`filter[${filterName}]`) || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );

      if (current.has(value)) current.delete(value);
      else current.add(value);

      const key = `filter[${filterName}]`;
      if (current.size === 0) params.delete(key);
      else params.set(key, Array.from(current).join(','));

      params.delete('page'); // any filter change resets pagination
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearGroup = useCallback(
    (filterName: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(`filter[${filterName}]`);
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    groups.forEach((g) => params.delete(`filter[${g.filterName}]`));
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, groups]);

  const toggleOpen = (filterName: string) => {
    setOpenGroup((prev) => (prev === filterName ? null : filterName));
  };

  // Close whichever dropdown is open on outside click / Escape.
  useEffect(() => {
    if (!openGroup) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGroup]);

  if (groups.length === 0) return null;

  return (
    <div ref={containerRef} className="relative mb-8">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[11px] tracking-[0.2em] uppercase text-[#8A7F72] font-medium mr-1"
          style={{ fontFamily: '"Elms Sans", sans-serif' }}
        >
          Filter by
        </span>

        {groups.map((group) => {
          const isOpen = openGroup === group.filterName;
          const activeCount = selection[group.filterName]?.length ?? 0;

          return (
            <div key={group.filterName} className="relative">
              <button
                type="button"
                onClick={() => toggleOpen(group.filterName)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[11px] tracking-[0.1em] uppercase font-medium transition-colors"
                style={{
                  fontFamily: '"Elms Sans", sans-serif',
                  borderColor: activeCount > 0 || isOpen ? '#B8975A' : '#EDE3D0',
                  color: activeCount > 0 ? '#8A6C38' : '#1A1612',
                  backgroundColor: activeCount > 0 ? '#F5EDD6' : '#fff',
                }}
              >
                <span>{group.filterName}</span>
                {activeCount > 0 && <span className="text-[#B8975A]">({activeCount})</span>}
                <svg
                  width="9" height="9" viewBox="0 0 8 8" fill="none"
                  className="transition-transform duration-150"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                >
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+8px)] z-30 w-64 max-h-80 overflow-y-auto rounded-xl border border-[#EDE3D0] bg-white p-4 shadow-[0_8px_30px_rgba(26,22,18,0.12)]"
                >
                  <div className="space-y-1.5">
                    {group.options.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-sm text-[#3a3530] cursor-pointer hover:text-[#1A1612]"
                      >
                        <input
                          type="checkbox"
                          checked={opt.selected}
                          onChange={() => toggleValue(group.filterName, opt.value)}
                          className="accent-[#B8975A]"
                        />
                        <span className="flex-1">{opt.value}</span>
                        <span className="text-xs text-[#a89c88]">({opt.count})</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#EDE3D0] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => clearGroup(group.filterName)}
                      disabled={activeCount === 0}
                      className="text-xs text-[#B8975A] underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenGroup(null)}
                      className="text-xs text-[#1A1612] font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {totalActive > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] tracking-[0.1em] uppercase text-[#B8975A] underline ml-1"
            style={{ fontFamily: '"Elms Sans", sans-serif' }}
          >
            Clear all ({totalActive})
          </button>
        )}
      </div>
    </div>
  );
}