'use client';
import { Gem, Mail, Phone, MapPin, ArrowUpRight, Heart, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import FooterSitemap from "../sitemap/FooterSitemap";
const FOOTER_COLUMNS = [
  {
    title: 'Help & Policies',
    links: [
      {
        label: 'Privacy Policy',
        href: '/privacy-policy',
      },
      {
        label: 'Return Policy',
        href: '/return-policy',
      },
      {
        label: 'Shipping Policy',
        href: '/shipping-policy',
      },
      {
        label: 'Drop Shipping Program',
        href: '/drop-shipping',
      },
      {
        label: 'Terms & Conditions',
        href: '/terms-and-conditions',
      },
    ],
  },

  {
    title: 'Customer Service',
    links: [
      {
        label: 'Help Center',
        href: '/help-center',
      },
      {
        label: 'Track My Order',
        href: '/where-is-my-order',
      },
      {
        label: 'FAQ',
        href: '/faq',
      },
      {
        label: 'Wish List',
        href: '/wishlist',
      },
      {
        label: 'Customer Service Center',
        href: '/customer-service',
      },
    ],
  },

  {
    title: 'Find Products',
    links: [
      {
        label: 'Find Products',
        href: '/find-products',
      },
      {
        label: 'Subscribe to Alpha Bargains',
        href: '/alpha-bargains',
      },
      {
        label: 'Ask for Catalog',
        href: '/ask-for-catalog',
      },
      {
        label: 'Volume Discount Program',
        href: '/volume-discount',
      },
      {
      label: 'Sitemap',
      href: '/sitemap',
    },
    ],
  },

  {
    title: 'Product Info',
    links: [
      {
        label: 'Learning Center',
        href: '/learning-center',
      },
      {
        label: 'Expert Advice',
        href: '/expert-advice',
      },
      {
        label: 'E-Catalog',
        href: '/e-catalog',
      },
      {
        label: 'Quality Score Chart',
        href: '/quality-score-chart',
      },
      {
        label: 'Certificates & Appraisal',
        href: '/certificates-appraisal',
      },
      {
        label: 'Join Our Alpha Club',
        href: '/join-alpha-club',
      },
    ],
  },
];

const DISCLAIMER = `All our colored gemstones & Color Diamonds, except Tsavorite, Garnet etc., are "E" (Enhanced) and/or "T" (Treated). Enhancement methods may include heating, oiling, filling with resin agents, coating, diffusion, dyeing, glass filling, irradiation, and lasering. All Diamond weights shown in fractions are approximate: ¼ ct. (0.23–0.27), ⅓ ct. (0.31–0.35), ½ ct. (0.48–0.52), ¾ ct. (0.73–0.77). Products shown are subject to availability. Alphaimports.com is not responsible for typographical or pricing errors.`;

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle');

  const handleSubscribe = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubState('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setSubState('duplicate');
      } else if (data.success) {
        setSubState('success');
        setEmail('');
      } else {
        setSubState('error');
      }
    } catch {
      setSubState('error');
    }
  };
  return (
    <footer className="relative mt-24 overflow-hidden" style={{ background: '#faf8f4' }}>

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #c9a84c 30%, #e8d5a0 50%, #c9a84c 70%, transparent 100%)' }}
      />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#c9a84c08 1px, transparent 1px), linear-gradient(90deg, #c9a84c08 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Large watermark gem */}
      <div
        className="absolute -bottom-8 -right-8 pointer-events-none select-none font-serif leading-none"
        style={{ fontSize: '220px', color: '#c9a84c', opacity: 0.04 }}
      >
        ◆
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-10">

        {/* ── Brand + Newsletter ── */}
        <div
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 pb-12 border-b"
          style={{ borderColor: '#e8e2d9' }}
        >
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: '#c9a84c15', border: '1.5px solid #c9a84c40' }}
              >
                <Gem size={16} strokeWidth={1.5} style={{ color: '#c9a84c' }} />
              </div>
              <span
                className="font-['Cormorant_Garamond',serif] text-[1.75rem] font-bold tracking-tight"
                style={{ color: '#0f0d0b', letterSpacing: '-0.01em' }}
              >
                Alpha Imports
              </span>
            </div>
            <p
              className="text-[0.63rem] tracking-[0.32em] uppercase font-bold mb-5"
              style={{ color: '#c9a84c' }}
            >
              Fine Diamonds &amp; Gemstones · New York
            </p>
            <div className="flex flex-col gap-2">
              {[
                { icon: Phone,  text: 'Customer Service Center' },
                { icon: MapPin, text: 'New York, NY' },
                { icon: Mail,   text: 'Contact via Help Center' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <Icon size={11} strokeWidth={2} style={{ color: '#c9a84c' }} />
                  <span className="text-[0.72rem] font-medium" style={{ color: '#3a3530' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:max-w-sm w-full">
            <div
              className="rounded-2xl p-6"
              style={{ background: '#fff', border: '1px solid #e8e2d9', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
            >
              <p className="text-[0.6rem] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: '#c9a84c' }}>
                Alpha Club &amp; Newsletter
              </p>
              <p className="text-[0.78rem] font-medium mb-4" style={{ color: '#1a1714' }}>
                Exclusive deals &amp; early access to new gems.
              </p>

              {subState === 'success' ? (
                <div className="flex items-center gap-2 py-2.5">
                  <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  <span className="text-[0.72rem] font-medium" style={{ color: '#16a34a' }}>
                    You&apos;re subscribed. Welcome!
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setSubState('idle'); }}
                      onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                      disabled={subState === 'loading'}
                      className="flex-1 px-3 py-2.5 text-[0.72rem] rounded-lg outline-none transition-all"
                      style={{
                        background: '#faf8f4',
                        border: '1.5px solid #e0dbd2',
                        color: '#1a1714',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#c9a84c'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e0dbd2'; }}
                    />
                    <button
                      onClick={handleSubscribe}
                      disabled={subState === 'loading'}
                      className="px-4 py-2.5 rounded-lg text-[0.7rem] font-bold tracking-widest whitespace-nowrap transition-all hover:opacity-90 active:scale-95 uppercase flex items-center gap-1.5"
                      style={{ background: '#1a1714', color: '#f5f0e8' }}
                    >
                      {subState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : 'Join'}
                    </button>
                  </div>
                  {subState === 'duplicate' && (
                    <p className="mt-2 text-[0.67rem]" style={{ color: '#92400e' }}>
                      You are already subscribed.
                    </p>
                  )}
                  {subState === 'error' && (
                    <p className="mt-2 text-[0.67rem]" style={{ color: '#991b1b' }}>
                      Something went wrong. Please try again.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Link columns ── */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-b"
          style={{ borderColor: '#e8e2d9' }}
        >
          {FOOTER_COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <h3
                className="text-[0.58rem] tracking-[0.28em] uppercase font-black mb-5"
                style={{ color: '#0f0d0b' }}
              >
                {title}
              </h3>
              <ul className="flex flex-col gap-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group flex items-center gap-1 text-[0.73rem] font-medium"
                    >
                      <ArrowUpRight
                        size={9}
                        strokeWidth={2.5}
                        className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity duration-150"
                        style={{ color: '#c9a84c' }}
                      />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Disclaimer ── */}
        <div className="py-8 border-b" style={{ borderColor: '#e8e2d9' }}>
          <p className="text-[0.63rem] leading-relaxed" style={{ color: '#a09a90' }}>
            <span className="font-bold tracking-wide" style={{ color: '#3a3530' }}>Gemstone Disclosure: </span>
            {DISCLAIMER}{' '}
            <button
              className="font-semibold underline underline-offset-2 text-[0.63rem] transition-colors"
              style={{ color: '#c9a84c' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#1a1714'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#c9a84c'; }}
            >
              More…
            </button>
          </p>
        </div>

        {/* ── Bottom bar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8">
          <p className="text-[0.65rem] font-semibold" style={{ color: '#1a1714' }}>
            © {new Date().getFullYear()} Alpha Imports NY Inc. All Rights Reserved.
          </p>

          <div className="flex items-center gap-1">
            {['Privacy Policy', 'Terms'].map((label, i) => (
              <span key={label} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: '#d4cec6' }} className="text-xs">·</span>}
                <button
                  className="text-[0.63rem] font-semibold tracking-wide transition-colors"
                  style={{ color: '#7a736a' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#1a1714'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#7a736a'; }}
                >
                  {label}
                </button>
              </span>
            ))}
          </div>

          <p className="text-[0.62rem] font-medium flex items-center gap-1.5" style={{ color: '#b0a898' }}>
            Crafted with
            <Heart size={9} strokeWidth={2.5} style={{ color: '#c9a84c' }} />
            in New York
          </p>
        </div>

      </div>
    </footer>
  );
}