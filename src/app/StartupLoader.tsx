// app/StartupLoader.tsx
'use client';

import { useEffect, useState } from 'react';

export default function StartupLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Cormorant+Garamond:ital,wght@0,300;1,300&display=swap';
    document.head.appendChild(link);

    const loadWebsite = async () => {
      try {
        await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/products/popular'),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setFadeOut(true);
        setTimeout(() => setLoading(false), 900);
      } catch {
        setLoading(false);
      }
    };

    loadWebsite();
  }, []);

  if (!loading) return <>{children}</>;

  return (
    <>
      <style>{`
        @keyframes gem-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(2deg); }
        }
        @keyframes glow-breathe {
          0%, 100% { opacity: 0.5; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ring-spin-rev {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes load-fill {
          0%   { width: 0%; }
          30%  { width: 45%; }
          60%  { width: 72%; }
          85%  { width: 89%; }
          100% { width: 100%; }
        }
        @keyframes dot-pulse {
          0%, 100% { background: rgba(180,145,80,0.2); transform: scale(1); }
          50%       { background: rgba(180,145,80,0.85); transform: scale(1.6); }
        }
        @keyframes bg-breathe {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 1;   transform: translate(-50%, -50%) scale(1.15); }
        }
        .gem-float   { animation: gem-float 4s ease-in-out infinite; }
        .glow-anim   { animation: glow-breathe 3s ease-in-out infinite; }
        .ring-1      { animation: ring-spin 8s linear infinite; }
        .ring-2      { animation: ring-spin-rev 14s linear infinite; }
        .bar-fill    { animation: load-fill 3.4s cubic-bezier(0.4,0,0.2,1) forwards; }
        .dot-1 { animation: dot-pulse 1.5s ease-in-out 0s infinite; }
        .dot-2 { animation: dot-pulse 1.5s ease-in-out 0.2s infinite; }
        .dot-3 { animation: dot-pulse 1.5s ease-in-out 0.4s infinite; }
        .bg-bloom {
          position: absolute;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(180,145,80,0.06) 0%, transparent 70%);
          top: 50%; left: 50%;
          animation: bg-breathe 4s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(ellipse at 60% 30%, #0d2347 0%, #060e1f 55%, #020710 100%)',
          transition: 'opacity 0.85s ease',
          opacity: fadeOut ? 0 : 1,
          pointerEvents: fadeOut ? 'none' : 'all',
        }}
      >
        {/* Ambient bloom */}
        <div className="bg-bloom" />

        {/* Corner accents */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
          <div
            key={pos}
            style={{
              position: 'absolute',
              width: 32, height: 32,
              top: pos.startsWith('t') ? 28 : undefined,
              bottom: pos.startsWith('b') ? 28 : undefined,
              left: pos.endsWith('l') ? 28 : undefined,
              right: pos.endsWith('r') ? 28 : undefined,
              borderColor: 'rgba(180,145,80,0.2)',
              borderStyle: 'solid',
              borderWidth: `${pos.startsWith('t') ? 1 : 0}px ${pos.endsWith('r') ? 1 : 0}px ${pos.startsWith('b') ? 1 : 0}px ${pos.endsWith('l') ? 1 : 0}px`,
            }}
          />
        ))}

        {/* Main content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Gem */}
          <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 44 }}>
            {/* Glow halo */}
            <div
              className="glow-anim"
              style={{
                position: 'absolute',
                inset: -30, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(180,145,80,0.18) 0%, transparent 70%)',
              }}
            />
            {/* Orbit ring 1 */}
            <div
              className="ring-1"
              style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
                border: '1px solid rgba(180,145,80,0.22)',
              }}
            >
              <div style={{
                position: 'absolute', top: -3, left: '50%',
                width: 6, height: 6, borderRadius: '50%',
                background: '#b49150', transform: 'translateX(-50%)',
                boxShadow: '0 0 8px rgba(180,145,80,0.9)',
              }} />
            </div>
            {/* Orbit ring 2 */}
            <div
              className="ring-2"
              style={{
                position: 'absolute', inset: -28, borderRadius: '50%',
                border: '1px solid rgba(180,145,80,0.08)',
              }}
            />
            {/* SVG gem */}
            <svg
              className="gem-float"
              viewBox="0 0 120 120"
              width={120} height={120}
              style={{ filter: 'drop-shadow(0 0 18px rgba(180,145,80,0.4)) drop-shadow(0 0 6px rgba(100,170,255,0.15))' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="sl-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e8c97a" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#b49150" />
                  <stop offset="100%" stopColor="#7a5f30" />
                </linearGradient>
                <linearGradient id="sl-g2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c8e8ff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4a90d9" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id="sl-g3" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fff5d6" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#b49150" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <polygon points="60,18 82,38 60,48 38,38" fill="url(#sl-g3)" opacity="0.95" />
              <polygon points="60,18 82,38 96,22" fill="url(#sl-g1)" opacity="0.8" />
              <polygon points="60,18 38,38 24,22" fill="url(#sl-g1)" opacity="0.6" />
              <polygon points="82,38 96,22 102,48" fill="#c9a55a" opacity="0.7" />
              <polygon points="38,38 24,22 18,48" fill="#8a6932" opacity="0.6" />
              <polygon points="60,48 82,38 102,48" fill="url(#sl-g2)" opacity="0.8" />
              <polygon points="60,48 38,38 18,48" fill="url(#sl-g1)" opacity="0.5" />
              <polygon points="102,48 82,38 92,72" fill="#d4a84b" opacity="0.7" />
              <polygon points="18,48 38,38 28,72" fill="#7a5f30" opacity="0.6" />
              <polygon points="60,48 102,48 92,72" fill="url(#sl-g1)" opacity="0.75" />
              <polygon points="60,48 18,48 28,72" fill="#c9a55a" opacity="0.5" />
              <polygon points="92,72 60,48 60,102" fill="#b49150" opacity="0.85" />
              <polygon points="28,72 60,48 60,102" fill="#8a6932" opacity="0.7" />
              <polygon points="92,72 28,72 60,102" fill="url(#sl-g1)" opacity="0.6" />
              <circle cx="60" cy="100" r="2" fill="#e8c97a" opacity="0.9" />
              <polygon points="60,22 76,36 60,44 44,36" fill="white" opacity="0.12" />
              <circle cx="48" cy="30" r="2.5" fill="white" opacity="0.6" />
              <line x1="48" y1="26" x2="48" y2="34" stroke="white" strokeWidth="0.5" opacity="0.4" />
              <line x1="44" y1="30" x2="52" y2="30" stroke="white" strokeWidth="0.5" opacity="0.4" />
            </svg>
          </div>

          {/* Brand name */}
          <h1 style={{
            fontFamily: "'Cinzel', serif",
            color: '#e8dcc8',
            fontSize: 22,
            letterSpacing: '0.5em',
            fontWeight: 400,
            textTransform: 'uppercase',
            marginBottom: 10,
            textShadow: '0 0 40px rgba(180,145,80,0.3)',
          }}>
            Alpha Imports
          </h1>

          {/* Ornamental divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 260, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(180,145,80,0.5), transparent)' }} />
            <div style={{ width: 5, height: 5, background: '#b49150', transform: 'rotate(45deg)', boxShadow: '0 0 6px rgba(180,145,80,0.6)' }} />
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(180,145,80,0.5), transparent)' }} />
          </div>

          {/* Tagline */}
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            color: 'rgba(200,185,160,0.55)',
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            fontWeight: 300,
            marginBottom: 40,
          }}>
            Fine Diamonds &amp; Timepieces
          </p>

          {/* Progress */}
          <div style={{ width: 200 }}>
            <p style={{
              fontFamily: "'Cinzel', serif",
              color: 'rgba(180,145,80,0.4)',
              fontSize: 9,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: 10,
            }}>
              Curating your collection
            </p>
            <div style={{ width: '100%', height: 1, background: 'rgba(180,145,80,0.12)', overflow: 'hidden' }}>
              <div
                className="bar-fill"
                style={{
                  height: '100%',
                  background: 'linear-gradient(to right, transparent, #b49150, #e8c97a, #b49150)',
                  boxShadow: '0 0 6px rgba(180,145,80,0.6)',
                  width: 0,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
              {['dot-1', 'dot-2', 'dot-3'].map((cls) => (
                <div
                  key={cls}
                  className={cls}
                  style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(180,145,80,0.3)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}