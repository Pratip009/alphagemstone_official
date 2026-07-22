'use client';
import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

export const wishlistEvents = {
  refresh: () => window.dispatchEvent(new Event('wishlist:refresh')),
};

interface WishlistContextType {
  wishlistIds: Set<string>;
  wishlistCount: number;
  isInWishlist: (productId: string) => boolean;
  toggle: (productId: string) => Promise<boolean>;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

// Every WishlistButton / WishlistIconButton on a page (e.g. one per card in a
// product grid) used to call useWishlist() independently, and each instance
// ran its own `/api/wishlist/ids` fetch on mount — so a 20-item grid fired 20
// identical requests. Centralizing the fetch + state here means the whole
// app shares ONE fetch and ONE in-memory Set, no matter how many buttons
// are on screen.
export function WishlistProvider({ children }: { children: ReactNode }) {
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
        // NOTE: no longer calling wishlistEvents.refresh() here — that used
        // to trigger every OTHER mounted instance to re-fetch /ids too.
        // Now there's only one shared instance, and it already has the
        // fresh state from the optimistic update above, so no re-fetch
        // is needed at all.
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

  const value: WishlistContextType = {
    wishlistIds,
    wishlistCount: wishlistIds.size,
    isInWishlist,
    toggle,
    loading,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}