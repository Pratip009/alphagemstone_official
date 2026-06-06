'use client';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Gem, Package } from 'lucide-react';

interface CartItem {
  product: { _id: string; name: string; images: string[]; price: number; stock: number };
  quantity: number;
  price: number;
}

interface Totals {
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CartSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse">
      <div className="h-8 w-48 bg-[#ede9e1] rounded-lg mb-8" />
      <div className="flex gap-8">
        <div className="flex-1 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-[#ede9e1] rounded-2xl p-5 flex gap-4">
              <div className="w-20 h-20 bg-[#ede9e1] rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-[#ede9e1] rounded w-3/4" />
                <div className="h-4 bg-[#ede9e1] rounded w-1/3" />
              </div>
              <div className="w-24 h-8 bg-[#ede9e1] rounded-lg self-center" />
            </div>
          ))}
        </div>
        <div className="w-72 shrink-0">
          <div className="bg-white border border-[#ede9e1] rounded-2xl p-6 space-y-4">
            <div className="h-5 bg-[#ede9e1] rounded w-1/2" />
            {[1, 2, 3, 4].map(i => <div key={i} className="h-4 bg-[#ede9e1] rounded" />)}
            <div className="h-11 bg-[#ede9e1] rounded-xl mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyCart() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: '#faf8f4', border: '1.5px solid #ede9e1' }}
      >
        <ShoppingBag size={36} strokeWidth={1.2} style={{ color: '#c9a84c' }} />
      </div>
      <h2
        className="font-['Cormorant_Garamond',serif] text-3xl font-medium mb-2"
        style={{ color: '#1a1714' }}
      >
        Your cart is empty
      </h2>
      <p className="text-sm mb-8" style={{ color: '#a09a90' }}>
        Discover our collection of fine diamonds &amp; gemstones
      </p>
      <Link
        href="/products"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all hover:opacity-90 active:scale-95"
        style={{ background: '#1a1714', color: '#f5f0e8' }}
      >
        Browse Collection <ArrowRight size={14} strokeWidth={2} />
      </Link>
    </div>
  );
}

