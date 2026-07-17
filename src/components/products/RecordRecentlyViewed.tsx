'use client';
import { useEffect, useRef } from 'react';
import { recordRecentlyViewed } from '@/lib/recentlyViewed';

/**
 * Drop this into a product detail page to log a view into the visitor's
 * "Recently Viewed" history. Renders nothing.
 *
 * - Guarded with a ref so React 18 Strict Mode's dev-only double-invoke of
 *   effects doesn't cause visible duplicate work (harmless either way since
 *   `recordRecentlyViewed` is idempotent, but this keeps it to one call).
 * - Skips recording when the product is out of stock or the id is missing,
 *   so "recently viewed" doesn't fill up with dead/unavailable listings.
 * - Re-fires if the visitor navigates client-side from one product straight
 *   to another (productId changes) without a full page reload.
 */
export default function RecordRecentlyViewed({
  productId,
  inStock = true,
}: {
  productId: string;
  inStock?: boolean;
}) {
  const lastRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    if (!inStock) return;
    if (lastRecordedRef.current === productId) return;
    lastRecordedRef.current = productId;
    recordRecentlyViewed(productId);
  }, [productId, inStock]);

  return null;
}