'use client';
import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { SimpleFilterFacets } from '@/services/product.service';

/* ---------------------------------------------------------------------- */
/*  Simple product filter — six plain dropdowns, nothing else.            */
/*  No price, no availability, no icons. Selecting one value narrows      */
/*  every other dropdown to only the options still available for that    */
/*  selection (cascading facets computed server-side, self-excluding —    */
/*  see buildSimpleFilterFacetsPipeline in productFilter.service). Every  */
/*  option list comes straight from the DB; nothing here is static.       */
/* ---------------------------------------------------------------------- */

const T = {
  ink: '#161513',
  inkSoft: '#57534e',
  line: '#e7e3db',
  gold: '#9c7a3c',
};

interface DropdownField {
  key: 'shape' | 'size' | 'color' | 'clarity' | 'approxWeight' | 'numberOfStones';
  label: string;
}

const FIELDS: DropdownField[] = [
  { key: 'shape',          label: 'Shape' },
  { key: 'size',            label: 'Size' },
  { key: 'color',           label: 'Color' },
  { key: 'clarity',        label: 'Clarity' },
  { key: 'approxWeight',    label: 'Approx Weight' },
  { key: 'numberOfStones', label: 'Number Of Stones' },
];

interface SimpleProductFilterProps {
  facets?: SimpleFilterFacets;
}

function formatOption(field: DropdownField['key'], value: string | number): string {
  if (field === 'size') return `${value} ct`;
  return String(value);
}

export default function SimpleProductFilter({ facets }: SimpleProductFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const baseRoute = pathname.includes('/gemstones')
    ? '/products/gemstones'
    : pathname.includes('/diamonds')
      ? '/products/diamonds'
      : '/products';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      value ? params.set(key, value) : params.delete(key);
      params.set('page', '1');
      router.push(`${baseRoute}?${params.toString()}`);
    },
    [router, searchParams, baseRoute]
  );

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    FIELDS.forEach((f) => params.delete(f.key));
    params.set('page', '1');
    router.push(`${baseRoute}?${params.toString()}`);
  };

  const hasActive = FIELDS.some((f) => !!searchParams.get(f.key));

  return (
    <div
      className="w-full bg-white border border-[#EDE3D0] rounded-xl px-4 py-4 sm:px-6"
      style={{ fontFamily: '"Elms Sans", sans-serif' }}
    >
      <div className="flex flex-wrap items-end gap-4 sm:gap-6">
        {FIELDS.map((field) => {
          const options = facets?.[field.key] ?? [];
          const active = searchParams.get(field.key) || '';
          return (
            <div key={field.key} className="flex flex-col gap-1.5 min-w-[150px] flex-1 sm:flex-none">
              <label
                htmlFor={`simple-filter-${field.key}`}
                className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                style={{ color: T.inkSoft }}
              >
                {field.label}:
              </label>
              <select
                id={`simple-filter-${field.key}`}
                value={active}
                onChange={(e) => updateFilter(field.key, e.target.value)}
                className="h-10 px-3 text-[13px] rounded-lg outline-none bg-white transition-colors cursor-pointer"
                style={{
                  border: `1px solid ${active ? T.gold : T.line}`,
                  color: active ? T.ink : T.inkSoft,
                }}
              >
                <option value="">Choose Item</option>
                {options.map((opt) => (
                  <option key={String(opt._id)} value={String(opt._id)}>
                    {formatOption(field.key, opt._id)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        {hasActive && (
          <button
            type="button"
            onClick={clearAll}
            className="h-10 px-4 text-[10px] font-semibold tracking-[0.15em] uppercase rounded-lg border transition-colors"
            style={{ borderColor: T.line, color: T.inkSoft }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}