'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

export const cartEvents = {
  refresh: () => window.dispatchEvent(new Event('cart:refresh')),
};

export function useCart() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  // ← use a ref so the event listener always sees the latest user/apiFetch
  const fetchRef = useRef<() => Promise<void>>();

  fetchRef.current = async () => {
  if (!user) { setCartCount(0); return; }
  try {
    const data = await apiFetch('/api/cart');
    console.log('[useCart] raw response:', JSON.stringify(data)); // ← add this
    const items = data?.data?.cart?.items ?? [];
    const count = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    console.log('[useCart] items:', items.length, '| count:', count); // ← and this
    setCartCount(count);
  } catch (err) {
    console.error('[useCart] fetch error:', err); // ← and this
    setCartCount(0);
  }
};

  // Fetch once auth is done loading
  useEffect(() => {
    if (authLoading) return;
    fetchRef.current?.();
  }, [authLoading, user]);

  // Listen for cart:refresh events from AddToCartButton
  useEffect(() => {
    const handler = () => fetchRef.current?.();
    window.addEventListener('cart:refresh', handler);
    return () => window.removeEventListener('cart:refresh', handler);
  }, []); // ← empty deps — ref always has latest version

  return { cartCount };
}