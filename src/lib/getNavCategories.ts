// lib/getNavCategories.ts

export interface NavSubcategory {
  _id: string;
  name: string;
  slug: string;
  isActive?: boolean;
}

export interface NavCategory {
  _id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  subcategories: NavSubcategory[];
}

export async function getNavCategories(): Promise<NavCategory[]> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const res = await fetch(
      `${baseUrl}/api/categories?withSubcategories=true`,
      {
        next: { revalidate: 3600 }, // cache 1 hour, revalidates in background
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const list: NavCategory[] = Array.isArray(data) ? data : (data?.data ?? []);

    return list
      .filter((c) => c.isActive !== false)
      .map((c) => ({
        ...c,
        subcategories: (c.subcategories ?? []).filter(
          (s) => s.isActive !== false
        ),
      }));
  } catch {
    return []; // fail silently — nav still renders, just empty
  }
}