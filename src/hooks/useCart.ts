'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

export const cartEvents = {
  refresh: () => window.dispatchEvent(new Event('cart:refresh')),
};

export function useCart() {
  const { apiFetch } = useApi();
  // Cart works for guests too now (server resolves identity via the
  // auth_token OR guest_id cookie), so we no longer gate the fetch on
  // `user` — we only wait for the auth check to finish so a guest's first
  // fetch isn't racing a login that's about to hydrate.
  const { loading: authLoading } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  // ← use a ref so the event listener always sees the latest apiFetch
  const fetchRef = useRef<() => Promise<void>>();

  fetchRef.current = async () => {
    try {
      const data = await apiFetch('/api/cart');

      const items = data?.data?.cart?.items ?? [];
      const count = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

      setCartCount(count);
    } catch (err) {
      setCartCount(0);
    }
  };

  // Fetch once auth is done loading (guest or logged-in — both work now)
  useEffect(() => {
    if (authLoading) return;
    fetchRef.current?.();
  }, [authLoading]);

  // Listen for cart:refresh events from AddToCartButton
  useEffect(() => {
    const handler = () => fetchRef.current?.();
    window.addEventListener('cart:refresh', handler);
    return () => window.removeEventListener('cart:refresh', handler);
  }, []); // ← empty deps — ref always has latest version

  return { cartCount };
}
