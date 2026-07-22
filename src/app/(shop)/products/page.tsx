import { connectDB } from "@/lib/db";
import { listProducts, getProductFacets } from "@/services/product.service";
import { ProductFilterParams } from "@/services/productFilter.service";
import ProductCard from "@/components/products/ProductCard";
import FilterSidebar from "@/components/filters/FilterSidebar";
import SortBar from "@/components/products/SortBar";
import Pagination from "@/components/ui/Pagination";
import MobileFilterDrawer from "@/components/filters/MobileFilterDrawer";
import { Suspense } from "react";
import type { Metadata } from "next";
interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

// Watch-specific filter params — if any of these are present the page is in watch mode
const WATCH_FILTER_PARAMS = [
  "watchBrand","watchMovement","watchGender","watchStyle",
  "watchStrapType","watchCaseMaterial","watchDialColor",
  "watchFeatures","watchCaseSize",
  // Also catch the attribute param names used by SearchBar chips
  "brand","movement","strapType","caseMaterial","dialColor",
  "feature","style","gender","caseSize",
] as const;

/**
 * Determine whether the current page should show the Watch, Diamond, or
 * Gemstone view.
 *
 * Gemstones don't live under one category slug — they're spread across
 * "Precious Gems", "Semi Precious", "Specials", etc, each with a
 * per-gem subcategory (Emerald, Amethyst, …). So the category slug alone
 * can't tell us "this is a gemstone". Instead we trust the actual
 * `productKind` field on the fetched product, which every product
 * carries regardless of which category/subcategory it's filed under.
 *
 * Priority order:
 *  1. The real productKind on the first matched product (ground truth)
 *  2. No results to inspect yet — fall back to URL signals (watch only,
 *     since that's the one category we can identify by slug alone)
 */
