'use client';
import { useState, useRef, useCallback } from 'react';

// ─── Unsplash fallbacks ───────────────────────────────────────────────────────
const SHAPE_UNSPLASH: Record<string, string> = {
  round:     'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80&fit=crop',
  brilliant: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80&fit=crop',
  oval:      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800&q=80&fit=crop',
  pear:      'https://images.unsplash.com/photo-1573408301185-9519f94816b5?w=800&q=80&fit=crop',
  cushion:   'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800&q=80&fit=crop',
  princess:  'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800&q=80&fit=crop',
  emerald:   'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=800&q=80&fit=crop',
  radiant:   'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80&fit=crop',
  marquise:  'https://images.unsplash.com/photo-1616750819459-8abd8e2d5626?w=800&q=80&fit=crop',
  heart:     'https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=800&q=80&fit=crop',
  asscher:   'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=800&q=80&fit=crop',
};
const FALLBACK_UNSPLASH = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80&fit=crop';

function getPlaceholder(shape: string): string {
  return SHAPE_UNSPLASH[shape.toLowerCase()] ?? FALLBACK_UNSPLASH;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductGalleryProps {
  images: string[];
  name: string;
  certBadge: string | null;
  inStock: boolean;
  shape?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProductGallery({
  images,
  name,
  certBadge,
  inStock,
  shape = 'round',
}: ProductGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  // 'ok' | 'placeholder' | 'fallback' | 'dead'
  const [errorStages, setErrorStages] = useState<Record<number, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const THUMB_SLOTS = 4;
  const realImages = images.slice(0, THUMB_SLOTS);
  const placeholderCount = Math.max(0, THUMB_SLOTS - realImages.length);
  const shapePlaceholder = getPlaceholder(shape);

  function resolvedSrc(i: number): string {
    const stage = errorStages[i];
    if (!stage || stage === 'ok') return realImages[i] ?? shapePlaceholder;
    if (stage === 'placeholder') return shapePlaceholder;
    if (stage === 'fallback') return FALLBACK_UNSPLASH;
    return FALLBACK_UNSPLASH; // dead — stays on fallback, no more retries
  }

  function handleImgError(i: number) {
    setErrorStages(prev => {
      const cur = prev[i];
      if (!cur || cur === 'ok') return { ...prev, [i]: 'placeholder' };
      if (cur === 'placeholder') return { ...prev, [i]: 'fallback' };
      // already on fallback or dead — stop
      return prev;
    });
  }

  const activeSrc = realImages.length > 0
    ? resolvedSrc(activeIdx)
    : shapePlaceholder;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  return (
    <>
      <style>{`
        .pg-container {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #f0ede6;
          border: 1px solid #e2ddd5;
          overflow: hidden;
          cursor: crosshair;
        }
        .pg-zoom-wrap {
          position: absolute;
          inset: 0;
          will-change: transform;
        }
        .pg-zoom-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          user-select: none;
          draggable: false;
        }
        .pg-lens {
          position: absolute;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 1px solid rgba(180,150,80,0.7);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.25) inset, 0 2px 16px rgba(0,0,0,0.1);
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 10;
        }
        .pg-hint {
          position: absolute;
          bottom: 12px; right: 12px;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #a09a90;
          background: rgba(250,249,246,0.92);
          border: 0.5px solid #e2ddd5;
          padding: 4px 10px;
          pointer-events: none;
          font-family: 'DM Sans', sans-serif;
          z-index: 10;
        }
        .pg-thumbs {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        .pg-thumb {
          width: 56px; height: 56px;
          flex-shrink: 0;
          background: #f0ede6;
          border: 1px solid #e2ddd5;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pg-thumb:hover { border-color: #b09a70; box-shadow: 0 2px 8px rgba(120,100,60,0.12); }
        .pg-thumb.active { border-color: #b09a70; box-shadow: 0 0 0 1.5px #b09a70; }
        .pg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pg-thumb-inactive { opacity: 0.4; cursor: default; }
      `}</style>

      <div>
        {/* ── Main image + zoom ── */}
        <div className="relative">
          <div
            ref={containerRef}
            className="pg-container"
            onMouseEnter={() => setIsZooming(true)}
            onMouseLeave={() => setIsZooming(false)}
            onMouseMove={handleMouseMove}
          >
            <div
              className="pg-zoom-wrap"
              style={{
                transformOrigin: `${origin.x}% ${origin.y}%`,
                transform: isZooming ? 'scale(2.2)' : 'scale(1)',
                transition: isZooming ? 'transform 0.06s linear' : 'transform 0.3s ease',
              }}
            >
              <img
                key={`main-${activeIdx}-${errorStages[activeIdx] ?? 'ok'}`}
                src={activeSrc}
                alt={name}
                onError={() => handleImgError(activeIdx)}
                draggable={false}
              />
            </div>

            {isZooming && (
              <div className="pg-lens" style={{ left: `${origin.x}%`, top: `${origin.y}%` }} />
            )}
            {!isZooming && (
              <div className="pg-hint">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1"/>
                  <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  <line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  <line x1="6" y1="4" x2="6" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                Hover to zoom
              </div>
            )}
          </div>

          {certBadge && (
            <div style={{
              position:'absolute', top:12, left:12, zIndex:20,
              background:'#faf9f6', border:'1px solid #c8b87a',
              color:'#8a6e2a', fontSize:'9px', fontWeight:500,
              letterSpacing:'0.18em', textTransform:'uppercase', padding:'4px 10px',
            }}>
              {certBadge} Certified
            </div>
          )}

          {!inStock && (
            <div style={{
              position:'absolute', inset:0, zIndex:20,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'rgba(250,249,246,0.80)',
            }}>
              <span style={{
                border:'1px solid #c8c2b8', color:'#a09a90',
                fontSize:'9px', fontWeight:500,
                letterSpacing:'0.2em', textTransform:'uppercase', padding:'6px 18px',
              }}>
                Unavailable
              </span>
            </div>
          )}
        </div>

        {/* ── Thumbnails ── */}
        <div className="pg-thumbs">
          {realImages.map((_, i) => (
            <div
              key={i}
              className={`pg-thumb ${i === activeIdx ? 'active' : ''}`}
              onClick={() => { setActiveIdx(i); setIsZooming(false); }}
            >
              <img
                key={`thumb-${i}-${errorStages[i] ?? 'ok'}`}
                src={resolvedSrc(i)}
                alt={`${name} view ${i + 1}`}
                onError={() => handleImgError(i)}
              />
            </div>
          ))}

          {Array.from({ length: placeholderCount }, (_, i) => (
            <div key={`ph-${i}`} className="pg-thumb pg-thumb-inactive">
              <img src={shapePlaceholder} alt="" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}