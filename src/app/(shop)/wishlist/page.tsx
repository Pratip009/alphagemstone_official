'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ArrowRight, Package, ShoppingBag, Trash2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { wishlistEvents } from '@/hooks/useWishlist';
import { cartEvents } from '@/hooks/useCart';
import ProductCard from '@/components/products/ProductCard';

interface WishlistProduct {
  _id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
  productKind?: string;
  gemstoneName?: string;
  shape?: string | string[];
  size?: number;
  color?: string | string[];
  clarity?: string | string[];
  certification?: string | string[];
  watchBrand?: string;
  watchModel?: string;
  watchMovement?: string;
  watchGender?: string;
}

interface WishlistItem {
  product: WishlistProduct;
  addedAt: string;
}

function WishlistSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-8 w-48 bg-[#ede9e1] rounded-lg mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#ede9e1] rounded-2xl p-4 space-y-3">
            <div className="w-full aspect-square bg-[#ede9e1] rounded-xl" />
            <div className="h-4 bg-[#ede9e1] rounded w-3/4" />
            <div className="h-4 bg-[#ede9e1] rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6" style={{ background: '#faf8f4', border: '1.5px solid #ede9e1' }}>
        <Heart size={36} strokeWidth={1.2} style={{ color: '#c9a84c' }} />
      </div>
      <h2 className="font-['Cormorant_Garamond',serif] text-3xl font-medium mb-2" style={{ color: '#1a1714' }}>
        Your wishlist is empty
      </h2>
      <p className="text-sm mb-8" style={{ color: '#a09a90' }}>
        Tap the heart on any product to save it here for later
      </p>
      <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all hover:opacity-90 active:scale-95" style={{ background: '#1a1714', color: '#f5f0e8' }}>
        Browse Collection <ArrowRight size={14} strokeWidth={2} />
      </Link>
    </div>
  );
}

export default function WishlistPage() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/wishlist');
  }, [authLoading, user, router]);

  const fetchWishlist = async () => {
    try {
      const data = await apiFetch('/api/wishlist');
      setItems(data.data.wishlist?.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) fetchWishlist();
  }, [authLoading, user]);

  useEffect(() => {
    const handler = () => { if (user) fetchWishlist(); };
    window.addEventListener('wishlist:refresh', handler);
    return () => window.removeEventListener('wishlist:refresh', handler);
  }, [user]);

  const remove = async (productId: string) => {
    setBusyId(productId);
    try {
      await apiFetch(`/api/wishlist?productId=${productId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.product._id !== productId));
      wishlistEvents.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setBusyId(null);
    }
  };

  const moveToCart = async (productId: string) => {
    setBusyId(productId);
    try {
      await apiFetch('/api/wishlist/move-to-cart', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      setItems((prev) => prev.filter((i) => i.product._id !== productId));
      wishlistEvents.refresh();
      cartEvents.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to move item to cart');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || (loading && user)) return <WishlistSkeleton />;
  if (!user) return null;
  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-sm" style={{ color: '#c97a7a' }}>{error}</p>
        <button onClick={fetchWishlist} className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{ background: '#1a1714', color: '#f5f0e8' }}>
          Try Again
        </button>
      </div>
    );
  if (items.length === 0) return <EmptyWishlist />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-[0.65rem] tracking-[0.25em] uppercase font-semibold mb-1.5" style={{ color: '#c9a84c' }}>◆ Saved For Later</p>
          <h1 className="font-['Cormorant_Garamond',serif] text-[2.2rem] font-medium leading-none" style={{ color: '#1a1714' }}>My Wishlist</h1>
        </div>
        <span className="text-[0.7rem] tracking-wide px-3 py-1.5 rounded-full font-semibold" style={{ background: '#faf8f4', border: '1px solid #ede9e1', color: '#7a736a' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {items.map(({ product }) => {
          const isBusy = busyId === product._id;
          const inStock = product.stock > 0;
          return (
            <div key={product._id} className="flex flex-col gap-2" style={{ opacity: isBusy ? 0.6 : 1 }}>
              <ProductCard product={product} />
              <div className="flex gap-2">
                <button
                  onClick={() => moveToCart(product._id)}
                  disabled={isBusy || !inStock}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[0.72rem] font-semibold tracking-wide transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#1a1714', color: '#f5f0e8' }}
                >
                  <ShoppingBag size={12} strokeWidth={2} />
                  {inStock ? 'Move to Cart' : 'Sold Out'}
                </button>
                <button
                  onClick={() => remove(product._id)}
                  disabled={isBusy}
                  title="Remove from wishlist"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-all hover:bg-red-50 disabled:opacity-40"
                  style={{ border: '1.5px solid #ede9e1', color: '#c0392b' }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/products" className="inline-flex items-center gap-2 text-[0.73rem] font-semibold mt-8 transition-colors" style={{ color: '#a09a90' }}>
        <Package size={13} strokeWidth={2} /> Continue shopping
      </Link>
    </div>
  );
}