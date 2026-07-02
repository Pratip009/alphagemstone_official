'use client'
import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';

interface ProductCardProps {
  productType?: 'watch' | 'diamond';
  product: {
    _id: string;
    name: string;
    price: number;
    shape?: string | string[];
    size?: number;
    color?: string | string[];
    clarity?: string | string[];
    certification?: string | string[];
    watchBrand?: string;
    watchMovement?: string;
    watchGender?: string;
    watchStyle?: string;
    watchCaseMaterial?: string;
    watchDialColor?: string;
    watchStrapType?: string;
    watchCaseSize?: string;
    images: string[];
    stock: number;
  };
}

function first(val?: string | string[]): string {
  if (!val) return '';
  return Array.isArray(val) ? (val[0] ?? '') : val;
}
function display(val?: string | string[]): string {
  if (!val) return '';
  return Array.isArray(val) ? val.join(', ') : val;
}
function certDisplay(val?: string | string[]): string {
  if (!val) return '';
  const arr = Array.isArray(val) ? val : [val];
  return arr.filter((c) => c !== 'none').join(' · ');
}
function isWatch(p: ProductCardProps['product']): boolean {
  return !!(
    p.watchBrand || p.watchMovement || p.watchGender ||
    p.watchStyle || p.watchCaseMaterial || p.watchDialColor ||
    p.watchStrapType || p.watchCaseSize
  );
}

const WATCH_PLACEHOLDER = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&fit=crop';
const DIAMOND_PLACEHOLDER = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80&fit=crop';

function ProductImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc(fallback)}
      className="pc6-photo"
      draggable={false}
    />
  );
}

function WatchIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M9 5.5V9l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="1" width="4" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <rect x="7" y="14.5" width="4" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function GemIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 16L2 7l2.5-5h9L16 7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M2 7h14M9 16L5 7l4-5 4 5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function buildEyebrow(product: ProductCardProps['product'], watch: boolean): string {
  if (watch) {
    return [product.watchCaseSize, product.watchMovement].filter(Boolean).join(' · ');
  }
  const carat = product.size ? `${product.size} ct` : '';
  return carat;
}

function buildChips(product: ProductCardProps['product'], watch: boolean): string[] {
  if (watch) {
    return [product.watchGender, product.watchStyle, product.watchCaseMaterial].filter(Boolean) as string[];
  }
  const shape = first(product.shape);

  return [shape].filter(Boolean);
}

interface TiltState { rx: number; ry: number; mx: number; my: number; active: boolean; }
const REST_TILT: TiltState = { rx: 0, ry: 0, mx: 50, my: 50, active: false };

