'use client';

import { useCallback, useEffect, useState } from 'react';
import CompareStonesTool, { CompareSlotData, SearchProduct, makeEmptySlot } from './CompareStonesTool';

export interface CompareLaunchButtonProps {
  product: SearchProduct;
  className?: string;
}

// "Compare This Stone" — used on the product detail page. Opens the Compare
// Stones tool in a modal with this product pre-filled as Stone A; Stone B+
// are live search boxes for whatever the shopper wants to compare it against.
export default function CompareLaunchButton({ product, className = 'btn-secondary' }: CompareLaunchButtonProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  const buildInitialSlots = (): CompareSlotData[] => [makeEmptySlot(product), makeEmptySlot(null)];

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Compare This Stone
      </button>

      {open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26, 24, 20, 0.6)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="card-luxury"
            style={{ width: '100%', maxWidth: 1100, padding: '32px 28px', position: 'relative', background: 'var(--bg)' }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close compare tool"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: '1.4rem',
                lineHeight: 1,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              ×
            </button>
            <p className="section-subtitle" style={{ marginBottom: 6 }}>
              Alpha Imports
            </p>
            <h2 className="font-display" style={{ fontSize: '1.5rem', marginBottom: 20 }}>
              Compare Stones
            </h2>
            <CompareStonesTool initialSlots={buildInitialSlots()} />
          </div>
        </div>
      )}
    </>
  );
}