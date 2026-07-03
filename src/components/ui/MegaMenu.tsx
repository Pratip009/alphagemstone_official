'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface Subcategory {
  label: string;
  slug: string;
  href: string;
  image?: string | null;
  description?: string | null;
}

export interface Category {
  label: string;
  slug: string;
  href: string;
  description?: string | null;
  subcategories: Subcategory[];
}

function useMegaMenuData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories?withSubcategories=true');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: Category[] = (json.data ?? []).map((cat: any) => ({
          label: cat.name,
          slug: cat.slug,
          description: cat.description ?? null,
          href: `/products?category=${cat.slug}`,
          subcategories: (cat.subcategories ?? []).map((sub: any) => ({
            label: sub.name,
            slug: sub.slug,
            image: sub.image ?? null,
            description: sub.description ?? null,
            href: `/products?category=${cat.slug}&subcategory=${sub.slug}`,
          })),
        }));
        if (!cancelled) { setCategories(data); setLoading(false); }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    }
    fetchCategories();
    return () => { cancelled = true; };
  }, []);

  return { categories, loading, error };
}

export default function MegaMenu() {
  const { categories, loading, error } = useMegaMenuData();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mobileCatIdx, setMobileCatIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const activeCat = categories[activeIdx] ?? null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap');

        .mm * { box-sizing: border-box; }

        @keyframes mmShimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .mm-skeleton {
          display: inline-block; border-radius: 3px;
          background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%);
          background-size: 400px 100%;
          animation: mmShimmer 1.4s infinite linear;
        }

        /* ── Desktop trigger ── */
        .mm-trigger {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 13px; font-weight: 500; letter-spacing: 0.01em;
          color: #0a0a0a; cursor: pointer;
          background: none; border: none; outline: none;
          padding: 4px 0; transition: opacity 0.18s;
        }
        .mm-trigger:hover { opacity: 0.55; }
        .mm-trigger:disabled { opacity: 0.35; cursor: default; }
        .mm-chev {
          width: 6px; height: 6px;
          border-right: 1.5px solid currentColor;
          border-bottom: 1.5px solid currentColor;
          transform: rotate(45deg) translateY(-1.5px);
          transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
          opacity: 0.5;
        }
        .mm-trigger[aria-expanded="true"] .mm-chev {
          transform: rotate(-135deg) translateY(1.5px);
        }

        /*
         * ── Full-width panel ──
         *
         * Place this component INSIDE your <nav> element.
         * The <nav> (or its scroll container) must have:
         *   position: relative;
         *   overflow: visible;   (important — don't clip the panel)
         *
         * The panel uses left: 50% + translateX(-50%) + width: 100vw
         * to break out of any max-width container and span the viewport.
         * Adjust if your site uses a different centering strategy.
         */
        .mm-panel {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-6px);
          width: 100vw;
          background: #ffffff;
          border-top: 0.5px solid #e8e8e8;
          border-bottom: 0.5px solid #e8e8e8;
          display: grid;
          grid-template-columns: 200px 1fr;
          z-index: 200;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1);
        }
        .mm-panel-open {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
          pointer-events: auto;
        }

        /* ── Rail ── */
        .mm-rail {
          background: #fafafa;
          border-right: 0.5px solid #ebebeb;
          padding: 1.25rem 0;
          display: flex; flex-direction: column;
        }
        .mm-rail-lbl {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 9px; font-weight: 600; letter-spacing: 0.22em;
          text-transform: uppercase; color: #c0c0c0;
          padding: 0 1.25rem 0.75rem;
        }
        .mm-rail-item {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 1.25rem; cursor: pointer;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 12.5px; font-weight: 400; color: #888;
          border-left: 2px solid transparent;
          transition: all 0.14s ease;
        }
        .mm-rail-item:hover { color: #333; background: #f3f3f3; }
        .mm-rail-item-active {
          color: #0a0a0a; font-weight: 600;
          border-left-color: #0a0a0a;
          background: #ffffff;
        }
        .mm-rail-ct {
          margin-left: auto;
          font-size: 10px; color: #ccc;
          background: #efefef; border-radius: 10px;
          padding: 1px 7px; line-height: 1.5;
        }
        .mm-rail-item-active .mm-rail-ct { background: #e4e4e4; color: #aaa; }

        /* ── Content ── */
        .mm-content { display: flex; flex-direction: column; }

        .mm-content-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 1.25rem 2rem 1rem;
          border-bottom: 0.5px solid #f0f0f0;
          gap: 1.5rem;
        }
        .mm-cat-title {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 22px; color: #0a0a0a; line-height: 1; margin-bottom: 4px;
        }
        .mm-cat-desc {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 11.5px; font-weight: 300; color: #aaa;
          line-height: 1.55; max-width: 420px;
        }
        .mm-browse-btn {
          display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
          color: #0a0a0a; text-decoration: none;
          border: 0.5px solid #ccc; padding: 7px 14px; border-radius: 8px;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .mm-browse-btn:hover { background: #0a0a0a; color: #fff; border-color: #0a0a0a; }

        /* ── Subcategory grid — no scroll, wraps naturally ── */
        .mm-subgrid-wrap { padding: 1.25rem 2rem 1.75rem; }
        .mm-subgrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 8px;
        }

        @keyframes mmSubIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /*
         * Sub item — image slot (38x38) on left, text on right.
         *
         * To add a real image, your API should return sub.image (a URL string).
         * The component already handles this: if sub.image exists it renders
         * <img src={sub.image} />, otherwise shows the placeholder gem icon.
         *
         * The thumbnail slot dimensions are fixed so the layout never shifts
         * when images load in.
         */
        .mm-sub-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px 8px 8px;
          border: 0.5px solid #ebebeb; border-radius: 10px;
          text-decoration: none; background: #ffffff;
          transition: border-color 0.14s, background 0.14s;
          animation: mmSubIn 0.2s ease both;
          min-width: 0;
        }
        .mm-sub-item:hover { border-color: #ccc; background: #fafafa; }

        .mm-sub-thumb {
          width: 38px; height: 38px; flex-shrink: 0;
          border-radius: 6px; overflow: hidden;
          background: #f0efec; border: 0.5px solid #e8e8e8;
          display: flex; align-items: center; justify-content: center;
        }
        .mm-sub-thumb img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }

        .mm-sub-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .mm-sub-name {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 12px; font-weight: 500; color: #0a0a0a;
          line-height: 1.3; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .mm-sub-hint {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 10.5px; color: #bbb; font-weight: 300;
        }

        .mm-sub-item:nth-child(1)  { animation-delay: 0.02s; }
        .mm-sub-item:nth-child(2)  { animation-delay: 0.04s; }
        .mm-sub-item:nth-child(3)  { animation-delay: 0.06s; }
        .mm-sub-item:nth-child(4)  { animation-delay: 0.08s; }
        .mm-sub-item:nth-child(5)  { animation-delay: 0.10s; }
        .mm-sub-item:nth-child(6)  { animation-delay: 0.12s; }
        .mm-sub-item:nth-child(7)  { animation-delay: 0.14s; }
        .mm-sub-item:nth-child(8)  { animation-delay: 0.16s; }
        .mm-sub-item:nth-child(n+9){ animation-delay: 0.18s; }

        .mm-empty {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 12px; font-style: italic; color: #ccc; padding: 4px 0;
        }

        /* ── Mobile trigger ── */
        .mm-mob-trigger {
          display: none; align-items: center; gap: 5px;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 13px; font-weight: 500; color: #0a0a0a;
          cursor: pointer; background: none; border: none; outline: none;
          padding: 4px 0; transition: opacity 0.18s;
        }
        .mm-mob-trigger:hover { opacity: 0.55; }

        /* ── Mobile drawer ── */
        .mm-drawer {
          position: fixed; inset: 0; z-index: 300;
          background: #ffffff; display: flex; flex-direction: column;
          overflow-y: auto;
          transition: opacity 0.26s ease, transform 0.26s cubic-bezier(0.22,1,0.36,1);
        }
        .mm-drawer-closed { opacity: 0; transform: translateY(-10px); pointer-events: none; }
        .mm-drawer-open   { opacity: 1; transform: translateY(0); pointer-events: auto; }

        .mm-drawer-hd {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 0.5px solid #ebebeb;
          position: sticky; top: 0; background: #ffffff; z-index: 10;
        }
        .mm-drawer-title {
          font-family: "Google Sans Flex", sans-serif; font-size: 18px; color: #0a0a0a;
        }
        .mm-drawer-close {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; background: none; border: none; cursor: pointer;
          color: #666; border-radius: 8px; transition: background 0.15s;
        }
        .mm-drawer-close:hover { background: #f5f5f5; }

        .mm-mob-cat { border-bottom: 0.5px solid #f0f0f0; }
        .mm-mob-cat-hd {
          display: flex; align-items: center; justify-content: space-between;
          padding: 15px 20px; cursor: pointer; transition: background 0.14s;
        }
        .mm-mob-cat-hd:hover { background: #fafafa; }
        .mm-mob-cat-left { display: flex; align-items: center; gap: 10px; }
        .mm-mob-cat-name {
          font-family: "Google Sans Flex", sans-serif; font-size: 14px; font-weight: 500; color: #0a0a0a;
        }
        .mm-mob-cat-ct {
          font-size: 10px; color: #bbb;
          background: #f0f0f0; border-radius: 10px; padding: 1px 7px;
        }
        .mm-mob-chev {
          width: 7px; height: 7px;
          border-right: 1.5px solid #aaa; border-bottom: 1.5px solid #aaa;
          transform: rotate(45deg) translateY(-1px); transition: transform 0.22s ease;
        }
        .mm-mob-chev-open { transform: rotate(-135deg) translateY(1px); }

        .mm-mob-subs { overflow: hidden; max-height: 0; transition: max-height 0.3s ease; }
        .mm-mob-subs-open { max-height: 2000px; }

        .mm-mob-browse {
          display: flex; align-items: center; gap: 5px;
          padding: 11px 20px 11px 32px;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
          text-decoration: none; color: #0a0a0a;
          border-bottom: 0.5px solid #f5f5f5; transition: background 0.14s;
        }
        .mm-mob-browse:hover { background: #f5f5f5; }

        .mm-mob-sub {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 20px 9px 32px; text-decoration: none;
          border-bottom: 0.5px solid #f8f8f8; transition: background 0.14s;
        }
        .mm-mob-sub:hover { background: #fafafa; }
        .mm-mob-sub-thumb {
          width: 32px; height: 32px; flex-shrink: 0; border-radius: 5px;
          background: #f0efec; border: 0.5px solid #e8e8e8;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .mm-mob-sub-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .mm-mob-sub-name {
          font-family: "Google Sans Flex", sans-serif; font-size: 13px; font-weight: 400; color: #555;
        }

        .mm-mob-footer {
          padding: 28px 20px; margin-top: auto; border-top: 0.5px solid #ebebeb;
        }
        .mm-mob-footer p {
          font-family: "Google Sans Flex", sans-serif;
          font-size: 12px; font-weight: 300; font-style: italic; color: #bbb;
        }

        /* ── Responsive ── */
        @media (min-width: 768px) {
          .mm-trigger { display: inline-flex !important; }
          .mm-mob-trigger { display: none !important; }
          .mm-drawer { display: none !important; }
        }
        @media (max-width: 767px) {
          .mm-trigger { display: none !important; }
          .mm-mob-trigger { display: inline-flex !important; }
          .mm-panel { display: none !important; }
        }
      `}</style>

      {/* Desktop wrapper */}
      <div ref={wrapRef} className="mm" style={{ position: 'relative' }}>

        <button
          className="mm-trigger"
          aria-expanded={open}
          aria-haspopup="true"
          disabled={loading || error}
          onClick={() => setOpen(o => !o)}
        >
          {loading ? (
            <span className="mm-skeleton" style={{ width: 64, height: 9 }} />
          ) : error ? (
            'Collections'
          ) : (
            <>Collections <span className="mm-chev" /></>
          )}
        </button>

        {!loading && !error && activeCat && (
          <div className={`mm-panel ${open ? 'mm-panel-open' : ''}`}>

            {/* Rail */}
            <div className="mm-rail">
              <div className="mm-rail-lbl">Browse</div>
              {categories.map((cat, i) => (
                <div
                  key={cat.slug}
                  className={`mm-rail-item ${i === activeIdx ? 'mm-rail-item-active' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => setActiveIdx(i)}
                >
                  <span>{cat.label}</span>
                  <span className="mm-rail-ct">{cat.subcategories.length}</span>
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="mm-content">
              <div className="mm-content-head">
                <div>
                  <div className="mm-cat-title">{activeCat.label}</div>
                  {activeCat.description && (
                    <p className="mm-cat-desc">{activeCat.description}</p>
                  )}
                </div>
                <Link href={activeCat.href} className="mm-browse-btn" onClick={() => setOpen(false)}>
                  Browse all {activeCat.label.toLowerCase()} →
                </Link>
              </div>

              <div className="mm-subgrid-wrap">
                {activeCat.subcategories.length === 0 ? (
                  <p className="mm-empty">Full collection awaits.</p>
                ) : (
                  <div className="mm-subgrid" key={activeCat.slug}>
                    {activeCat.subcategories.map((sub) => (
                      <Link
                        key={sub.slug}
                        href={sub.href}
                        className="mm-sub-item"
                        onClick={() => setOpen(false)}
                      >
                        {/* Thumbnail — swap placeholder for real image via sub.image */}
                        <div className="mm-sub-thumb">
                          {sub.image ? (
                            <img src={sub.image} alt={sub.label} />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"
                              strokeLinejoin="round" style={{ opacity: 0.28 }}>
                              <polygon points="12 2 22 9 18 21 6 21 2 9" />
                            </svg>
                          )}
                        </div>
                        <div className="mm-sub-text">
                          <span className="mm-sub-name">{sub.label}</span>
                          <span className="mm-sub-hint">View collection</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Mobile trigger */}
      <button className="mm-mob-trigger" onClick={() => setMobileOpen(true)}>
        Collections <span className="mm-chev" />
      </button>

      {/* Mobile drawer */}
      <div className={`mm-drawer ${mobileOpen ? 'mm-drawer-open' : 'mm-drawer-closed'}`}>
        <div className="mm-drawer-hd">
          <span className="mm-drawer-title">Collections</span>
          <button
            className="mm-drawer-close"
            onClick={() => { setMobileOpen(false); setMobileCatIdx(null); }}
            aria-label="Close menu"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading && (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[80, 110, 90, 100].map((w, i) => (
              <span key={i} className="mm-skeleton" style={{ width: w, height: 10 }} />
            ))}
          </div>
        )}

        {!loading && !error && categories.map((cat, i) => {
          const isExpanded = mobileCatIdx === i;
          return (
            <div key={cat.slug} className="mm-mob-cat">
              <div className="mm-mob-cat-hd" onClick={() => setMobileCatIdx(isExpanded ? null : i)}>
                <div className="mm-mob-cat-left">
                  <span className="mm-mob-cat-name">{cat.label}</span>
                  <span className="mm-mob-cat-ct">{cat.subcategories.length}</span>
                </div>
                <span className={`mm-mob-chev ${isExpanded ? 'mm-mob-chev-open' : ''}`} />
              </div>
              <div className={`mm-mob-subs ${isExpanded ? 'mm-mob-subs-open' : ''}`}>
                <Link href={cat.href} className="mm-mob-browse" onClick={() => setMobileOpen(false)}>
                  Browse all {cat.label} →
                </Link>
                {cat.subcategories.map(sub => (
                  <Link key={sub.slug} href={sub.href} className="mm-mob-sub" onClick={() => setMobileOpen(false)}>
                    <div className="mm-mob-sub-thumb">
                      {sub.image ? (
                        <img src={sub.image} alt={sub.label} />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"
                          strokeLinejoin="round" style={{ opacity: 0.28 }}>
                          <polygon points="12 2 22 9 18 21 6 21 2 9" />
                        </svg>
                      )}
                    </div>
                    <span className="mm-mob-sub-name">{sub.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mm-mob-footer">
          <p>Fine diamonds &amp; gemstones, curated for discerning eyes.</p>
        </div>
      </div>
    </>
  );
}