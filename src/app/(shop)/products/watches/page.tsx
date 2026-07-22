import { connectDB } from "@/lib/db";
import { listProducts, getProductFacets } from "@/services/product.service";
import { ProductFilterParams } from "@/services/productFilter.service";
import ProductCard from "@/components/products/ProductCard";
import FilterBar from "@/components/filters/FilterBar";
import SortBar from "@/components/products/SortBar";
import Pagination from "@/components/ui/Pagination";
import MobileFilterDrawer from "@/components/filters/MobileFilterDrawer";
import { Suspense } from "react";

interface PageProps {
  searchParams: Promise<Record<string, string>>; // ✅ fixed
}

export default async function WatchesPage({ searchParams }: PageProps) {
  await connectDB();

  const sp = await searchParams; // ✅ unwrap first

  const params: ProductFilterParams = {
    category: sp.category ?? "watches",
    subcategory: sp.subcategory,
    watchGender: sp.watchGender,
    watchBrand: sp.watchBrand,
    watchMovement: sp.watchMovement,
    watchStrapType: sp.watchStrapType,
    watchCaseMaterial: sp.watchCaseMaterial,
    watchDialColor: sp.watchDialColor,
    watchFeatures: sp.watchFeatures,
    watchStyle: sp.watchStyle,
    watchCaseSize: sp.watchCaseSize,
    priceMin: sp.priceMin,
    priceMax: sp.priceMax,
    inStock: sp.inStock,
    q: sp.q,
    sortBy: sp.sortBy as ProductFilterParams["sortBy"],
    page: sp.page || 1,
    limit: 24,
  };

  const [{ products, total, page, limit }, facets] = await Promise.all([
    listProducts(params),
    getProductFacets(params),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-[#ffffff]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="hidden lg:block -mx-4 sm:-mx-6 mb-6">
          <Suspense fallback={<div className="px-6 py-3 text-[11px] text-gray-400">Loading filters...</div>}>
            <FilterBar productType="watch" facets={facets} />
          </Suspense>
        </div>

        <div className="flex gap-8 xl:gap-10">
          <main className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 lg:hidden">
              <Suspense fallback={null}>
                <MobileFilterDrawer facets={facets} />
              </Suspense>
            </div>

            <SortBar
              total={total}
              currentSort={sp.sortBy} // ✅ fixed
              query={sp.q}            // ✅ fixed
            />

            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 sm:py-36 text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 border-[1.5px] border-[#0f0f0f] flex items-center justify-center mb-5 rounded-[2px]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-[#0f0f0f]/30"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M21 21l-4.35-4.35"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-serif text-sm font-medium text-[#0f0f0f] tracking-wide mb-1">
                  No results found
                </p>
                <p className="text-[11px] tracking-[0.1em] uppercase font-medium text-[#888]">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 mt-3">
                  {products.map((p: Record<string, unknown>) => {
                    const serialized = {
                      _id: String(p._id),
                      name: p.name as string,
                      price: p.price as number,
                      watchBrand: p.watchBrand as string | undefined,
                      watchMovement: p.watchMovement as string | undefined,
                      watchGender: p.watchGender as string | undefined,
                      watchStyle: p.watchStyle as string | undefined,
                      watchCaseMaterial: p.watchCaseMaterial as string | undefined,
                      watchDialColor: p.watchDialColor as string | undefined,
                      watchStrapType: p.watchStrapType as string | undefined,
                      watchCaseSize: p.watchCaseSize as string | undefined,
                      images: p.images as string[],
                      stock: p.stock as number,
                    };
                    return (
                      <ProductCard
                        key={serialized._id}
                        product={serialized}
                        productType="watch"
                      />
                    );
                  })}
                </div>
                <div className="mt-10 sm:mt-12">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    searchParams={sp} // ✅ fixed
                  />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}