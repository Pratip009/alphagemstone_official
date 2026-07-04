'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

export const wishlistEvents = {
  refresh: () => window.dispatchEvent(new Event('wishlist:refresh')),
};

export function useWishlist() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchRef = useRef<() => Promise<void>>();

  fetchRef.current = async () => {
    if (!user) {
      setWishlistIds(new Set());
      return;
    }
    try {
      const data = await apiFetch('/api/wishlist/ids');
      const ids: string[] = data?.data?.productIds ?? [];
      setWishlistIds(new Set(ids));
    } catch {
      setWishlistIds(new Set());
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchRef.current?.();
  }, [authLoading, user]);

  useEffect(() => {
    const handler = () => fetchRef.current?.();
    window.addEventListener('wishlist:refresh', handler);
    return () => window.removeEventListener('wishlist:refresh', handler);
  }, []);

  const isInWishlist = useCallback((productId: string) => wishlistIds.has(productId), [wishlistIds]);

  const toggle = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!user) throw new Error('Please log in to save items to your wishlist');

      const wasSaved = wishlistIds.has(productId);
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(productId);
        else next.add(productId);
        return next;
      });

      setLoading(true);
      try {
        const data = await apiFetch('/api/wishlist/toggle', {
          method: 'POST',
          body: JSON.stringify({ productId }),
        });
        const inWishlist: boolean = data?.data?.inWishlist ?? !wasSaved;
        setWishlistIds((prev) => {
          const next = new Set(prev);
          if (inWishlist) next.add(productId);
          else next.delete(productId);
          return next;
        });
        wishlistEvents.refresh();
        return inWishlist;
      } catch (err) {
        setWishlistIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(productId);
          else next.delete(productId);
          return next;
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, user, wishlistIds]
  );

  return { wishlistIds, wishlistCount: wishlistIds.size, isInWishlist, toggle, loading };
}