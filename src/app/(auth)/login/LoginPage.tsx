'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      const redirect = searchParams.get('redirect') || '/products';
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Barlow+Condensed:wght@200;300;400;500&display=swap');

        :root {
          --navy:   #1a1a2e;
          --deep:   #0f3460;
          --ink:    #16213e;
          --violet: #7c3aed;
          --gold:   #b8922a;
          --gold-l: #e8c96a;
          --cream:  #f0e8d0;
          --mist:   #f5f3ff;
          --lilac:  #ede9fe;
          --petal:  #c4b5fd;
          --silver: #9f9fc0;
          --border: #e8e4f8;
          --display: 'Playfair Display', Georgia, serif;
          --label:   'Barlow Condensed', sans-serif;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Root ── */
        .auth-root {
          min-height: 100vh;
          display: flex;
          font-family: var(--display);
          background: #faf9f7;
          overflow: hidden;
        }

        /* ════════════════════════════════
           LEFT PANEL
        ════════════════════════════════ */
        .auth-left {
          display: none;
          position: relative;
          width: 46%;
          flex-shrink: 0;
          background: var(--navy);
          overflow: hidden;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 52px 52px;
        }
        @media (min-width: 900px) { .auth-left { display: flex; } }

        /* Deep layered background */
        .auth-left-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 110%, rgba(15,52,96,0.9) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 90% -10%, rgba(124,58,237,0.18) 0%, transparent 55%),
            linear-gradient(160deg, #0d1117 0%, #0f1e35 40%, #1a1a2e 100%);
        }

        /* Subtle grid lines */
        .auth-left-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(165,180,252,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(165,180,252,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }

        /* Glowing orb */
        .auth-left-orb {
          position: absolute;
          width: 420px;
          height: 420px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -52%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(15,52,96,0.55) 0%, rgba(124,58,237,0.12) 45%, transparent 70%);
          animation: orbPulse 6s ease-in-out infinite;
        }
        @keyframes orbPulse {
          0%, 100% { transform: translate(-50%, -52%) scale(1);   opacity: 0.7; }
          50%       { transform: translate(-50%, -52%) scale(1.1); opacity: 1; }
        }

        /* Diamond grid decoration */
        .auth-left-diamonds {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .auth-left-diamonds svg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -54%);
          animation: diamondFloat 8s ease-in-out infinite;
        }
        @keyframes diamondFloat {
          0%, 100% { transform: translate(-50%, -54%); }
          50%       { transform: translate(-50%, -57%); }
        }

        /* Scan line */
        .auth-left-scan {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.06) 3px,
            rgba(0,0,0,0.06) 4px
          );
          mix-blend-mode: multiply;
          pointer-events: none;
        }

        /* Top logo area */
        .auth-left-logo {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .auth-left-logo-gem {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--deep), var(--violet));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(124,58,237,0.35);
        }
        .auth-left-logo-text {
          font-family: var(--display);
          font-size: 16px;
          font-weight: 400;
          color: rgba(240,235,255,0.9);
          letter-spacing: 0.02em;
        }
        .auth-left-logo-sub {
          font-family: var(--label);
          font-size: 9px;
          font-weight: 300;
          letter-spacing: 0.22em;
          color: var(--silver);
          text-transform: uppercase;
          display: block;
          margin-top: 1px;
        }

        /* Center content */
        .auth-left-center {
          position: relative;
          z-index: 2;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Bottom text */
        .auth-left-bottom {
          position: relative;
          z-index: 2;
        }
        .auth-left-eyebrow {
          font-family: var(--label);
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--petal);
          opacity: 0.75;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .auth-left-eyebrow::before {
          content: '';
          width: 28px;
          height: 1px;
          background: linear-gradient(to right, var(--petal), transparent);
        }
        .auth-left-headline {
          font-family: var(--display);
          font-size: 34px;
          font-weight: 300;
          line-height: 1.2;
          color: rgba(240,235,255,0.92);
          margin: 0 0 14px;
          letter-spacing: -0.01em;
        }
        .auth-left-headline em {
          font-style: italic;
          color: rgba(196,181,253,0.85);
        }
        .auth-left-sub {
          font-family: var(--label);
          font-size: 13px;
          font-weight: 300;
          color: rgba(159,159,192,0.65);
          line-height: 1.7;
          max-width: 300px;
          letter-spacing: 0.02em;
        }

        /* Floating stat cards */
        .auth-stat-cards {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }
        .auth-stat-card {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(165,180,252,0.1);
          border-radius: 8px;
          padding: 12px 14px;
          backdrop-filter: blur(8px);
        }
        .auth-stat-number {
          font-family: var(--display);
          font-size: 20px;
          font-weight: 400;
          color: rgba(196,181,253,0.9);
          line-height: 1;
        }
        .auth-stat-label {
          font-family: var(--label);
          font-size: 10px;
          font-weight: 300;
          letter-spacing: 0.1em;
          color: rgba(159,159,192,0.55);
          margin-top: 4px;
          text-transform: uppercase;
        }

        /* ════════════════════════════════
           RIGHT PANEL
        ════════════════════════════════ */
        .auth-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
          background: #faf9f7;
          position: relative;
        }

        /* Subtle right-side texture */
        .auth-right::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-right::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(15,52,96,0.04) 0%, transparent 70%);
          pointer-events: none;
        }

        .auth-form-shell {
          width: 100%;
          max-width: 390px;
          position: relative;
          z-index: 1;
          animation: formSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes formSlideUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Mobile brand pill */
        .auth-mobile-brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 36px;
        }
        @media (min-width: 900px) { .auth-mobile-brand { display: none; } }
        .auth-mobile-gem {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, var(--deep), var(--violet));
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 3px 10px rgba(124,58,237,0.3);
        }
        .auth-mobile-brand-text {
          font-family: var(--display);
          font-size: 15px;
          font-weight: 400;
          color: var(--navy);
        }

        /* Heading */
        .auth-heading {
          font-family: var(--display);
          font-size: 33px;
          font-weight: 400;
          color: var(--navy);
          margin: 0 0 6px;
          letter-spacing: -0.01em;
          animation: formSlideUp 0.7s 0.06s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-subheading {
          font-family: var(--label);
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: #8a8898;
          margin: 0 0 38px;
          animation: formSlideUp 0.7s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        /* ── Fields ── */
        .auth-field {
          margin-bottom: 22px;
          animation: formSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-field:nth-child(1) { animation-delay: 0.14s; }
        .auth-field:nth-child(2) { animation-delay: 0.2s; }

        .auth-label {
          display: block;
          font-family: var(--label);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--deep);
          margin-bottom: 8px;
          transition: color 0.2s;
        }
        .auth-field:focus-within .auth-label { color: var(--violet); }

        .auth-input-wrap {
          position: relative;
        }

        .auth-input {
          width: 100%;
          height: 50px;
          padding: 0 16px;
          font-family: var(--display);
          font-size: 15px;
          font-weight: 300;
          color: var(--navy);
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 6px;
          outline: none;
          transition: border-color 0.22s, box-shadow 0.22s, background 0.22s;
          letter-spacing: 0.01em;
        }
        .auth-input.has-eye { padding-right: 50px; }

        .auth-input:hover { border-color: var(--petal); }
        .auth-input:focus {
          border-color: var(--deep);
          box-shadow: 0 0 0 3px rgba(15,52,96,0.08), 0 1px 3px rgba(15,52,96,0.06);
          background: #fff;
        }
        .auth-input::placeholder {
          font-family: var(--label);
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: #c0bcd0;
        }

        /* Animated bottom border */
        .auth-input-line {
          position: absolute;
          bottom: 0; left: 8px; right: 8px;
          height: 2px;
          border-radius: 0 0 2px 2px;
          background: linear-gradient(90deg, var(--deep), var(--violet));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }
        .auth-input:focus ~ .auth-input-line { transform: scaleX(1); }

        /* Eye toggle */
        .auth-eye-btn {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--silver);
          border-radius: 0 6px 6px 0;
          transition: color 0.2s;
        }
        .auth-eye-btn:hover { color: var(--deep); }

        /* ── Error ── */
        .auth-error {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.03em;
          color: #c0392b;
          background: rgba(192,57,43,0.05);
          border: 1px solid rgba(192,57,43,0.18);
          border-left: 3px solid rgba(192,57,43,0.5);
          padding: 10px 14px;
          border-radius: 0 6px 6px 0;
          margin-bottom: 22px;
          animation: formSlideUp 0.3s ease both;
        }

        /* ── Submit ── */
        .auth-btn {
          width: 100%;
          height: 52px;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #ffffff;
          background: linear-gradient(135deg, var(--navy) 0%, var(--deep) 100%);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.25s;
          box-shadow: 0 4px 16px rgba(15,52,96,0.22);
          animation: formSlideUp 0.7s 0.26s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--deep) 0%, var(--violet) 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .auth-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(15,52,96,0.28);
        }
        .auth-btn:not(:disabled):hover::before { opacity: 1; }
        .auth-btn:not(:disabled):active { transform: translateY(0); }
        .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Shimmer sweep */
        .auth-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -80px; bottom: 0; width: 60px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          transform: skewX(-15deg);
        }
        .auth-btn:not(:disabled):hover::after {
          animation: btnSweep 0.6s ease forwards;
        }
        @keyframes btnSweep { to { left: 110%; } }

        .auth-btn-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        /* Spinner */
        .auth-spinner {
          width: 14px; height: 14px;
          border: 1.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Divider ── */
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 30px 0;
          animation: formSlideUp 0.7s 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-divider-line {
          flex: 1; height: 1px;
          background: linear-gradient(to right, transparent, var(--border), transparent);
        }
        .auth-divider-text {
          font-family: var(--label);
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--silver);
        }

        /* ── Footer ── */
        .auth-footer {
          text-align: center;
          font-family: var(--label);
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.03em;
          color: #8a8898;
          animation: formSlideUp 0.7s 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .auth-footer a {
          color: var(--deep);
          text-decoration: none;
          font-weight: 500;
          border-bottom: 1px solid transparent;
          transition: color 0.2s, border-color 0.2s;
        }
        .auth-footer a:hover { color: var(--violet); border-color: var(--violet); }
      `}</style>

      <div className="auth-root">

        {/* ══════════════════════════════
            LEFT PANEL
        ══════════════════════════════ */}
        <div className="auth-left">
          <div className="auth-left-bg" />
          <div className="auth-left-grid" />
          <div className="auth-left-orb" />
          <div className="auth-left-scan" />

          {/* Gem illustration */}
          <div className="auth-left-diamonds">
            <svg width="260" height="260" viewBox="0 0 260 260" fill="none">
              {/* Outer hexagonal gem */}
              <polygon
                points="130,18 222,68 222,192 130,242 38,192 38,68"
                fill="rgba(15,52,96,0.18)"
                stroke="rgba(165,180,252,0.2)"
                strokeWidth="0.8"
              />
              {/* Upper facets */}
              <polygon
                points="130,18 178,68 130,96 82,68"
                fill="rgba(124,58,237,0.12)"
                stroke="rgba(196,181,253,0.25)"
                strokeWidth="0.6"
              />
              <polygon
                points="178,68 222,68 222,140 130,96"
                fill="rgba(15,52,96,0.14)"
                stroke="rgba(165,180,252,0.18)"
                strokeWidth="0.5"
              />
              <polygon
                points="82,68 38,68 38,140 130,96"
                fill="rgba(15,52,96,0.14)"
                stroke="rgba(165,180,252,0.18)"
                strokeWidth="0.5"
              />
              {/* Lower facets */}
              <polygon
                points="222,140 222,192 130,242 130,96"
                fill="rgba(124,58,237,0.08)"
                stroke="rgba(196,181,253,0.15)"
                strokeWidth="0.5"
              />
              <polygon
                points="38,140 38,192 130,242 130,96"
                fill="rgba(15,52,96,0.1)"
                stroke="rgba(165,180,252,0.15)"
                strokeWidth="0.5"
              />
              <polygon
                points="130,242 178,192 130,96 82,192"
                fill="rgba(100,80,200,0.08)"
                stroke="rgba(196,181,253,0.12)"
                strokeWidth="0.5"
              />
              {/* Inner highlight */}
              <polygon
                points="130,18 178,68 130,96 82,68"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.4"
              />
              {/* Sparkle center */}
              <circle cx="130" cy="96" r="2.5" fill="rgba(196,181,253,0.5)" />
              <circle cx="130" cy="96" r="6" fill="none" stroke="rgba(196,181,253,0.15)" strokeWidth="0.5" />
              {/* Corner sparkles */}
              <g opacity="0.5">
                <line x1="130" y1="5" x2="130" y2="1" stroke="rgba(196,181,253,0.6)" strokeWidth="1"/>
                <line x1="128" y1="3" x2="132" y2="3" stroke="rgba(196,181,253,0.6)" strokeWidth="1"/>
              </g>
              <g opacity="0.35" transform="translate(222,68)">
                <line x1="0" y1="-5" x2="0" y2="-1" stroke="rgba(165,180,252,0.6)" strokeWidth="1"/>
                <line x1="-2" y1="-3" x2="2" y2="-3" stroke="rgba(165,180,252,0.6)" strokeWidth="1"/>
              </g>
              <g opacity="0.35" transform="translate(38,192)">
                <line x1="0" y1="-4" x2="0" y2="-1" stroke="rgba(165,180,252,0.5)" strokeWidth="1"/>
                <line x1="-1.5" y1="-2.5" x2="1.5" y2="-2.5" stroke="rgba(165,180,252,0.5)" strokeWidth="1"/>
              </g>
            </svg>
          </div>

          {/* Top logo */}
          <div className="auth-left-logo">
            <div className="auth-left-logo-gem">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <polygon points="16,3 29,12 16,29 3,12" stroke="#ffffff" strokeWidth="1.6" fill="none"/>
                <polygon points="16,3 29,12 16,15 3,12" stroke="rgba(196,181,253,0.8)" strokeWidth="1.2" fill="none" opacity="0.7"/>
              </svg>
            </div>
            <div>
              <span className="auth-left-logo-text">Alpha Imports</span>
              <span className="auth-left-logo-sub">Fine Gemstones</span>
            </div>
          </div>

          {/* Center spacer */}
          <div className="auth-left-center" />

          {/* Bottom content */}
          <div className="auth-left-bottom">
            <div className="auth-left-eyebrow">
              Est. Fine Diamonds
            </div>
            <h2 className="auth-left-headline">
              Rare diamonds.<br /><em>Singular beauty.</em>
            </h2>
            <p className="auth-left-sub">
              Access our curated collection of certified fancy-colour and white diamonds, sourced from the world's finest cutting centres.
            </p>
            <div className="auth-stat-cards">
              <div className="auth-stat-card">
                <div className="auth-stat-number">100k+</div>
                <div className="auth-stat-label">Gemstones</div>
              </div>
              <div className="auth-stat-card">
                <div className="auth-stat-number">GIA</div>
                <div className="auth-stat-label">Certified</div>
              </div>
              <div className="auth-stat-card">
                <div className="auth-stat-number">24h</div>
                <div className="auth-stat-label">Shipping</div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════
            RIGHT PANEL
        ══════════════════════════════ */}
        <div className="auth-right">
          <div className="auth-form-shell">

            {/* Mobile brand */}
            <div className="auth-mobile-brand">
              <div className="auth-mobile-gem">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <polygon points="16,3 29,12 16,29 3,12" stroke="#ffffff" strokeWidth="1.8" fill="none"/>
                  <polygon points="16,3 29,12 16,15 3,12" stroke="rgba(196,181,253,0.8)" strokeWidth="1.2" fill="none" opacity="0.7"/>
                </svg>
              </div>
              <span className="auth-mobile-brand-text">Alpha Imports</span>
            </div>

            <h1 className="auth-heading">Welcome back</h1>
            <p className="auth-subheading">Sign in to your account to continue</p>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">Email address</label>
                <div className="auth-input-wrap">
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                  <div className="auth-input-line" />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input has-eye"
                    placeholder="••••••••"
                    value={form.password}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <div className="auth-input-line" />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      /* Eye-off */
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10.73 10.73A2 2 0 0013.27 13.27" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      /* Eye */
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="auth-error">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="auth-btn">
                <span className="auth-btn-inner">
                  {loading && <span className="auth-spinner" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </span>
              </button>
            </form>

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">New here?</span>
              <div className="auth-divider-line" />
            </div>

            <div className="auth-footer">
              Don&apos;t have an account?{' '}
              <Link href="/signup">Create one</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}