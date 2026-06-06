"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/hooks/useCart";
import SearchBar from "./SearchBar";
import CartSidebar from "./CartSidebar";

// ── Types ────────────────────────────────────────────────────────────────────

interface NavSubcategory {
  _id: string;
  name: string;
  slug: string;
  isActive?: boolean;
}

interface NavCategory {
  _id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  sortOrder?: number;
  subcategories: NavSubcategory[];
}

// ── Data fetching hook ───────────────────────────────────────────────────────

function useNavCategories(initialCategories: NavCategory[]) {
  const [categories, setCategories] = useState<NavCategory[]>(initialCategories);
  const [loading, setLoading] = useState(initialCategories.length === 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/categories?withSubcategories=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: NavCategory[] = Array.isArray(data) ? data : (data?.data ?? []);
        const filtered = list
          .filter((c) => c.isActive !== false)
          .map((c) => ({
            ...c,
            subcategories: (c.subcategories ?? []).filter((s) => s.isActive !== false),
          }));
        filtered.sort((a, b) => {
          const sa = a.sortOrder ?? 0;
          const sb = b.sortOrder ?? 0;
          return sa !== sb ? sa - sb : a.name.localeCompare(b.name);
        });
        setCategories(filtered);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { categories, loading };
}

const MAX_VISIBLE_SUBS = 7;

// ── Diamond icon (matches carousel) ─────────────────────────────────────────
function DiamondDot({ color = "#7c3aed", size = 5 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="5" y="0.5" width="6.5" height="6.5" transform="rotate(45 5 5)" fill={color} fillOpacity="0.9" />
    </svg>
  );
}

// ── Main Navbar ──────────────────────────────────────────────────────────────

export default function Navbar({ initialCategories = [] }: { initialCategories?: NavCategory[] }) {
  const { user, logout, isAdmin } = useAuth();
  const { cartCount } = useCart();
  const router = useRouter();
  const { categories, loading } = useNavCategories(initialCategories);

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeMobileCategory, setActiveMobileCategory] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<string>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  const profileRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const update = () => {
      if (navRef.current) {
        const h = navRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty("--navbar-height", `${h}px`);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCat = (slug: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(slug);
  };

  const schedulClose = () => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const toggleExpand = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setProfileOpen(false);
    router.push("/");
  };

  const CartIconButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      onClick={() => { setMenuOpen(false); setCartOpen(true); }}
      aria-label="Open cart"
      className={mobile ? "nav-mobile-icon-btn" : "nav-cart-btn"}
    >
      <svg width={mobile ? 20 : 16} height={mobile ? 20 : 16} viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {!mobile && <span className="nav-btn-label">Cart</span>}
      {cartCount > 0 && (
        <span className={mobile ? "cart-badge-mobile" : "cart-badge-desktop"}>
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Barlow+Condensed:wght@200;300;400;500;600&display=swap');

        :root {
          --navy:    #1a1a2e;
          --deep:    #0f3460;
          --violet:  #7c3aed;
          --ink:     #2d2d3a;
          --mist:    #f5f3ff;
          --lilac:   #ede9fe;
          --petal:   #c4b5fd;
          --silver:  #9f9fc0;
          --border:  #e8e4f8;
          --display: 'Playfair Display', Georgia, serif;
          --label:   'Barlow Condensed', sans-serif;
        }

        /* ── Keyframes ── */
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes mobileSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes mobileSlideOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(100%); }
        }
        @keyframes accordionOpen {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.3); }
          50%       { box-shadow: 0 0 0 6px rgba(124,58,237,0); }
        }

        /* ── Announcement Bar ── */
        .announcement-bar {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          color: #e2e8f0;
          overflow: hidden;
          position: relative;
          height: 36px;
          display: flex;
          align-items: center;
          transition: height 0.35s ease, opacity 0.35s ease;
        }
        .announcement-bar.hidden {
          height: 0;
          opacity: 0;
          pointer-events: none;
        }
        .ticker-wrap {
          display: flex;
          white-space: nowrap;
          animation: ticker 28s linear infinite;
          will-change: transform;
        }
        .ticker-wrap:hover { animation-play-state: paused; }
        .ticker-item {
          font-family: var(--label);
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.1em;
          padding: 0 48px;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .ticker-item a {
          color: var(--petal);
          text-decoration: none;
          border-bottom: 1px solid rgba(196,181,253,0.4);
          transition: color 0.2s, border-color 0.2s;
        }
        .ticker-item a:hover { color: #fff; border-color: #fff; }
        .announcement-close {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.35);
          cursor: pointer;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: color 0.2s, background 0.2s;
          z-index: 2;
          flex-shrink: 0;
        }
        .announcement-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

        /* ── Main Nav ── */
        .main-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: #ffffff;
          border-bottom: 1px solid var(--border);
          transition: box-shadow 0.3s ease, background 0.3s ease;
          font-family: var(--label);
        }
        .main-nav.scrolled {
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 32px rgba(15,52,96,0.08), 0 1px 0 var(--border);
        }

        /* ── Top Row ── */
        .nav-top-row {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          height: 72px;
          padding: 0 24px;
        }
        @media (min-width: 768px) {
          .nav-top-row { height: 80px; padding: 0 40px; }
        }

        /* ── Logo ── */
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          flex-shrink: 0;
          transition: opacity 0.2s;
        }
        .nav-logo:hover { opacity: 0.85; }
        .logo-gem {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(15,52,96,0.3);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          transition: box-shadow 0.3s;
        }
        .nav-logo:hover .logo-gem {
          box-shadow: 0 6px 24px rgba(124,58,237,0.4);
        }
        .logo-gem::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
        }
        .logo-name {
          font-family: var(--display);
          font-weight: 600;
          color: var(--navy);
          font-size: clamp(16px, 3vw, 21px);
          letter-spacing: -0.02em;
          line-height: 1;
          display: block;
        }
        .logo-sub {
          font-family: var(--label);
          font-weight: 300;
          color: var(--silver);
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          display: block;
          margin-top: 3px;
        }

        /* ── Desktop Right ── */
        .nav-right {
          display: none;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }
        @media (min-width: 768px) {
          .nav-right { display: flex; }
        }
        .nav-actions-row {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        /* ── Nav links ── */
        .nav-link {
          font-family: var(--display);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0;
          color: var(--ink);
          text-decoration: none;
          padding: 6px 13px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
          white-space: nowrap;
        }
        .nav-link:hover { color: var(--deep); background: var(--mist); }

        /* ── Cart button ── */
        .nav-cart-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 13px;
          font-family: var(--display);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0;
          color: var(--ink);
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }
        .nav-cart-btn:hover { color: var(--deep); background: var(--mist); }
        .nav-btn-label { white-space: nowrap; }

        /* ── Profile button ── */
        .nav-profile-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 6px 13px;
          font-family: var(--display);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0;
          color: var(--ink);
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }
        .nav-profile-btn:hover { color: var(--deep); background: var(--mist); }

        .nav-avatar {
          width: 26px;
          height: 26px;
          background: linear-gradient(135deg, var(--deep), var(--violet));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          font-family: var(--display);
          flex-shrink: 0;
        }

        .nav-chevron {
          transition: transform 0.22s ease;
          opacity: 0.45;
        }
        .nav-chevron.open { transform: rotate(180deg); opacity: 0.85; }

        /* ── Sign Up button ── */
        .nav-signup-btn {
          font-family: var(--label);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #fff;
          background: linear-gradient(135deg, var(--deep) 0%, var(--violet) 100%);
          text-decoration: none;
          padding: 7px 18px;
          border-radius: 4px;
          box-shadow: 0 3px 12px rgba(124,58,237,0.28);
          transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
          white-space: nowrap;
        }
        .nav-signup-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(124,58,237,0.38);
        }

        /* ── Admin badge ── */
        .nav-admin-badge {
          font-family: var(--label);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #b45309;
          background: #fffbeb;
          border: 1px solid #fde68a;
          text-decoration: none;
          padding: 4px 10px;
          border-radius: 4px;
          margin-left: 4px;
          transition: background 0.15s;
        }
        .nav-admin-badge:hover { background: #fef3c7; }

        /* ── Contact row ── */
        .nav-contact-row {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .nav-contact-link {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: var(--label);
          font-size: 11px;
          font-weight: 300;
          letter-spacing: 0.06em;
          color: var(--silver);
          text-decoration: none;
          transition: color 0.15s;
        }
        .nav-contact-link:hover { color: var(--deep); }

        /* ── Profile dropdown ── */
        .profile-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 240px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-top: 2px solid var(--deep);
          border-radius: 0 0 12px 12px;
          box-shadow: 0 20px 60px rgba(15,52,96,0.12), 0 4px 16px rgba(0,0,0,0.04);
          z-index: 300;
          transition: opacity 0.18s ease, transform 0.18s ease;
          overflow: hidden;
        }
        .profile-dropdown.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .profile-dropdown.closed {
          opacity: 0;
          pointer-events: none;
          transform: translateY(-8px);
        }
        .profile-dropdown-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--lilac);
          background: var(--mist);
        }
        .profile-dropdown-label {
          font-family: var(--label);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--silver);
          margin-bottom: 4px;
        }
        .profile-dropdown-name {
          font-family: var(--display);
          font-size: 15px;
          font-weight: 400;
          color: var(--navy);
        }
        .profile-dropdown-email {
          font-family: var(--label);
          font-size: 11px;
          color: var(--silver);
          margin-top: 2px;
          letter-spacing: 0.02em;
        }
        .dropdown-nav-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink);
          text-decoration: none;
          transition: background 0.12s, color 0.12s, padding-left 0.15s;
        }
        .dropdown-nav-link:hover { background: var(--mist); color: var(--deep); padding-left: 24px; }
        .dropdown-signout {
          width: 100%;
          text-align: left;
          padding: 10px 18px;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #dc2626;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.12s;
        }
        .dropdown-signout:hover { background: #fff5f5; }

        /* ── Category Row ── */
        .cat-row {
          border-top: 1px solid var(--border);
          background: linear-gradient(180deg, #fdfcff 0%, #f8f6ff 100%);
        }
        .cat-row-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          align-items: stretch;
          padding: 0 24px;
        }
        @media (min-width: 768px) {
          .cat-row-inner { padding: 0 40px; }
        }

        /* ── Category tab ── */
        .cat-tab {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--display);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0;
          color: var(--ink);
          text-decoration: none;
          padding: 13px 15px;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .cat-tab::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 15px;
          right: 15px;
          height: 2px;
          background: linear-gradient(90deg, var(--deep), var(--violet));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.25s ease;
        }
        .cat-tab:hover { color: var(--deep); }
        .cat-tab:hover::after, .cat-tab.open::after { transform: scaleX(1); }
        .cat-tab.open { color: var(--deep); }
        .cat-tab .chevron { transition: transform 0.22s ease; opacity: 0.4; }
        .cat-tab.open .chevron { transform: rotate(180deg); opacity: 0.9; }

        /* ── Category shimmer ── */
        .cat-shimmer {
          height: 8px;
          border-radius: 4px;
          flex-shrink: 0;
          background: linear-gradient(90deg, var(--lilac) 25%, var(--mist) 50%, var(--lilac) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s ease infinite;
          margin: 18px 16px;
        }

        /* ── Dropdown panel ── */
        .cat-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          background: #ffffff;
          border: 1px solid var(--border);
          border-top: 2px solid var(--deep);
          border-radius: 0 0 14px 14px;
          box-shadow: 0 24px 64px rgba(15,52,96,0.1), 0 4px 16px rgba(0,0,0,0.04);
          z-index: 9999;
          padding-bottom: 8px;
          transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s, width 0.25s ease;
          max-width: calc(100vw - 32px);
          overflow: hidden;
        }
        .cat-dropdown.visible {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .cat-dropdown.hidden {
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
        }

        .cat-dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 20px;
          font-family: var(--label);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--deep);
          text-decoration: none;
          border-bottom: 1px solid var(--lilac);
          margin-bottom: 4px;
          background: var(--mist);
          transition: background 0.12s;
        }
        .cat-dropdown-header:hover { background: var(--lilac); }

        .sub-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          font-family: var(--label);
          font-size: 12.5px;
          font-weight: 300;
          letter-spacing: 0.05em;
          color: var(--ink);
          text-decoration: none;
          transition: background 0.1s, color 0.1s, padding-left 0.15s;
          white-space: nowrap;
        }
        .sub-link:hover { background: var(--mist); color: var(--deep); padding-left: 28px; }

        .sub-link-grid {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: var(--ink);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-radius: 6px;
          transition: background 0.1s, color 0.1s;
        }
        .sub-link-grid:hover { background: var(--mist); color: var(--deep); }

        .see-more-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 9px 20px;
          font-family: var(--label);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--deep);
          background: transparent;
          border: none;
          border-top: 1px solid var(--lilac);
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.1s;
        }
        .see-more-btn:hover { background: var(--mist); }

        /* ── Mobile icon button ── */
        .nav-mobile-icon-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          color: var(--ink);
          transition: border-color 0.2s, background 0.2s, color 0.2s;
        }
        .nav-mobile-icon-btn:hover {
          border-color: var(--petal);
          background: var(--mist);
          color: var(--deep);
        }

        /* ── Cart badges ── */
        .cart-badge-desktop {
          background: linear-gradient(135deg, var(--deep), var(--violet));
          color: #fff;
          font-family: var(--label);
          font-size: 9px;
          font-weight: 700;
          border-radius: 50%;
          width: 17px;
          height: 17px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(124,58,237,0.4);
          flex-shrink: 0;
          letter-spacing: 0;
        }
        .cart-badge-mobile {
          position: absolute;
          top: -5px;
          right: -5px;
          background: linear-gradient(135deg, var(--deep), var(--violet));
          color: #fff;
          font-family: var(--label);
          font-size: 8px;
          font-weight: 700;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(124,58,237,0.4);
          animation: pulseGlow 2s ease infinite;
          letter-spacing: 0;
        }

        /* ── Hamburger ── */
        .hamburger {
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          width: 40px;
          height: 40px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          justify-content: center;
          align-items: center;
          transition: border-color 0.2s, background 0.2s;
        }
        .hamburger:hover { border-color: var(--petal); background: var(--mist); }
        .hamburger-line {
          display: block;
          width: 18px;
          height: 1.5px;
          background: var(--navy);
          border-radius: 2px;
          transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s;
        }

        /* ── Mobile overlay ── */
        .mobile-overlay {
          position: fixed;
          z-index: 40;
          top: var(--navbar-height, 64px);
          left: 0;
          right: 0;
          bottom: 0;
          background: #ffffff;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          font-family: var(--label);
        }
        .mobile-overlay.open {
          animation: mobileSlideIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .mobile-overlay.closed {
          animation: mobileSlideOut 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          pointer-events: none;
        }

        /* ── Mobile search ── */
        .mobile-search {
          display: flex;
          align-items: center;
          padding: 0 14px;
          height: 44px;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          background: var(--mist);
          gap: 8px;
          margin-bottom: 6px;
        }
        .mobile-search input {
          flex: 1;
          border: none;
          background: transparent;
          font-family: var(--label);
          font-size: 12px;
          letter-spacing: 0.04em;
          outline: none;
          color: var(--navy);
        }
        .mobile-search input::placeholder { color: var(--silver); }

        /* ── Mobile section label ── */
        .mobile-section-label {
          font-family: var(--label);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--silver);
          padding: 20px 0 10px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .mobile-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* ── Mobile category row ── */
        .mobile-cat-row {
          border-bottom: 1px solid var(--lilac);
        }
        .mobile-cat-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 0;
          font-family: var(--display);
          font-size: 16px;
          font-weight: 300;
          color: var(--navy);
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .mobile-cat-btn:hover { color: var(--deep); }
        .mobile-cat-btn.active { color: var(--deep); }

        .mobile-cat-chevron {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .mobile-cat-chevron.active { background: var(--deep); }
        .mobile-cat-chevron:not(.active) { background: var(--mist); }

        /* ── Mobile sub-links ── */
        .mobile-subs {
          overflow: hidden;
          transition: max-height 0.38s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .mobile-sub-all {
          display: block;
          padding: 9px 14px;
          font-family: var(--label);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--deep);
          text-decoration: none;
          background: var(--mist);
          border-radius: 6px;
          margin-bottom: 4px;
          transition: background 0.15s;
        }
        .mobile-sub-all:hover { background: var(--lilac); }
        .mobile-sub-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          font-family: var(--label);
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: var(--ink);
          text-decoration: none;
          border-top: 1px solid var(--lilac);
          transition: color 0.15s, background 0.15s;
        }
        .mobile-sub-link:hover { color: var(--deep); background: var(--mist); }

        /* ── Mobile nav links ── */
        .mobile-nav-link {
          display: flex;
          align-items: center;
          padding: 13px 0;
          font-family: var(--display);
          font-size: 15px;
          font-weight: 300;
          color: var(--navy);
          text-decoration: none;
          border-bottom: 1px solid var(--lilac);
          letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .mobile-nav-link:hover { color: var(--deep); }

        .mobile-user-block {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 0;
          border-bottom: 1px solid var(--lilac);
        }
        .mobile-user-avatar {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, var(--deep), var(--violet));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--display);
          font-size: 17px;
          font-weight: 400;
          color: #fff;
          flex-shrink: 0;
        }
        .mobile-user-name {
          font-family: var(--display);
          font-size: 16px;
          font-weight: 400;
          color: var(--navy);
        }
        .mobile-user-email {
          font-family: var(--label);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--silver);
          margin-top: 2px;
        }

        .mobile-signout {
          font-family: var(--label);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #dc2626;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 4px 0;
          transition: opacity 0.15s;
        }
        .mobile-signout:hover { opacity: 0.75; }

        .mobile-create-btn {
          display: block;
          text-align: center;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #fff;
          background: linear-gradient(135deg, var(--deep) 0%, var(--violet) 100%);
          padding: 14px 24px;
          text-decoration: none;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(124,58,237,0.28);
          transition: opacity 0.15s, transform 0.15s;
          margin-top: 20px;
        }
        .mobile-create-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── Shimmer rows (mobile) ── */
        .mobile-shimmer {
          height: 50px;
          background: linear-gradient(90deg, var(--mist) 25%, var(--lilac) 50%, var(--mist) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s ease infinite;
          border-bottom: 1px solid var(--lilac);
          border-radius: 4px;
          margin-bottom: 2px;
        }

        /* ── Hide/show breakpoint helpers ── */
        .desktop-only { display: none; }
        .mobile-only  { display: flex; }
        @media (min-width: 768px) {
          .desktop-only { display: flex; }
          .mobile-only  { display: none; }
        }
        .desktop-block { display: none; }
        @media (min-width: 768px) {
          .desktop-block { display: block; }
        }
      `}</style>

      {/* ── Announcement Bar ── */}
      <div className={`announcement-bar${announcementVisible ? "" : " hidden"}`}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center" }}>
          <div className="ticker-wrap">
            {[0, 1].map((n) => (
              <span key={n} className="ticker-item">
                <DiamondDot color="#c4b5fd" size={5} />
                Free Shipping on 100+ Gemstones &amp; Diamonds
                <DiamondDot color="#7c3aed" size={4} />
                Questions? Email&nbsp;
                <a href="mailto:info@alphagemimports.com">info@alphagemimports.com</a>
                <DiamondDot color="#c4b5fd" size={5} />
                Certified Natural Gemstones &nbsp;·&nbsp; GIA Graded Diamonds
                <DiamondDot color="#7c3aed" size={4} />
                Call us at&nbsp;
                <a href="tel:+19143101480">1-914-310-1480</a>
              </span>
            ))}
          </div>
        </div>
        <button
          className="announcement-close"
          onClick={() => setAnnouncementVisible(false)}
          aria-label="Dismiss announcement"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Main Nav ── */}
      <nav
        ref={navRef}
        className={`main-nav${scrolled ? " scrolled" : ""}`}
        aria-label="Main navigation"
      >
        {/* ── Top Row ── */}
        <div className="nav-top-row">

          {/* Logo */}
          <Link href="/" onClick={() => setMenuOpen(false)} className="nav-logo">
            <div className="logo-gem">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" style={{ position: "relative", zIndex: 1 }}>
                <polygon points="16,3 29,12 16,29 3,12" stroke="#ffffff" strokeWidth="1.6" fill="none"/>
                <polygon points="16,3 29,12 16,15 3,12" stroke="#a5b4fc" strokeWidth="1.2" fill="none" opacity="0.7"/>
              </svg>
            </div>
            <div>
              <span className="logo-name">Alpha Imports</span>
              <span className="logo-sub">Fine Gemstones</span>
            </div>
          </Link>

          {/* Desktop Search */}
          <div className="desktop-only" style={{ flex: "1 1 auto", maxWidth: "340px" }}>
            <SearchBar initialCategories={initialCategories} variant="desktop" />
          </div>

          {/* Desktop Right */}
          <div className="nav-right">
            <div className="nav-actions-row">
              <Link href="/" className="nav-link">Home</Link>
              <Link href="/about" className="nav-link">About</Link>
              <Link href="/blogs" className="nav-link">Blog</Link>
              <Link href="/contact" className="nav-link">Contact</Link>

              {user ? (
                <>
                  <div ref={profileRef} style={{ position: "relative" }}>
                    <button
                      className="nav-profile-btn"
                      onClick={() => setProfileOpen(!profileOpen)}
                    >
                      <div className="nav-avatar">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      Account
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                        className={`nav-chevron${profileOpen ? " open" : ""}`}>
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    <div className={`profile-dropdown${profileOpen ? " open" : " closed"}`}>
                      <div className="profile-dropdown-header">
                        <p className="profile-dropdown-label">Signed in as</p>
                        <p className="profile-dropdown-name">{user.name}</p>
                        <p className="profile-dropdown-email">{user.email}</p>
                      </div>
                      <div style={{ padding: "6px 0" }}>
                        <a href="/orders" className="dropdown-nav-link" onClick={() => setProfileOpen(false)}>
                          <DiamondDot color="#c4b5fd" /> My Orders
                        </a>
                        <a href="/account" className="dropdown-nav-link" onClick={() => setProfileOpen(false)}>
                          <DiamondDot color="#c4b5fd" /> Account Settings
                        </a>
                        {isAdmin && (
                          <a href="/admin" className="dropdown-nav-link" onClick={() => setProfileOpen(false)}>
                            <DiamondDot color="#c4b5fd" /> Admin Panel
                          </a>
                        )}
                      </div>
                      <div style={{ borderTop: "1px solid var(--lilac)", padding: "6px 0" }}>
                        <button onClick={handleLogout} className="dropdown-signout">
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>

                  <CartIconButton />
                  <a href="/orders" className="nav-link">Orders</a>
                </>
              ) : (
                <>
                  <a href="/login" className="nav-link">Login</a>
                  <Link href="/signup" className="nav-signup-btn">Sign Up</Link>
                </>
              )}

              {isAdmin && (
                <a href="/admin" className="nav-admin-badge">Admin</a>
              )}
            </div>

            {/* Contact row */}
            <div className="nav-contact-row">
              <a href="tel:+19143101480" className="nav-contact-link">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                1-914-310-1480
              </a>
              <a href="mailto:info@alphagemimports.com" className="nav-contact-link">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                info@alphagemimports.com
              </a>
            </div>
          </div>

          {/* Mobile: Cart + Hamburger */}
          <div className="mobile-only" style={{ alignItems: "center", gap: "10px" }}>
            {user && <CartIconButton mobile />}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="hamburger"
            >
              <span className="hamburger-line" style={{
                transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none",
              }}/>
              <span className="hamburger-line" style={{ opacity: menuOpen ? 0 : 1 }}/>
              <span className="hamburger-line" style={{
                transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none",
              }}/>
            </button>
          </div>
        </div>

        {/* ── Category Row — Desktop ── */}
        <div className="cat-row desktop-block">
          <div className="cat-row-inner">

            {loading && [110, 105, 145, 75, 88, 120, 88, 55].map((w, i) => (
              <div key={i} className="cat-shimmer" style={{ width: w }} />
            ))}

            {!loading && categories.map((cat) => {
              const hasSubs = (cat.subcategories?.length ?? 0) > 0;
              const isOpen  = openDropdown === cat.slug;
              const isExpanded = expandedDropdowns.has(cat.slug);
              const visibleSubs = isExpanded ? cat.subcategories : cat.subcategories.slice(0, MAX_VISIBLE_SUBS);
              const hasMore = cat.subcategories.length > MAX_VISIBLE_SUBS;

              return (
                <div
                  key={cat._id}
                  style={{ position: "relative" }}
                  onMouseEnter={() => { cancelClose(); openCat(cat.slug); }}
                  onMouseLeave={schedulClose}
                >
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className={`cat-tab${isOpen ? " open" : ""}`}
                  >
                    {cat.name}
                    {hasSubs && (
                      <svg className="chevron" width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </Link>

                  {hasSubs && (
                    <div
                      className={`cat-dropdown${isOpen ? " visible" : " hidden"}`}
                      style={{ width: isExpanded ? "660px" : "230px" }}
                      onMouseEnter={cancelClose}
                      onMouseLeave={schedulClose}
                    >
                      <Link
                        href={`/products?category=${cat.slug}`}
                        onClick={() => setOpenDropdown(null)}
                        className="cat-dropdown-header"
                      >
                        All {cat.name}
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </Link>

                      {isExpanded ? (
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "2px 0",
                          padding: "4px 8px",
                        }}>
                          {cat.subcategories.map((sub) => (
                            <Link
                              key={sub._id}
                              href={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                              onClick={() => setOpenDropdown(null)}
                              className="sub-link-grid"
                            >
                              <DiamondDot color="#c4b5fd" size={4} />
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        visibleSubs.map((sub) => (
                          <Link
                            key={sub._id}
                            href={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                            onClick={() => setOpenDropdown(null)}
                            className="sub-link"
                          >
                            <DiamondDot color="#c4b5fd" size={4} />
                            {sub.name}
                          </Link>
                        ))
                      )}

                      {hasMore && (
                        <button className="see-more-btn" onClick={(e) => toggleExpand(cat.slug, e)}>
                          {isExpanded ? (
                            <>
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                <path d="M4 10L8 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Show less
                            </>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {cat.subcategories.length - MAX_VISIBLE_SUBS} more…
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── Mobile / Tablet Menu Overlay ── */}
      {/* Rendered always so the slide-out animation plays; pointer-events handled by .closed class */}
      <div className={`mobile-overlay${menuOpen ? " open" : " closed"} desktop-only-hide`}
        style={{ display: menuOpen ? undefined : "none" }}
        aria-hidden={!menuOpen}
      >
        <div style={{ padding: "20px 24px 60px", display: "flex", flexDirection: "column" }}>

          {/* Mobile Search */}
          <div className="mobile-search">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: "var(--silver)", flexShrink: 0 }}>
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Search gemstones…" />
          </div>

          {/* Categories */}
          <p className="mobile-section-label">Collections</p>

          {loading && [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mobile-shimmer" />
          ))}

          {!loading && categories.map((cat, idx) => {
            const hasSubs = (cat.subcategories?.length ?? 0) > 0;
            const isExpanded = activeMobileCategory === cat.slug;
            return (
              <div
                key={cat._id}
                className="mobile-cat-row"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <button
                  onClick={() => {
                    if (!hasSubs) {
                      router.push(`/products?category=${cat.slug}`);
                      setMenuOpen(false);
                    } else {
                      setActiveMobileCategory(isExpanded ? null : cat.slug);
                    }
                  }}
                  className={`mobile-cat-btn${isExpanded ? " active" : ""}`}
                >
                  {cat.name}
                  {hasSubs && (
                    <div className={`mobile-cat-chevron${isExpanded ? " active" : ""}`}>
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none" style={{
                        transition: "transform 0.25s",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                      }}>
                        <path d="M2 3.5L5 6.5L8 3.5"
                          stroke={isExpanded ? "#fff" : "var(--deep)"}
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>

                {hasSubs && (
                  <div
                    className="mobile-subs"
                    style={{
                      maxHeight: isExpanded ? `${(cat.subcategories.length + 1) * 46}px` : "0",
                    }}
                  >
                    <Link
                      href={`/products?category=${cat.slug}`}
                      onClick={() => setMenuOpen(false)}
                      className="mobile-sub-all"
                    >
                      All {cat.name} →
                    </Link>
                    {cat.subcategories.map((sub) => (
                      <Link
                        key={sub._id}
                        href={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="mobile-sub-link"
                      >
                        <DiamondDot color="#c4b5fd" size={4} />
                        {sub.name}
                      </Link>
                    ))}
                    <div style={{ height: 10 }} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Pages */}
          <p className="mobile-section-label" style={{ marginTop: 8 }}>Pages</p>
          {[
            { href: "/", label: "Home" },
            { href: "/about", label: "About" },
            { href: "/blogs", label: "Blog" },
            { href: "/contact", label: "Contact Us" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="mobile-nav-link">
              {label}
            </Link>
          ))}

          {/* Auth */}
          {user ? (
            <>
              <p className="mobile-section-label" style={{ marginTop: 8 }}>Account</p>
              <div className="mobile-user-block">
                <div className="mobile-user-avatar">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="mobile-user-name">{user.name}</p>
                  <p className="mobile-user-email">{user.email}</p>
                </div>
              </div>
              <Link href="/orders" onClick={() => setMenuOpen(false)} className="mobile-nav-link">
                My Orders
              </Link>
              <Link href="/account" onClick={() => setMenuOpen(false)} className="mobile-nav-link">
                Account Settings
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="mobile-nav-link"
                  style={{ color: "#b45309" }}>
                  Admin Panel
                </Link>
              )}
              <div style={{ marginTop: 24 }}>
                <button onClick={handleLogout} className="mobile-signout">Sign out</button>
              </div>
            </>
          ) : (
            <>
              <p className="mobile-section-label" style={{ marginTop: 8 }}>Account</p>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="mobile-nav-link">
                Login
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="mobile-create-btn">
                Create Account
              </Link>
            </>
          )}

          {/* Contact */}
          <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid var(--lilac)" }}>
            <a href="tel:+19143101480" className="nav-contact-link" style={{ marginBottom: 10 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              1-914-310-1480
            </a>
            <a href="mailto:info@alphagemimports.com" className="nav-contact-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              info@alphagemimports.com
            </a>
          </div>
        </div>
      </div>

      {/* ── Cart Sidebar ── */}
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}