'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { cartEvents } from '@/hooks/useCart';

export default function AddToCartButton({
  productId,
  inStock,
}: {
  productId: string;
  inStock: boolean;
}) {
  const { user, loading: authLoading } = useAuth();  // ← get loading state
  const { apiFetch } = useApi();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  const handleAdd = async () => {
    // ✅ Wait for auth to finish loading before checking user
    if (authLoading) return;

    if (!user) {
      router.push('/login'); // ✅ Fixed: was '/login', match your actual route
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: qty }),
      });
       cartEvents.refresh();
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  };

  if (!inStock) {
    return (
      <button disabled className="w-full py-3 rounded bg-neutral-800 text-neutral-600 cursor-not-allowed font-medium">
        Out of Stock
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="label">Qty</label>
        <div className="flex items-center border border-neutral-700 rounded">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="px-3 py-1.5 text-neutral-400 hover:text-white"
          >
            −
          </button>
          <span className="px-4 py-1.5 text-sm border-x border-neutral-700">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="px-3 py-1.5 text-neutral-400 hover:text-white"
          >
            +
          </button>
        </div>
      </div>
      <button
        onClick={handleAdd}
        disabled={loading || authLoading}  // ✅ disable during auth load too
        className={`w-full py-3 rounded font-semibold transition-all ${
          added
            ? 'bg-green-600 text-white'
            : 'bg-amber-500 hover:bg-amber-400 text-black'
        }`}
      >
        {/* ✅ Show loading state during auth check too */}
        {authLoading ? 'Loading…' : loading ? 'Adding…' : added ? '✓ Added to Cart' : 'Add to Cart'}
      </button>
      <button
        onClick={() => router.push('/cart')}
        className="w-full btn-secondary py-2.5 text-center text-sm"
      >
        View Cart
      </button>
    </div>
  );
}