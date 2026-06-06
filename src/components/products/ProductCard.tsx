'use client'
import Link from 'next/link';
import { useState } from 'react';

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
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

function WatchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M9 5.5V9l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="1" width="4" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <rect x="7" y="14.5" width="4" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 16L2 7l2.5-5h9L16 7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M2 7h14M9 16L5 7l4-5 4 5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function AttrRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, lineHeight: 1.4 }}>
      <span style={{ color: '#999', fontWeight: 400 }}>{label}</span>
      <span style={{ color: '#444', fontWeight: 500, textAlign: 'right', maxWidth: '58%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export default function ProductCard({ product, productType }: ProductCardProps) {
  const watch = productType ? productType === 'watch' : isWatch(product);
  const isAvailable = product.stock > 0;
  const placeholder = watch ? WATCH_PLACEHOLDER : DIAMOND_PLACEHOLDER;

  return (
    <>
      <style>{`
        .pc2 {
          display: block;
          text-decoration: none;
          color: inherit;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .pc2-card {
          background: #ffffff;
          border-radius: 12px;
          border: 0.5px solid rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .pc2:hover .pc2-card {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.09);
        }
        .pc2-img {
          position: relative;
          width: 100%;
          padding-top: 100%;
          flex-shrink: 0;
          overflow: hidden;
        }
        .pc2-img-bg-watch { background: #1a1e2a; }
        .pc2-img-bg-diamond { background: #f5f3ff; }
        .pc2-badge-tl {
          position: absolute;
          top: 8px; left: 8px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 7px;
          border-radius: 6px;
          background: rgba(255,255,255,0.92);
          border: 0.5px solid rgba(0,0,0,0.1);
          z-index: 2;
        }
        .pc2-badge-tl.watch { color: #185fa5; border-color: #b5d4f4; }
        .pc2-badge-tl.diamond { color: #534ab7; border-color: #afa9ec; }
        .pc2-badge-stock {
          position: absolute;
          top: 8px; right: 8px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 7px;
          border-radius: 6px;
          background: rgba(234,243,222,0.95);
          color: #3b6d11;
          border: 0.5px solid #c0dd97;
          z-index: 2;
        }
        .pc2-badge-type {
          position: absolute;
          bottom: 8px; left: 8px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 2;
        }
        .pc2-badge-type.watch { background: rgba(230,241,251,0.95); color: #185fa5; border: 0.5px solid #b5d4f4; }
        .pc2-badge-type.diamond { background: rgba(238,237,254,0.95); color: #534ab7; border: 0.5px solid #afa9ec; }
        .pc2-sold-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }
        .pc2-sold-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 6px;
          background: #fff;
          border: 0.5px solid rgba(0,0,0,0.15);
          color: #888;
        }
        .pc2-body {
          padding: 10px 11px 12px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
        }
        .pc2-name {
          font-size: 13px;
          font-weight: 500;
          color: #111;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: 'Playfair Display', Georgia, serif;
        }
        .pc2-sub {
          font-size: 10px;
          color: #999;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pc2-attrs {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 3px;
        }
        .pc2-divider {
          height: 0.5px;
          background: rgba(0,0,0,0.07);
          margin: 3px 0;
        }
        .pc2-price-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .pc2-price {
          font-size: 17px;
          font-weight: 400;
          color: #111;
          font-family: 'Playfair Display', Georgia, serif;
        }
        .pc2-avail-in  { font-size: 9px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #3b6d11; }
        .pc2-avail-out { font-size: 9px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #a32d2d; }
      `}</style>

      <Link href={`/products/${product._id}`} className="pc2">
        <div className="pc2-card">

          {/* Image */}
          <div className={`pc2-img ${watch ? 'pc2-img-bg-watch' : 'pc2-img-bg-diamond'}`}>
            {product.images[0] ? (
              <ProductImage src={product.images[0]} alt={product.name} fallback={placeholder} />
            ) : (
              <img
                src={placeholder}
                alt={product.name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {/* Top-left: brand/cert */}
            {(watch ? product.watchBrand : certDisplay(product.certification)) && (
              <div className={`pc2-badge-tl ${watch ? 'watch' : 'diamond'}`}>
                {watch ? product.watchBrand : certDisplay(product.certification)}
              </div>
            )}

            {/* Top-right: low stock */}
            {isAvailable && product.stock <= 3 && (
              <div className="pc2-badge-stock">{product.stock} left</div>
            )}

            {/* Sold out overlay */}
            {!isAvailable && (
              <div className="pc2-sold-overlay">
                <span className="pc2-sold-label">Unavailable</span>
              </div>
            )}

            {/* Type pill */}
            <div className={`pc2-badge-type ${watch ? 'watch' : 'diamond'}`}>
              {watch ? <WatchIcon /> : <DiamondIcon />}
              {watch ? 'Watch' : 'Diamond'}
            </div>
          </div>

          {/* Body */}
          <div className="pc2-body">
            <div className="pc2-name">{product.name}</div>

            {/* Subtitle */}
            <div className="pc2-sub">
              {watch
                ? [product.watchBrand, product.watchMovement].filter(Boolean).join(' · ')
                : [first(product.shape), product.size ? `${product.size}ct` : ''].filter(Boolean).join(' · ')
              }
            </div>

            {/* Attributes */}
            <div className="pc2-attrs">
              {watch ? (
                <>
                  <AttrRow label="Gender"   value={product.watchGender} />
                  <AttrRow label="Movement" value={product.watchMovement} />
                  <AttrRow label="Strap"    value={product.watchStrapType} />
                  <AttrRow label="Case"     value={[product.watchCaseSize, product.watchCaseMaterial].filter(Boolean).join(' ')} />
                  <AttrRow label="Dial"     value={product.watchDialColor} />
                  <AttrRow label="Style"    value={product.watchStyle} />
                </>
              ) : (
                <>
                  <AttrRow label="Shape"   value={first(product.shape)} />
                  <AttrRow label="Carat"   value={product.size ? `${product.size} ct` : undefined} />
                  <AttrRow label="Color"   value={display(product.color)} />
                  <AttrRow label="Clarity" value={display(product.clarity)} />
                  <AttrRow label="Cert"    value={certDisplay(product.certification) || undefined} />
                </>
              )}
            </div>

            <div className="pc2-divider" />

            <div className="pc2-price-row">
              <span className="pc2-price">${product.price.toLocaleString()}</span>
              <span className={isAvailable ? 'pc2-avail-in' : 'pc2-avail-out'}>
                {isAvailable ? `${product.stock} available` : 'Sold out'}
              </span>
            </div>
          </div>

        </div>
      </Link>
    </>
  );
}