function resolveProductType(
  sp: Record<string, string>,
  firstProduct: Record<string, unknown> | undefined,
): "watch" | "diamond" | "gemstone" {
  const kind = firstProduct?.productKind as string | undefined;
  if (kind === "watch")    return "watch";
  if (kind === "gemstone") return "gemstone";
  if (kind === "diamond")  return "diamond";

  // No product to inspect (e.g. empty result set) — fall back to the URL.
  if (sp.category === "watches") return "watch";
  if (WATCH_FILTER_PARAMS.some((k) => sp[k])) return "watch";

  return "diamond";
}
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = await searchParams;

  // Reuse the same resolution logic the page already uses, minus the
  // first-product fallback (no DB call needed just for a title — if no
  // explicit signal is in the URL, default to "Diamonds").
  const isWatch =
    sp.category === "watches" ||
    (!sp.category && WATCH_FILTER_PARAMS.some((k) => sp[k]));
  // Metadata runs before any DB query, so there's no product to check
  // productKind on yet — approximate off the category slug instead.
  const isGemstone = /gem|precious|special/i.test(sp.category || "");

  const label = isWatch ? "Timepieces" : isGemstone ? "Gemstones" : "Diamonds";

  const filterBits = [sp.shape, sp.subcategory, sp.q ?? sp.search].filter(Boolean);
  const title = filterBits.length
    ? `${filterBits.join(" ")} ${label} | Alpha Imports`
    : `${label} | Alpha Imports`;

  return {
    title,
    description: isWatch
      ? "Shop luxury timepieces at Alpha Imports — exceptional horological craftsmanship."
      : isGemstone
        ? "Shop certified natural and lab-grown gemstones at Alpha Imports."
        : "Shop ethically sourced, GIA & IGI certified diamonds at Alpha Imports.",
  };
}
export default async function ProductsPage({ searchParams }: PageProps) {
  await connectDB();

  const sp = await searchParams;

  const params: ProductFilterParams = {
    category:           sp.category,
    subcategory:        sp.subcategory,
    shape:              sp.shape,
    color:              sp.color,
    clarity:            sp.clarity,
    certification:      sp.certification,
    priceMin:           sp.priceMin,
    priceMax:           sp.priceMax,
    sizeMin:            sp.sizeMin,
    sizeMax:            sp.sizeMax,
    watchGender:        sp.watchGender   ?? sp.gender,
    watchBrand:         sp.watchBrand    ?? sp.brand,
    watchMovement:      sp.watchMovement ?? sp.movement,
    watchStrapType:     sp.watchStrapType  ?? sp.strapType,
    watchCaseMaterial:  sp.watchCaseMaterial ?? sp.caseMaterial,
    watchDialColor:     sp.watchDialColor  ?? sp.dialColor,
    watchFeatures:      sp.watchFeatures  ?? sp.feature,
    watchStyle:         sp.watchStyle     ?? sp.style,
    watchCaseSize:      sp.watchCaseSize  ?? sp.caseSize,
    inStock:            sp.inStock,
    q:                  sp.q ?? sp.search,   // support both ?q= and ?search=
    sortBy:             sp.sortBy as ProductFilterParams["sortBy"],
    page:               sp.page || 1,
    limit:              24,
  };

  const [{ products, total, page, limit }, facets] = await Promise.all([
    listProducts(params),
    getProductFacets(params),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Robust product type resolution — URL params take priority over data
  const productType = resolveProductType(sp, products[0] as Record<string, unknown> | undefined);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');

        body, .products-page *:not(.pc6, .pc6 *) { font-family: 'Gilda Display', serif !important; }
      `}</style>

      <div
        className="products-page min-h-screen bg-[#ffffff]"
        style={{ fontFamily: "'Gilda Display', serif" }}
      >
        {/* ── Top accent line ── */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#B8975A] to-transparent" />

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="flex gap-8 xl:gap-12">

            {/* ── Sidebar: desktop ── */}
            <aside className="hidden lg:block w-56 xl:w-60 shrink-0">
              <div className="sticky top-8">
                <div className="bg-white rounded-2xl border border-[#EDE3D0] shadow-[0_2px_20px_rgba(184,151,90,0.06)] px-5 py-6">
                  <Suspense fallback={<SidebarSkeleton />}>
                    <FilterSidebar productType={productType} facets={facets} />
                  </Suspense>
                </div>
              </div>
            </aside>

            {/* ── Main content ── */}
            <main className="flex-1 min-w-0">

              {/* Mobile filter drawer trigger */}
              <div className="flex items-center gap-3 mb-4 lg:hidden">
                <Suspense fallback={null}>
                  <MobileFilterDrawer facets={facets} />
                </Suspense>
              </div>

              {/* Page heading */}
              <div className="mb-6 pb-5 border-b border-[#EDE3D0] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h1
                    className="text-3xl sm:text-4xl font-normal text-[#1A1612] leading-tight"
                    style={{ fontFamily: '"Elms Sans", sans-serif' }}
                  >
                    {productType === "watch" ? "Timepieces" : productType === "gemstone" ? "Gemstones" : "Diamonds"}
                  </h1>
                  <p className="mt-1.5 text-[10px] tracking-[0.25em] uppercase text-[#B8975A] font-medium">
                    {productType === "watch"
                      ? "Exceptional horological craftsmanship"
                      : productType === "gemstone"
                        ? "Certified natural & lab-grown gemstones"
                        : "Ethically sourced · GIA & IGI certified"}
                  </p>
                </div>

                <SortBar
                  total={total}
                  currentSort={sp.sortBy}
                  query={sp.q ?? sp.search}
                />
              </div>

              {/* Active filter chips */}
              <ActiveFilterChips searchParams={sp} />

              {/* Products grid or empty state */}
              {products.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    {products.map((p: Record<string, unknown>) => {
                      const serialized = {
                        _id:               String(p._id),
                        name:              p.name              as string,
                        price:             p.price             as number,
                        // gem / diamond fields
                        shape:             p.shape             as string | string[] | undefined,
                        size:              p.size              as number | undefined,
                        color:             p.color             as string | string[] | undefined,
                        clarity:           p.clarity           as string | string[] | undefined,
                        certification:     p.certification     as string | string[] | undefined,
                        gemstoneName:      p.gemstoneName      as string | undefined,
                        shapeRaw:          p.shapeRaw          as string | undefined,
                        colorRaw:          p.colorRaw          as string | undefined,
                        clarityRaw:        p.clarityRaw        as string | undefined,
                        gradeRaw:          p.gradeRaw          as string | undefined,
                        // watch fields
                        watchBrand:        p.watchBrand        as string | undefined,
                        watchModel:        p.watchModel        as string | undefined,
                        watchMovement:     p.watchMovement     as string | undefined,
                        watchGender:       p.watchGender       as string | undefined,
                        watchStyle:        p.watchStyle        as string | undefined,
                        watchCaseMaterial: p.watchCaseMaterial as string | undefined,
                        watchDialColor:    p.watchDialColor    as string | undefined,
                        watchStrapType:    p.watchStrapType    as string | undefined,
                        watchCaseSize:     p.watchCaseSize     as string | undefined,
                        watchFeatures:     p.watchFeatures     as string[] | undefined,
                        images:            p.images            as string[],
                        stock:             p.stock             as number,
                      };
                      return (
                        <ProductCard
                          key={serialized._id}
                          product={serialized}
                          productType={productType}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-12 sm:mt-16">
                    <Pagination page={page} totalPages={totalPages} searchParams={sp} />
                  </div>
                </>
              )}
            </main>
          </div>
        </div>

        {/* ── Bottom accent line ── */}
        <div className="h-px w-full bg-[#EDE3D0] mt-12" />
        <div className="max-w-screen-2xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#B8975A] rotate-45 rounded-[1px]" />
            <span
              className="text-[11px] tracking-[0.2em] uppercase text-[#8A7F72]"
              style={{ fontFamily: '"Elms Sans", sans-serif' }}
            >
              Alpha Imports
            </span>
          </div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-[#C4B8A8]">
            Free insured shipping on all orders
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Active filter chips ──────────────────────────────────────────────────────
function ActiveFilterChips({ searchParams }: { searchParams: Record<string, string> }) {
  const chipKeys = [
    "shape","color","clarity",
    "watchBrand","brand",
    "watchMovement","movement",
    "watchGender","gender",
    "watchStyle","style",
    "watchStrapType","strapType",
    "watchCaseMaterial","caseMaterial",
    "watchDialColor","dialColor",
    "watchFeatures","feature",
    "watchCaseSize","caseSize",
    "inStock",
  ];

  // De-dupe: prefer the watch-prefixed key if both are present
  const seen = new Set<string>();
  const chips: { key: string; label: string }[] = [];

  chipKeys.forEach((key) => {
    const val = searchParams[key];
    if (!val) return;
    val.split(",").filter(Boolean).forEach((v) => {
      const dedupeKey = `${v.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      chips.push({ key, label: key === "inStock" ? "In Stock" : v });
    });
  });

  if (searchParams.priceMin || searchParams.priceMax) {
    const min = searchParams.priceMin ? `$${Number(searchParams.priceMin).toLocaleString()}` : "";
    const max = searchParams.priceMax ? `$${Number(searchParams.priceMax).toLocaleString()}` : "";
    chips.push({ key: "price", label: min && max ? `${min} – ${max}` : min || `Under ${max}` });
  }

  if (searchParams.sizeMin || searchParams.sizeMax) {
    const label = [
      searchParams.sizeMin && `${searchParams.sizeMin}ct`,
      searchParams.sizeMax && `${searchParams.sizeMax}ct`,
    ].filter(Boolean).join(" – ");
    chips.push({ key: "size", label });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {chips.map((chip, i) => (
        <span
          key={`${chip.key}-${chip.label}-${i}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium tracking-wide bg-[#F5EDD6] text-[#8A6C38] border border-[#D4C4A0]"
          style={{ fontFamily: '"Elms Sans", sans-serif' }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 sm:py-40 text-center">
      <div className="mb-6 relative">
        <div className="w-16 h-16 border border-[#EDE3D0] rounded-2xl flex items-center justify-center bg-white shadow-[0_2px_16px_rgba(184,151,90,0.06)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#D4C4A0]">
            <path d="M12 22L3 10l2.5-6h13L21 10z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M3 10h18M12 22L8 10l4-6 4 6z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#B8975A] rotate-45 rounded-[2px] opacity-60" />
      </div>
      <p
        className="text-lg font-normal text-[#1A1612] mb-2"
        style={{ fontFamily: '"Elms Sans", sans-serif' }}
      >
        No results found
      </p>
      <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-[#C4B8A8] mb-6">
        Try adjusting your filters
      </p>
      <div className="w-12 h-px bg-[#D4C4A0]" />
    </div>
  );
}

// ─── Sidebar skeleton ─────────────────────────────────────────────────────────
function SidebarSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-[#F5EDD6] rounded w-3/4 mx-auto" />
      <div className="h-8 bg-[#F9F5EE] rounded-lg" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2 pt-3 border-t border-[#EDE3D0]">
          <div className="h-3 bg-[#F5EDD6] rounded w-1/2" />
          <div className="h-2.5 bg-[#FAF7F1] rounded w-3/4" />
          <div className="h-2.5 bg-[#FAF7F1] rounded w-2/3" />
          <div className="h-2.5 bg-[#FAF7F1] rounded w-4/5" />
        </div>
      ))}
    </div>
  );
}