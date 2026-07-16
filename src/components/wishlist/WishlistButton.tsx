'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Full "Save to Wishlist" button — used on the product detail page.
export default function WishlistButton({
  productId,
  className = 'pd-btn-secondary',
}: {
  productId: string;
  className?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const { isInWishlist, toggle, loading } = useWishlist();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const saved = isInWishlist(productId);

  const handleClick = async () => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      await toggle(productId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update wishlist');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy || loading}
      className={className}
      style={saved ? { borderColor: '#b8955a', color: '#b8955a' } : undefined}
      aria-pressed={saved}
    >
      <HeartIcon filled={saved} />
      {saved ? 'Saved to Wishlist' : 'Save to Wishlist'}
    </button>
  );
}

// Compact heart icon — sits on ProductCard images / navbar.
export function WishlistIconButton({
  productId,
  size = 'md',
}: {
  productId: string;
  size?: 'sm' | 'md';
}) {
  const { user, loading: authLoading } = useAuth();
  const { isInWishlist, toggle } = useWishlist();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const saved = isInWishlist(productId);
  const dims = size === 'sm' ? 26 : 32;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (authLoading || busy) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      await toggle(productId);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={saved}
      style={{
        width: dims,
        height: dims,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.94)',
        border: '1px solid #EAEAEC',
        color: saved ? '#c0392b' : '#8E8E93',
        cursor: 'pointer',
        transition: 'color 0.2s, transform 0.15s, border-color 0.2s',
        backdropFilter: 'blur(2px)',
        flexShrink: 0,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.9)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}