"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Sub-subcategory management (create, assign to a subcategory, upload images)
// now lives inside the Categories admin page as a drill-down panel — select a
// category, then click a subcategory card to manage its sub-subcategories.
// This route is kept only so old links/bookmarks don't 404.
export default function AdminSubSubcategoriesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/categories");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-sm text-[#a09a90]">
      Redirecting to Categories…
    </div>
  );
}