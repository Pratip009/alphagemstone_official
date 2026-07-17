'use client';
import ProductCard from '@/components/products/ProductCard';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

interface RecentlyViewedProductsProps {
  /** Exclude this product (e.g. the one currently being viewed). */
  excludeId?: string;
  /** Max cards to show. */
  limit?: number;
  title?: string;
}

/**
 * "Recently Viewed" strip. Fully self-contained:
 *  - Reads the visitor's local history, hydrates it against live product
 *    data, and renders nothing at all if there's no history yet or if
 *    everything in it turned out to be excluded/unavailable — no empty
 *    section, no layout shift, no "0 items" message.
 *  - Safe to drop onto any page (product detail, cart, homepage) since it
 *    carries its own scoped styles and doesn't assume any page context.
 */
export default function RecentlyViewedProducts({
  excludeId,
  limit = 8,
  title = 'Recently Viewed',
}: RecentlyViewedProductsProps) {
  const { items, loading, error, clear } = useRecentlyViewed({ excludeId, limit });

  // Nothing to show yet (no history, still loading, or a fetch error with
  // nothing cached) — stay invisible rather than showing an empty shell.
  if (items.length === 0) return null;

  return (
    <section className="rv-section" aria-label={title}>
      <style>{`
        .rv-section { margin: 64px 0; }
        .rv-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
        .rv-title { font-family: "Elms Sans", "Google Sans Flex", sans-serif; font-size: 22px; font-weight: 500; color: #111010; letter-spacing: -0.01em; margin: 0; }
        .rv-clear { font-family: "Elms Sans", sans-serif; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8178; background: none; border: none; cursor: pointer; padding: 4px 0; transition: color 0.2s; }
        .rv-clear:hover { color: #b8955a; }
        .rv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; opacity: ${loading ? 0.6 : 1}; transition: opacity 0.2s; }
        @media (max-width: 900px) { .rv-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .rv-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="rv-head">
        <h2 className="rv-title">{title}</h2>
        <button type="button" className="rv-clear" onClick={clear}>
          Clear history
        </button>
      </div>

      {error && items.length === 0 ? null : (
        <div className="rv-grid">
          {items.map((product) => (
            <ProductCard key={product._id} product={product as any} />
          ))}
        </div>
      )}
    </section>
  );
}