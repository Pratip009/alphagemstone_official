'use client';

import { useEffect, useState } from 'react';

export default function StartupLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  // ── Data preload ────────────────────────────────────────────────
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;700&display=swap';
    document.head.appendChild(link);

    const loadData = async () => {
      try {
        await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/products/popular'),
        ]);
        await new Promise((r) => setTimeout(r, 1800));
      } catch {}
      setFadeOut(true);
      setTimeout(() => setLoading(false), 700);
    };

    loadData();
  }, []);

  if (!loading) return <>{children}</>;

  return (
    <>
      <style>{`
        @keyframes sl-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Container that positions the text block — flexbox handles all alignment */
        .sl-frame {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          text-align: left;
          padding: 0 80px;
        }

        .sl-text {
          max-width: 640px;
          animation: sl-fade-in 0.8s ease 0.2s both;
        }

        .sl-gradient {
          background: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.55) 0%,
            rgba(0, 0, 0, 0.25) 45%,
            rgba(0, 0, 0, 0) 70%
          );
        }

        /* Tablets and below: center everything, tighten side padding */
        @media (max-width: 900px) {
          .sl-frame {
            justify-content: center;
            text-align: center;
            padding: 0 48px;
          }
          .sl-text {
            max-width: 560px;
          }
          .sl-gradient {
            background: linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.55) 0%,
              rgba(0, 0, 0, 0.3) 55%,
              rgba(0, 0, 0, 0.15) 100%
            );
          }
        }

        /* Phones */
        @media (max-width: 480px) {
          .sl-frame {
            padding: 0 24px;
          }
          .sl-text {
            max-width: 100%;
          }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#000',
          transition: 'opacity 0.7s ease',
          opacity: fadeOut ? 0 : 1,
          pointerEvents: fadeOut ? 'none' : 'all',
          overflow: 'hidden',
        }}
      >
        {/* Fullscreen background video — swap the src for your file */}
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src="/video/videoplayback.mp4" type="video/mp4" />
        </video>

        {/* Gradient so white text stays readable over any footage */}
        <div className="sl-gradient" style={{ position: 'absolute', inset: 0 }} />

        {/* Flex frame handles left-align on desktop, center on mobile/tablet */}
        <div className="sl-frame" style={{ pointerEvents: 'none' }}>
          <div className="sl-text">
            <div
              style={{
                fontFamily: '"Josefin Sans", sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(30px, 6vw, 68px)',
                lineHeight: 1.08,
                letterSpacing: '0.04em',
                color: '#ffffff',
                textTransform: 'uppercase',
                textShadow: '0 2px 24px rgba(0,0,0,0.35)',
              }}
            >
              Alpha
              <br />
              Gemstones
            </div>
            <div
              style={{
                marginTop: 16,
                fontFamily: '"Josefin Sans", sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(11px, 1.4vw, 15px)',
                letterSpacing: '0.3em',
                color: 'rgba(255,255,255,0.8)',
                textTransform: 'uppercase',
                textShadow: '0 2px 12px rgba(0,0,0,0.35)',
              }}
            >
              Fine Diamonds &amp; Gemstones
            </div>
          </div>
        </div>
      </div>
    </>
  );
}