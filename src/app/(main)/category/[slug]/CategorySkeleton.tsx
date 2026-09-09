// Shared skeleton for the category browsing routes:
//   /category/[slug]            (e.g. /category/precious-gems)
//   /category/[slug]/[subSlug]  (e.g. /category/precious-gems/emerald)
//
// Both routes render the same CategoryClientPage layout (hero banner,
// breadcrumb, optional description section, toolbar + search, and a grid
// of circular subcategory cards) — so they share one skeleton here instead
// of each loading.tsx drifting out of sync with the real markup.
//
// Previously each route's loading.tsx was just a page title bar + a grid of
// *square* placeholders in a yellow tone (#F5EDD6). The real cards are
// circular thumbnails with a centered text label underneath, and the page
// also has a hero banner, breadcrumb, and toolbar above the grid that
// weren't represented at all. This mirrors the actual layout and uses light
// grey pulse blocks (a soft white/translucent block on the dark hero, since
// grey-on-navy would be invisible).

const grey = "bg-neutral-200"; // light grey pulse block color (light backgrounds)
const onDark = "bg-white/15"; // pulse block color for the dark hero banner

function Bar({ className = "" }: { className?: string }) {
  return <div className={`${grey} rounded ${className}`} />;
}

function SubcategoryCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`${grey} w-full aspect-square rounded-full`} style={{ maxWidth: 190 }} />
      <Bar className="h-3 w-2/3" />
    </div>
  );
}

export default function CategorySkeleton() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Hero banner — kept as the real dark navy gradient, with pale
          placeholder blocks standing in for the eyebrow/title/divider. */}
      <div
        className="px-6 sm:px-12 py-14 sm:py-16 flex flex-col items-center gap-6"
        style={{
          background:
            "linear-gradient(140deg, #0e1a40 0%, #1a2a5e 45%, #162348 100%)",
        }}
      >
        <div className={`${onDark} h-3 w-24 rounded`} />
        <div className={`${onDark} h-10 w-64 sm:w-80 rounded`} />
        <div className={`${onDark} h-px w-40 rounded`} />
      </div>

      {/* Breadcrumb */}
      <div className="px-6 sm:px-12 py-3 border-b border-neutral-100 flex items-center gap-2">
        <Bar className="h-3 w-10" />
        <Bar className="h-3 w-3" />
        <Bar className="h-3 w-24" />
      </div>

      {/* Description section */}
      <div className="px-6 sm:px-12 py-10 sm:py-14 border-b border-neutral-100">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-8 sm:gap-16">
          <div>
            <Bar className="h-2.5 w-16 mb-4" />
            <Bar className="h-6 w-32 mb-4" />
            <Bar className="h-5 w-28 rounded-full" />
          </div>
          <div className="space-y-3">
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-11/12" />
            <Bar className="h-3 w-2/3" />
          </div>
        </div>
      </div>

      {/* Grid section */}
      <div className="px-6 sm:px-12 py-12 sm:py-16">
        <div className="max-w-[1200px] mx-auto">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div className="space-y-2">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-28" />
            </div>
            <Bar className="h-9 w-full sm:w-64 rounded-full" />
          </div>

          {/* Circular subcategory cards */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4 min-[1024px]:grid-cols-5 gap-x-6 gap-y-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <SubcategoryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}