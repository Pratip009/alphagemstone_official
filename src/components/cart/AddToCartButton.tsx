'use client';
import { useState } from 'react';
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
  const { apiFetch } = useApi();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  const handleAdd = async () => {
    // No login gate — cart works for guests too (server resolves identity
    // via auth_token or guest_id cookie). This used to redirect anyone who
    // wasn't logged in straight to /login, which was the very first
    // friction point in the purchase flow.
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
      <button
        disabled
        className="w-full py-2.5 border font-bold cursor-not-allowed"
        style={{
          borderColor: '#ded2ac',
          background: '#f7f4ec',
          color: '#8a8578',
          fontSize: 11,
          borderRadius: 2,
        }}
      >
        Out of Stock
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
        <div
          className="flex items-center"
          style={{ border: '1px solid #d9cba3', borderRadius: 2 }}
        >
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            style={{
              padding: '5px 10px',
              color: '#7a5f2a',
              background: '#faf6ec',
              fontSize: 12,
              fontWeight: 'bold',
            }}
          >
            −
          </button>
          <span
            style={{
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 'bold',
              borderLeft: '1px solid #d9cba3',
              borderRight: '1px solid #d9cba3',
              color: '#222',
            }}
          >
            {qty}
          </span>
          <button
            onClick={() => setQty(qty + 1)}
            style={{
              padding: '5px 10px',
              color: '#7a5f2a',
              background: '#faf6ec',
              fontSize: 12,
              fontWeight: 'bold',
            }}
          >
            +
          </button>
        </div>
      </div>
      <button
        onClick={handleAdd}
        disabled={loading}
        className="w-full font-bold transition-all"
        style={{
          padding: '9px 10px',
          borderRadius: 2,
          fontSize: 11,
          marginBottom: 8,
          border: '1px solid #a98a4a',
          background: added
            ? '#227722'
            : 'linear-gradient(to bottom, #d9c68f, #b08d4a)',
          color: '#fff',
        }}
      >
        {loading ? 'Adding...' : added ? '✓ Added to Cart' : 'Add To Cart'}
      </button>
      <button
        onClick={() => router.push('/cart')}
        className="w-full text-center"
        style={{
          padding: '7px 10px',
          borderRadius: 2,
          fontSize: 11,
          fontWeight: 'bold',
          border: '1px solid #d9cba3',
          background: '#fff',
          color: '#4a3c1f',
          marginBottom: 8,
        }}
      >
        View Cart
      </button>
    </div>
  );
}