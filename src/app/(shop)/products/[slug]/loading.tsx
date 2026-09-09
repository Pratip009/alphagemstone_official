// Skeleton for the product detail route.
//
// Next.js was falling back to src/app/(shop)/products/loading.tsx (the
// listing-page grid skeleton) here, because there was no loading.tsx inside
// this [slug] segment. That's why the skeleton didn't match this page —
// it was showing rows of small square cards instead of the actual
// image + info + related-items layout used below.
//
// This mirrors the real page's 3-column shell (260px / 1fr / 300px, see
// `.pd-columns` in page.tsx) and uses light grey pulse blocks instead of
// the cream/yellow tone used elsewhere.

const grey = "bg-neutral-200"; // light grey pulse block color

function Bar({ className = "" }: { className?: string }) {
  return <div className={`${grey} rounded ${className}`} />;
}

function PanelBlock({ barH = 34, rows }: { barH?: number; rows: number }) {
  return (
    <div className="mb-5">
      <div className={`${grey} rounded-t-md`} style={{ height: barH }} />
      <div className="border border-neutral-200 border-t-0 rounded-b-md p-3 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Bar key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      <div className="w-full px-4 py-6 pb-16 sm:px-10 sm:py-6 sm:pb-[70px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 pb-4">
          <Bar className="h-3 w-10" />
          <Bar className="h-3 w-3" />
          <Bar className="h-3 w-16" />
          <Bar className="h-3 w-3" />
          <Bar className="h-3 w-24" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-6 lg:gap-10 items-start">
          {/* ── LEFT COLUMN: main image + side panels ── */}
          <div>
            <div className={`${grey} w-full aspect-square rounded-lg`} />
            <div className="flex justify-center py-3">
              <Bar className="h-3 w-16" />
            </div>

            <PanelBlock rows={3} />
            <PanelBlock rows={4} />
            <PanelBlock rows={2} />
          </div>

          {/* ── CENTER COLUMN: title, price, actions, specs ── */}
          <div>
            <Bar className="h-6 w-3/4 mb-3" />
            <Bar className="h-3 w-28 mb-4" />

            <div className="space-y-2 mb-5">
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-11/12" />
              <Bar className="h-3 w-2/3" />
            </div>

            {/* Price box */}
            <div className="border border-neutral-200 rounded-lg p-4 mb-4 space-y-3">
              <div className="flex justify-between">
                <Bar className="h-3 w-32" />
                <Bar className="h-3 w-16" />
              </div>
              <div className="flex justify-between py-1 border-t border-b border-dashed border-neutral-200">
                <Bar className="h-4 w-24" />
                <Bar className="h-6 w-20" />
              </div>
              <div className="flex justify-between">
                <Bar className="h-3 w-28" />
                <Bar className="h-3 w-16" />
              </div>
            </div>

            {/* Stock line */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`${grey} w-2 h-2 rounded-full`} />
              <Bar className="h-3 w-36" />
            </div>

            <Bar className="h-3 w-20 mb-3" />

            {/* Add to cart button */}
            <Bar className="h-10 w-full mb-3 rounded-md" />

            {/* Secondary buttons row */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Bar className="h-9 rounded-md" />
              <Bar className="h-9 rounded-md" />
            </div>

            <Bar className="h-9 w-full mb-6 rounded-md" />

            {/* Specs table */}
            <PanelBlock barH={34} rows={6} />
            <PanelBlock barH={34} rows={3} />
          </div>

          {/* ── RIGHT COLUMN: related items ── */}
          <div>
            <Bar className="h-3 w-28 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className={`${grey} w-full aspect-square rounded-md mb-2`} />
                  <Bar className="h-3 w-3/4 mb-2" />
                  <Bar className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}