export default function ProductCard({ product, productType }: ProductCardProps) {
  const watch = productType ? productType === 'watch' : isWatch(product);
  const isAvailable = product.stock > 0;
  const placeholder = watch ? WATCH_PLACEHOLDER : DIAMOND_PLACEHOLDER;
  const eyebrow = buildEyebrow(product, watch);
  const chips = buildChips(product, watch);
  const certLabel = watch ? product.watchBrand : certDisplay(product.certification);

  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>(REST_TILT);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * 16;
    const rx = (0.5 - py) * 11;
    setTilt({ rx, ry, mx: px * 100, my: py * 100, active: true });
  }, []);

  const handleMouseLeave = useCallback(() => setTilt(REST_TILT), []);

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        .pc6 {
          display: block;
          text-decoration: none;
          color: inherit;
          font-family: 'Playfair Display', serif;
          perspective: 1000px;
        }

        .pc6-card {
          position: relative;
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #EAEAEC;
          padding: 14px;
          display: flex;
          flex-direction: column;
          height: 100%;
          transform-style: preserve-3d;
          box-shadow: 0 1px 2px rgba(20,20,22,0.03), 0 14px 30px -20px rgba(20,20,22,0.14);
          transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.4s ease, border-color 0.4s ease;
        }
        .pc6-card.is-active {
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
          box-shadow: 0 32px 54px -22px rgba(20,20,22,0.22), 0 4px 12px rgba(20,20,22,0.06);
          border-color: #DCDCE0;
        }

        /* thin silver rule that draws in on hover — the card's signature */
        .pc6-card::before {
          content: '';
          position: absolute;
          top: -1px; left: 14px; right: 14px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #B9B9C0, transparent);
          transform: scaleX(0);
          transition: transform 0.5s ease;
          transform-origin: center;
        }
        .pc6-card.is-active::before { transform: scaleX(1); }

        .pc6-mat {
          position: relative;
          width: 100%;
          height: 148px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #FBFBFC 0%, #F2F2F4 100%);
          border-radius: 13px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateZ(28px);
        }

        .pc6-photo {
          max-width: 78%;
          max-height: 78%;
          object-fit: contain;
          filter: drop-shadow(0 10px 14px rgba(20,20,22,0.14));
          transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .pc6-card.is-active .pc6-photo { transform: scale(1.06); }

        /* specular sweep that tracks the cursor */
        .pc6-sheen {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.85), rgba(255,255,255,0) 42%);
          mix-blend-mode: overlay;
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }
        .pc6-card.is-active .pc6-sheen { opacity: 1; }

        .pc6-facet {
          position: absolute;
          width: 16px; height: 16px;
          border-top: 1.5px solid rgba(24,24,27,0.18);
          border-left: 1.5px solid rgba(24,24,27,0.18);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.35s ease;
        }
        .pc6-facet.tl { top: 6px; left: 6px; }
        .pc6-facet.br { bottom: 6px; right: 6px; transform: rotate(180deg); }
        .pc6-card.is-active .pc6-facet { opacity: 1; }

        .pc6-badge {
          position: absolute;
          z-index: 2;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 9px;
          border-radius: 20px;
        }
        .pc6-badge-cert {
          top: 8px; left: 8px;
          background: rgba(255,255,255,0.94);
          color: #18181B;
          border: 1px solid #EAEAEC;
          backdrop-filter: blur(2px);
        }
        .pc6-badge-stock {
          top: 8px; right: 8px;
          background: #FBEAE9;
          color: #B3261E;
        }
        .pc6-badge-type {
          bottom: 8px; left: 8px;
          display: flex; align-items: center; gap: 4px;
        }
        .pc6-badge-type.watch { background: rgba(238,241,244,0.95); color: #475467; }
        .pc6-badge-type.gem   { background: rgba(238,238,241,0.95); color: #3D4FE0; }

        .pc6-sold {
          position: absolute; inset: 0; z-index: 3;
          background: rgba(255,255,255,0.92);
          display: flex; align-items: center; justify-content: center;
        }
        .pc6-sold span {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 20px;
          background: #F7F7F8;
          color: #8E8E93;
          border: 1px solid #EAEAEC;
        }

        .pc6-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          transform: translateZ(16px);
        }
        .pc6-eyebrow {
          margin-top: 12px;
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #8E8E93;
        }
        .pc6-name {
          margin-top: 3px;
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 500;
          color: #18181B;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .pc6-chips {
          margin-top: 7px;
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .pc6-chip {
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: #5B5B63;
          background: #F7F7F8;
          border: 1px solid #E4E4E8;
          border-radius: 6px;
          padding: 3px 7px;
          white-space: nowrap;
        }

        .pc6-price-row {
          margin-top: 12px;
          padding-top: 11px;
          border-top: 1px solid #EAEAEC;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .pc6-price {
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 600;
          color: #18181B;
          letter-spacing: -0.01em;
        }
        .pc6-avail {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          font-weight: 400;
          color: #1F7A4D;
        }
        .pc6-avail .pc6-dot { width: 5px; height: 5px; border-radius: 50%; background: #1F7A4D; }
        .pc6-avail.out { color: #8E8E93; }
        .pc6-avail.out .pc6-dot { background: #8E8E93; }
      `}</style>

      <Link
        href={`/products/${product._id}`}
        className="pc6"
        style={{ ['--mx' as string]: `${tilt.mx}%`, ['--my' as string]: `${tilt.my}%` }}
      >
        <div
          ref={cardRef}
          className={`pc6-card ${tilt.active ? 'is-active' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) ${tilt.active ? 'scale3d(1.015,1.015,1.015)' : 'scale3d(1,1,1)'}` }}
        >

          <div className="pc6-mat">
            {product.images[0] ? (
              <ProductImage src={product.images[0]} alt={product.name} fallback={placeholder} />
            ) : (
              <img src={placeholder} alt={product.name} className="pc6-photo" />
            )}

            <div className="pc6-sheen" />
            <span className="pc6-facet tl" />
            <span className="pc6-facet br" />

            {certLabel && (
              <div className="pc6-badge pc6-badge-cert">{certLabel}</div>
            )}

            {isAvailable && product.stock <= 3 && (
              <div className="pc6-badge pc6-badge-stock">{product.stock} left</div>
            )}

            {!isAvailable && (
              <div className="pc6-sold">
                <span>Unavailable</span>
              </div>
            )}

            <div className={`pc6-badge pc6-badge-type ${watch ? 'watch' : 'gem'}`}>
              {watch ? <WatchIcon /> : <GemIcon />}
              {watch ? 'Watch' : 'Gem'}
            </div>
          </div>

          <div className="pc6-body">
            {eyebrow && <div className="pc6-eyebrow">{eyebrow}</div>}
            <div className="pc6-name">{product.name}</div>

            {chips.length > 0 && (
              <div className="pc6-chips">
                {chips.map((c, i) => (
                  <span key={i} className="pc6-chip">{c}</span>
                ))}
              </div>
            )}

            <div className="pc6-price-row">
              <span className="pc6-price">${product.price.toLocaleString()}</span>
              <span className={`pc6-avail ${isAvailable ? '' : 'out'}`}>
                <span className="pc6-dot" />
                {isAvailable ? `${product.stock} available` : 'Sold out'}
              </span>
            </div>
          </div>

        </div>
      </Link>
    </>
  );
}