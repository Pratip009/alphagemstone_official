'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRecentlyViewedIds,
  recordRecentlyViewed,
  removeRecentlyViewed,
  clearRecentlyViewed,
  pruneRecentlyViewed,
  subscribeRecentlyViewed,
} from '@/lib/recentlyViewed';

// Keep this loose so it works with whatever shape /api/products/by-ids and
// ProductCard happen to need — both already agree on the underlying Product
// model, so we don't re-declare every field here.
export type RecentlyViewedProduct = {
  _id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
  [key: string]: unknown;
};

interface UseRecentlyViewedOptions {
  /** Exclude this product id from the returned list (e.g. the page you're currently on). */
  excludeId?: string;
  /** Max number of products to return after hydration. */
  limit?: number;
}

export function useRecentlyViewed(options: UseRecentlyViewedOptions = {}) {
  const { excludeId, limit } = options;
  const [items, setItems] = useState<RecentlyViewedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Avoids setting state after unmount if a slow fetch resolves late.
  const mountedRef = useRef(true);
  // Coalesces bursts of updates (e.g. StrictMode double-invoke, rapid
  // record calls) into a single network request.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async () => {
    const ids = getRecentlyViewedIds();
    if (ids.length === 0) {
      if (mountedRef.current) {
        setItems([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    if (mountedRef.current) setLoading(true);
    try {
      const res = await fetch('/api/products/by-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load recently viewed products');
      }

      const products: RecentlyViewedProduct[] = (data.data ?? []).map((p: any) => ({
        ...p,
        _id: String(p._id),
      }));

      // Self-heal: if some ids came back missing (deleted/deactivated
      // product), drop them from local history so the list doesn't keep
      // trying to hydrate a dead id on every future visit.
      pruneRecentlyViewed(new Set(products.map((p) => p._id)));

      if (mountedRef.current) {
        setItems(products);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load recently viewed products');
        // Keep whatever we had before rather than blanking the section on
        // a transient network error.
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProducts();
    }, 120);
  }, [fetchProducts]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProducts();
    const unsubscribe = subscribeRecentlyViewed(scheduleFetch);
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubscribe();
    };
  }, [fetchProducts, scheduleFetch]);

  const recordView = useCallback((productId: string) => {
    recordRecentlyViewed(productId);
  }, []);

  const remove = useCallback((productId: string) => {
    removeRecentlyViewed(productId);
  }, []);

  const clear = useCallback(() => {
    clearRecentlyViewed();
  }, []);

  const filtered = items.filter((p) => p._id !== excludeId);
  const limited = typeof limit === 'number' ? filtered.slice(0, limit) : filtered;

  return {
    items: limited,
    loading,
    error,
    recordView,
    remove,
    clear,
    refresh: fetchProducts,
  };
}
