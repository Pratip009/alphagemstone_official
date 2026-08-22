'use client';

import { useCallback, useMemo, useState } from 'react';
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
// Two presentations share the same state/handlers below the lg breakpoint:
// a permanent sidebar (desktop, >= lg) and a "Filter by" button that opens
// a bottom-sheet drawer (mobile/tablet, < lg) — the sidebar used to be the
// only markup and was `hidden` below lg with nothing replacing it, so the
// filters were simply unreachable on mobile.
export default function DynamicCategoryFilters({ groups }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(groups.slice(0, 4).map((g) => g.filterName))
  );
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(filterName)) next.delete(filterName);
      else next.add(filterName);
      return next;
    });
  };

  if (groups.length === 0) return null;

  const groupsList = (
    <div className="space-y-5">
      {groups.map((group) => {
        const isOpen = openGroups.has(group.filterName);
        const activeCount = selection[group.filterName]?.length ?? 0;

        return (
          <div key={group.filterName} className="border-b border-[#EDE3D0] pb-4">
            <button
              type="button"
              onClick={() => toggleOpen(group.filterName)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-[11px] tracking-[0.15em] uppercase text-[#1A1612] font-medium">
                {group.filterName}
                {activeCount > 0 && (
                  <span className="ml-1.5 text-[#B8975A]">({activeCount})</span>
                )}
              </span>
              <span className="text-[#B8975A] text-xs">{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
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
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => clearGroup(group.filterName)}
                    className="mt-1 text-xs text-[#B8975A] underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ── Mobile / tablet (< lg): trigger button + bottom-sheet drawer ── */}
      <div className="lg:hidden mb-5">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#EDE3D0] bg-white text-[11px] tracking-[0.15em] uppercase text-[#1A1612] font-medium"
          style={{ fontFamily: '"Elms Sans", sans-serif' }}
        >
          <span>
            Filter by
            {totalActive > 0 && <span className="ml-1.5 text-[#B8975A]">({totalActive})</span>}
          </span>
          <span className="text-[#B8975A] text-xs">+</span>
        </button>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            onClick={() => setMobileOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Category filters"
          >
            <div
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2">
                <h2
                  className="text-xs tracking-[0.2em] uppercase text-[#1A1612] font-semibold"
                  style={{ fontFamily: '"Elms Sans", sans-serif' }}
                >
                  Filter by
                </h2>
                <div className="flex items-center gap-4">
                  {totalActive > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-[#B8975A] underline"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="text-xs text-[#1A1612] font-medium"
                    aria-label="Close filters"
                  >
                    Done
                  </button>
                </div>
              </div>

              {groupsList}
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop (>= lg): permanent sidebar ── */}
      <aside
        className="hidden lg:block w-64 shrink-0 border-r border-[#EDE3D0] pr-6"
        aria-label="Category filters"
      >
        <h2
          className="text-xs tracking-[0.2em] uppercase text-[#1A1612] font-semibold mb-4"
          style={{ fontFamily: '"Elms Sans", sans-serif' }}
        >
          Filter by
        </h2>

        {groupsList}
      </aside>
    </>
  );
}