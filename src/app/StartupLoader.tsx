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

        /* Gradual continuous spin for the diamond glyph, with a slight
           wobble on the X axis so light appears to travel across facets */
        @keyframes sl-diamond-spin {
          0%   { transform: rotateY(0deg)   rotateX(6deg); }
          50%  { transform: rotateY(180deg) rotateX(-4deg); }
          100% { transform: rotateY(360deg) rotateX(6deg); }
        }

        /* Sparkle highlight that sweeps across the stone as it turns */
        @keyframes sl-diamond-glint {
          0%, 100% { opacity: 0.15; }
          50%      { opacity: 0.9; }
        }

        /* Container that positions the diamond glyph inline with the
           headline text. Sized in em so it always scales with the
           surrounding clamp()-based font-size — this is what keeps it
           responsive across phones, tablets, and desktop. */
        .sl-diamond {
          display: inline-block;
          vertical-align: -0.16em;
          width: 1.1em;
          height: 1.1em;
          margin: 0 0.02em;
          perspective: 320px;
        }

        .sl-diamond svg {
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: sl-diamond-spin 4.5s ease-in-out infinite;
          filter: drop-shadow(0 0.04em 0.06em rgba(0, 0, 0, 0.5));
        }

        .sl-diamond-glint {
          animation: sl-diamond-glint 2.2s ease-in-out infinite;
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
          .sl-diamond {
            width: 1em;
            height: 1em;
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
              Gemst
              <span className="sl-diamond" aria-hidden="true">
                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    {/* Soft sparkle overlay */}
                    <radialGradient id="sl-glint" cx="45%" cy="30%" r="45%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Every facet is pure white — brightness (fillOpacity) varies by
                      facet so the cut still reads as 3D against the dark backdrop,
                      without introducing any color. */}
                  <path fill="#ffffff" fillOpacity="0.92" d="M121.72,32A4,4,0,0,0,118,37.56l2.3,5.43L161,137.89a4,4,0,0,0,6.88.82L243,38.4a4,4,0,0,0-3.2-6.4Z" />
                  <path fill="#ffffff" fillOpacity="0.62" d="M419.93,58.06l-41.28,96.37a4,4,0,0,0,3.68,5.57h101a4,4,0,0,0,3.4-6.11L427,57.53A4,4,0,0,0,419.93,58.06Z" />
                  <path fill="#ffffff" fillOpacity="0.8" d="M85,57.57,25.29,153.89a4,4,0,0,0,3.4,6.11h101a4,4,0,0,0,3.67-5.58L92,58.1A4,4,0,0,0,85,57.57Z" />
                  <path fill="#ffffff" fillOpacity="0.55" d="M393.27,32H267.82a1.94,1.94,0,0,0-1.56,3.11l79.92,106.46a1.94,1.94,0,0,0,3.34-.4L391.6,43,395,34.66A1.92,1.92,0,0,0,393.3,32Z" />
                  <path fill="#ffffff" fillOpacity="1" d="M239,448,149.57,194.51A3.78,3.78,0,0,0,146,192H25.7a3.72,3.72,0,0,0-2.95,6l216,279.81a5.06,5.06,0,0,0,6.39,1.37h0a5,5,0,0,0,2.39-6.08Z" />
                  <path fill="#ffffff" fillOpacity="0.45" d="M486.3,192H366a3.75,3.75,0,0,0-3.54,2.51L264.26,472.67a5.21,5.21,0,0,0,2.42,6.31h0a5.22,5.22,0,0,0,6.61-1.39L489.25,198h0A3.72,3.72,0,0,0,486.3,192Z" />
                  <path fill="#ffffff" fillOpacity="0.98" d="M259.2,78.93l56,74.67A4,4,0,0,1,312,160H200a4,4,0,0,1-3.2-6.4l56-74.67A4,4,0,0,1,259.2,78.93Zm-7,310.31L184.5,197.33a4,4,0,0,1,3.77-5.33H323.73a4,4,0,0,1,3.77,5.33L259.77,389.24A4,4,0,0,1,252.23,389.24Z" />

                  {/* Traveling sparkle highlight */}
                  <ellipse className="sl-diamond-glint" cx="230" cy="130" rx="55" ry="30" fill="url(#sl-glint)" />
                </svg>
              </span>
              nes
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