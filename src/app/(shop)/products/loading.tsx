// Skeleton for the products listing route (/products?category=...&subcategory=...).
//
// Previously this only rendered a bare grid of 12 square cards in a cream/
// yellow tone (#F5EDD6) — it didn't include the page heading, sort bar, or
// category filter row that the real page always renders above the grid, so
// the layout visibly "jumped" once the real content streamed in. This
// mirrors that structure and uses light grey pulse blocks instead.

const grey = "bg-neutral-200"; // light grey pulse block color

function Bar({ className = "" }: { className?: string }) {
  return <div className={`${grey} rounded ${className}`} />;
}

function ProductCardSkeleton() {
  return (
    <div>
      <div className={`${grey} w-full aspect-square rounded-lg mb-3`} />
      <Bar className="h-3 w-4/5 mb-2" />
      <Bar className="h-2.5 w-2/3 mb-2" />
      <Bar className="h-3 w-1/3" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Top accent line, kept static (not part of the skeleton) */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#B8975A]/40 to-transparent" />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Page heading row: title + sort bar */}
        <div className="mb-6 pb-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <Bar className="h-8 w-40 mb-2" />
            <Bar className="h-2.5 w-56" />
          </div>
          <Bar className="h-8 w-40 rounded-md" />
        </div>

        {/* Category filter dropdown row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>

        {/* Active filter chips row */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="h-6 w-20 rounded-full" />
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-12 sm:mt-16 flex justify-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} className="h-8 w-8 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}