'use client';

import { useEffect, useState } from 'react';


export default function StartupLoader({ children }: { children: React.ReactNode }) {
  
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setFadeOut(true);
      setTimeout(() => setShow(false), 300);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {children}
      {show && (
        <div
          aria-hidden="true"
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
            pointerEvents: 'none',
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
      )}
    </>
  );
}