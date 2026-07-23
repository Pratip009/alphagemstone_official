'use client';

import { useEffect, useState } from 'react';

// Previously this held a full-screen autoplay video behind a *minimum*
// 1800ms artificial delay (plus a setTimeout fade), and its own three
// fetches to /api/products, /api/categories, and /api/products/popular
// that duplicated work ShopLayout already does on mount. That added
// roughly 2.5s of dead time in front of every first visit and was a big
// contributor to a bloated Speed Index. It also injected yet another
// ad-hoc Google Font <link> at runtime (Josefin Sans) instead of using
// the one font already loaded site-wide in the root layout.
//
// This version is just a brief branded flash that clears on the next
// paint — no video, no artificial wait, no duplicate network calls.
export default function StartupLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setFadeOut(true);
      setTimeout(() => setLoading(false), 300);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!loading) return <>{children}</>;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0b1220',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        transition: 'opacity 0.3s ease',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      <div
        style={{
          fontFamily: '"Elms Sans", sans-serif',
          fontWeight: 600,
          fontSize: 'clamp(20px, 4vw, 30px)',
          letterSpacing: '0.1em',
          color: '#ffffff',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
       
        Alpha Gemstones
      </div>

      <div
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          border: '2.5px solid rgba(255,255,255,0.18)',
          borderTopColor: '#d4af6a',
          animation: 'sl-spin 0.7s linear infinite',
        }}
      />

      <style>{`
        @keyframes sl-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}