// ─── Cart item card ───────────────────────────────────────────────────────────
function CartCard({
  item,
  onUpdate,
  onRemove,
  updating,
}: {
  item: CartItem;
  onUpdate: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  updating: string | null;
}) {
  const isUpdating = updating === item.product._id;

  return (
    <div
      className="group bg-white border border-[#ede9e1] rounded-2xl p-4 sm:p-5 flex gap-4 items-center transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] hover:-translate-y-0.5"
      style={{ opacity: isUpdating ? 0.6 : 1 }}
    >
      {/* Image */}
      <div
        className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ background: '#faf8f4', border: '1px solid #ede9e1', minWidth: '4.5rem', minHeight: '4.5rem' }}
      >
        {item.product.images[0] ? (
          <img
            src={item.product.images[0]}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Gem size={24} strokeWidth={1.2} style={{ color: '#c9a84c' }} />
        )}
      </div>

      {/* Name + price */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[0.85rem] font-semibold leading-snug line-clamp-2 mb-1"
          style={{ color: '#1a1714' }}
        >
          {item.product.name}
        </p>
        <p
          className="text-[0.75rem] font-medium"
          style={{ color: '#c9a84c' }}
        >
          ${item.price.toLocaleString()} each
        </p>
      </div>

      {/* Qty stepper */}
      <div
        className="flex items-center rounded-xl overflow-hidden shrink-0"
        style={{ border: '1.5px solid #ede9e1', background: '#faf8f4' }}
      >
        <button
          onClick={() => onUpdate(item.product._id, item.quantity - 1)}
          disabled={isUpdating || item.quantity <= 1}
          className="w-8 h-8 flex items-center justify-center transition-colors hover:bg-[#ede9e1] disabled:opacity-30"
          style={{ color: '#6b6560' }}
        >
          <Minus size={12} strokeWidth={2.5} />
        </button>
        <span
          className="w-8 text-center text-[0.8rem] font-bold"
          style={{ color: '#1a1714' }}
        >
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdate(item.product._id, item.quantity + 1)}
          disabled={isUpdating || item.quantity >= item.product.stock}
          className="w-8 h-8 flex items-center justify-center transition-colors hover:bg-[#ede9e1] disabled:opacity-30"
          style={{ color: '#6b6560' }}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Line total */}
      <p
        className="w-20 text-right text-[0.88rem] font-bold shrink-0 hidden sm:block"
        style={{ color: '#1a1714' }}
      >
        ${(item.price * item.quantity).toLocaleString()}
      </p>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.product._id)}
        disabled={isUpdating}
        className="ml-1 w-8 h-8 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-red-50 disabled:opacity-30"
        style={{ color: '#d4a0a0' }}
        title="Remove"
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Summary row ──────────────────────────────────────────────────────────────
function SummaryRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'pt-1' : ''}`}>
      <span
        className="text-[0.75rem]"
        style={{ color: bold ? '#1a1714' : '#a09a90', fontWeight: bold ? 700 : 400 }}
      >
        {label}
      </span>
      <span
        className="text-[0.82rem] font-bold"
        style={{ color: accent ? '#c9a84c' : bold ? '#1a1714' : '#6b6560' }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CartPage() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/cart');
  }, [authLoading, user, router]);

  const fetchCart = async () => {
    try {
      const data = await apiFetch('/api/cart');
      setItems(data.data.cart?.items || []);
      setTotals(data.data.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) fetchCart();
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateQty = async (productId: string, quantity: number) => {
    setUpdating(productId);
    try {
      await apiFetch('/api/cart', {
        method: 'PUT',
        body: JSON.stringify({ productId, quantity }),
      });
      await fetchCart();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update quantity');
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (productId: string) => {
    setUpdating(productId);
    try {
      await apiFetch(`/api/cart?productId=${productId}`, { method: 'DELETE' });
      await fetchCart();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || (loading && user)) return <CartSkeleton />;
  if (!user) return null;
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-sm" style={{ color: '#c97a7a' }}>{error}</p>
      <button
        onClick={fetchCart}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
        style={{ background: '#1a1714', color: '#f5f0e8' }}
      >
        Try Again
      </button>
    </div>
  );
  if (items.length === 0) return <EmptyCart />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[0.65rem] tracking-[0.25em] uppercase font-semibold mb-1.5" style={{ color: '#c9a84c' }}>
            ◆ Your Selection
          </p>
          <h1
            className="font-['Cormorant_Garamond',serif] text-[2.2rem] font-medium leading-none"
            style={{ color: '#1a1714' }}
          >
            Shopping Cart
          </h1>
        </div>
        <span
          className="text-[0.7rem] tracking-wide px-3 py-1.5 rounded-full font-semibold"
          style={{ background: '#faf8f4', border: '1px solid #ede9e1', color: '#7a736a' }}
        >
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Items ── */}
        <div className="flex-1 space-y-3">
          {items.map(item => (
            <CartCard
              key={item.product._id}
              item={item}
              onUpdate={updateQty}
              onRemove={remove}
              updating={updating}
            />
          ))}

          {/* Continue shopping */}
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-[0.73rem] font-semibold mt-2 transition-colors"
            style={{ color: '#a09a90' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c9a84c'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#a09a90'; }}
          >
            <Package size={13} strokeWidth={2} /> Continue shopping
          </Link>
        </div>

        {/* ── Order summary ── */}
        {totals && (
          <div className="lg:w-72 shrink-0">
            <div
              className="rounded-2xl p-6 sticky top-24"
              style={{ background: '#ffffff', border: '1px solid #ede9e1', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
            >
              {/* Title */}
              <div className="flex items-center gap-2 mb-5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: '#c9a84c12', border: '1px solid #c9a84c25' }}
                >
                  <ShoppingBag size={13} strokeWidth={1.8} style={{ color: '#c9a84c' }} />
                </div>
                <h2 className="text-[0.82rem] font-bold" style={{ color: '#1a1714' }}>Order Summary</h2>
              </div>

              {/* Rows */}
              <div className="space-y-3 mb-5">
                <SummaryRow label="Subtotal" value={`$${totals.subtotal.toLocaleString()}`} />
                <SummaryRow label="Tax (8%)" value={`$${totals.tax.toFixed(2)}`} />
                <SummaryRow
                  label="Shipping"
                  value={totals.shippingCost === 0 ? 'Free' : `$${totals.shippingCost}`}
                  accent={totals.shippingCost === 0}
                />
                <div className="h-px" style={{ background: '#ede9e1' }} />
                <SummaryRow label="Total" value={`$${totals.total.toLocaleString()}`} bold />
              </div>

              {/* CTA */}
              <Link
                href="/checkout"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[0.78rem] font-bold tracking-wide transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: '#1a1714', color: '#f5f0e8' }}
              >
                Proceed to Checkout <ArrowRight size={14} strokeWidth={2.5} />
              </Link>

              {/* Trust note */}
              <p className="text-center text-[0.62rem] mt-3" style={{ color: '#c4bdb2' }}>
                🔒 Secure checkout · Free returns
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}