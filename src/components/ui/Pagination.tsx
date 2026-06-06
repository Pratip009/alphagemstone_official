'use client';
import { useRouter } from 'next/navigation';

export default function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string>;
}) {
  const router = useRouter();

  if (totalPages <= 1) return null;

  const goTo = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    router.push(`/products?${params.toString()}`);
  };

  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page === 1}
        className="btn-secondary px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => goTo(p)}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            p === page
              ? 'bg-amber-500 text-black font-bold'
              : 'border border-neutral-700 text-neutral-400 hover:border-neutral-400'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => goTo(page + 1)}
        disabled={page === totalPages}
        className="btn-secondary px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        →
      </button>
    </div>
  );
}
