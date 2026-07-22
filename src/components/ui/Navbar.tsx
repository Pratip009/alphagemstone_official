"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/hooks/useCart";
import SearchBar from "./SearchBar";
import CartSidebar from "./CartSidebar";
import { useWishlist } from "@/hooks/useWishlist";
import { trackCTA, trackEvent } from "@/lib/analytics";
// ── Types ────────────────────────────────────────────────────────────────────

interface NavSubcategory {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string;
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
  const hasInitial = initialCategories.length > 0;
  const [categories, setCategories] =
    useState<NavCategory[]>(initialCategories);
  // If the server passed data in, we are never in a loading state.
  const [loading, setLoading] = useState(!hasInitial);

  useEffect(() => {
    // Server already provided data — skip the client fetch entirely.
    if (hasInitial) return;

    let cancelled = false;
    fetch("/api/categories?withSubcategories=true")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: NavCategory[] = Array.isArray(data)
          ? data
          : (data?.data ?? []);
        const filtered = list
          .filter((c) => c.isActive !== false)
          .map((c) => ({
            ...c,
            subcategories: (c.subcategories ?? []).filter(
              (s) => s.isActive !== false,
            ),
          }));
        filtered.sort((a, b) => {
          const sa = (a as any).sortOrder ?? 0;
          const sb = (b as any).sortOrder ?? 0;
          return sa !== sb ? sa - sb : a.name.localeCompare(b.name);
        });
        setCategories(filtered);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { categories, loading };
}

// ── Diamond icon (matches carousel) ─────────────────────────────────────────
function DiamondDot({
  color = "#7c3aed",
  size = 5,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect
        x="5"
        y="0.5"
        width="6.5"
        height="6.5"
        transform="rotate(45 5 5)"
        fill={color}
        fillOpacity="0.9"
      />
    </svg>
  );
}

// ── Faceted gem graphic used in the mega-menu feature panel ────────────────
function FacetPattern({ seed = 0 }: { seed?: number }) {
  // Deterministic-ish facet lines derived from the category index so every
  // dropdown gets a subtly different "cut" without any random flicker.
  const offset = (seed % 5) * 14;
  return (
    <svg
      className="mega-facet-svg"
      viewBox="0 0 360 320"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <polygon
        points={`180,${10 + offset} 340,120 260,300 100,300 20,120`}
        fill="none"
        stroke="#c4b5fd"
        strokeWidth="1"
        opacity="0.55"
      />
      <polygon
        points={`180,${10 + offset} 260,300 100,300`}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1"
        opacity="0.35"
      />
      <polygon
        points={`180,${10 + offset} 340,120 180,${170 + offset}`}
        fill="none"
        stroke="#0f3460"
        strokeWidth="1"
        opacity="0.25"
      />
      <polygon
        points={`180,${10 + offset} 20,120 180,${170 + offset}`}
        fill="none"
        stroke="#0f3460"
        strokeWidth="1"
        opacity="0.25"
      />
      <line
        x1="180"
        y1={170 + offset}
        x2="260"
        y2="300"
        stroke="#c4b5fd"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="180"
        y1={170 + offset}
        x2="100"
        y2="300"
        stroke="#c4b5fd"
        strokeWidth="1"
        opacity="0.4"
      />
    </svg>
  );
}

// ── Main Navbar ──────────────────────────────────────────────────────────────

export default function Navbar({
  initialCategories = [],
}: {
  initialCategories?: NavCategory[];
}) {
  const { user, logout, isAdmin } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const router = useRouter();
  const { categories, loading } = useNavCategories(initialCategories);

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeMobileCategory, setActiveMobileCategory] = useState<
    string | null
  >(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HOVER_OPEN_DELAY = 200;
  useEffect(() => {
    const update = () => {
      if (navRef.current) {
        // Use the nav's actual distance from the top of the viewport
        // (its bottom edge), not just its own height. When the
        // announcement bar is visible, the nav sits below it, so
        // height alone under-counts the offset and the dropdown ends
        // up overlapping the nav links.
        const bottom = navRef.current.getBoundingClientRect().bottom;
        document.documentElement.style.setProperty(
          "--navbar-height",
          `${bottom}px`,
        );
      }
    };
    update();
    window.addEventListener("resize", update);
    // Recompute on scroll too — the announcement bar scrolls away as
    // the sticky nav settles at top:0, which changes this offset
    // independently of resize events.
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close the mega-menu on escape for keyboard users
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdown(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);
  const updateNavbarHeight = () => {
    if (navRef.current) {
      const bottom = navRef.current.getBoundingClientRect().bottom;
      document.documentElement.style.setProperty(
        "--navbar-height",
        `${bottom}px`,
      );
    }
  };

  useEffect(() => {
    updateNavbarHeight();
    window.addEventListener("resize", updateNavbarHeight);
    window.addEventListener("scroll", updateNavbarHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", updateNavbarHeight);
      window.removeEventListener("scroll", updateNavbarHeight);
    };
  }, []);

  const scheduleOpen = (slug: string) => {
    cancelClose();
    if (openTimer.current) clearTimeout(openTimer.current);
    updateNavbarHeight();
    openTimer.current = setTimeout(() => {
      setOpenDropdown(slug);
    }, HOVER_OPEN_DELAY);
  };

  const cancelOpen = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
  };
  const schedulClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setProfileOpen(false);
    router.push("/");
  };

  const CartIconButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      onClick={() => {
        setMenuOpen(false);
        setCartOpen(true);
        trackCTA("open_cart", mobile ? "mobile" : "desktop");
      }}
      aria-label="Open cart"
      className={mobile ? "nav-mobile-icon-btn" : "nav-cart-btn"}
    >
      <svg
        width={mobile ? 20 : 16}
        height={mobile ? 20 : 16}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="3"
          y1="6"
          x2="21"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M16 10a4 4 0 01-8 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {!mobile && <span className="nav-btn-label">Cart</span>}
      {cartCount > 0 && (
        <span className={mobile ? "cart-badge-mobile" : "cart-badge-desktop"}>
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
  const WishlistNavButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      onClick={() => {
        setMenuOpen(false);
        router.push("/wishlist");
      }}
      aria-label="Open wishlist"
      className={mobile ? "nav-mobile-icon-btn" : "nav-cart-btn"}
    >
      <svg
        width={mobile ? 20 : 16}
        height={mobile ? 20 : 16}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!mobile && <span className="nav-btn-label">Wishlist</span>}
      {wishlistCount > 0 && (
        <span className={mobile ? "cart-badge-mobile" : "cart-badge-desktop"}>
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </button>
  );
  return (
    <>
      <style>{`
       @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');


        :root {
          --navy:    #1a1a2e;
          --deep:    #0f3460;
          --violet:  #7c3aed;
          --ink:     #2d2d3a;
          --mist:    #f5f3ff;
          --lilac:   #ede9fe;
          --petal:   #c4b5fd;
          --silver:  #939191;
          --border:  #e8e4f8;
          --display: "Elms Sans", sans-serif;
          --label:   "Elms Sans", sans-serif;
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
        @keyframes megaFacetDrift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-1.5%, 1%) scale(1.03); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes megaItemIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Announcement Bar ── */
        .announcement-bar {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          color: #ffffff;
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
          color: #ffffff;
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
        .announcement-close:hover { color: #fff; background: rgb(255, 255, 255); }

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
          background: rgb(255, 255, 255);
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
          font-size: 15px;
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
        .nav-btn-label { white-space: nowrap;font-size: 15px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--ink);
    text-decoration: none; }

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
          font-size: 15px;
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
          overflow: hidden;
        }
        .nav-avatar-lg {
          width: 38px;
          height: 38px;
          font-size: 15px;
        }
        .nav-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .profile-dropdown-header-row {
          display: flex;
          align-items: center;
          gap: 10px;
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
          background: #000000;
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
          
          color: #fff;
          background: #da0000;
          border: 1px solid #d67041;
          text-decoration: none;
          padding: 4px 10px;
          border-radius: 4px;
          margin-left: 4px;
          transition: background 0.15s;
        }
        .nav-admin-badge:hover { background: #fff; color: #da0000; }

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
          font-size: 12px;
          font-weight: 500;
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
          background: #ffffff;
          position: relative;
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
          font-size: 15px;
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

        /* ══════════════════════════════════════════════════════════════════
           Mega menu — full-width, half-viewport category dropdown
           ══════════════════════════════════════════════════════════════════ */
        .mega-backdrop {
          position: fixed;
          top: var(--navbar-height, 108px);
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 20, 40, 0.22);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          z-index: 200;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.28s ease;
        }
        .mega-backdrop.visible {
          opacity: 1;
          pointer-events: auto;
        }

        .cat-dropdown {
          position: fixed;
          top: var(--navbar-height, 108px);
          left: 0;
          width: 100vw;
          height: 58vh;
          min-height: 400px;
          background: #ffffff;
          border-bottom: 1px solid var(--border);
          box-shadow: 0 32px 72px rgba(15,52,96,0.14), 0 4px 16px rgba(0,0,0,0.05);
          z-index: 250;
          overflow: hidden;
          transition: opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
                      visibility 0.26s;
        }
        .cat-dropdown.visible {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .cat-dropdown.hidden {
          opacity: 0;
          visibility: hidden;
          transform: translateY(-14px);
        }

        .mega-inner {
          max-width: 1280px;
          margin: 0 auto;
          height: 100%;
          display: grid;
          grid-template-columns: 320px 1fr;
        }

        /* Left feature panel */
        .mega-feature {
          position: relative;
          overflow: hidden;
          padding: 44px 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: linear-gradient(160deg, var(--mist) 0%, #ffffff 78%);
          border-right: 1px solid var(--border);
        }
        .mega-facet-svg {
          position: absolute;
          inset: -10% -10%;
          width: 120%;
          height: 120%;
          animation: megaFacetDrift 14s ease-in-out infinite;
        }
        .mega-eyebrow {
          position: relative;
          font-family: var(--label);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--violet);
          margin-bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .mega-title {
          position: relative;
          font-family: var(--display);
          font-weight: 600;
          font-size: clamp(28px, 2.6vw, 38px);
          letter-spacing: -0.02em;
          color: var(--navy);
          line-height: 1.05;
          margin: 0 0 12px;
        }
        .mega-count {
          position: relative;
          font-family: var(--label);
          font-size: 12px;
          font-weight: 300;
          letter-spacing: 0.04em;
          color: var(--silver);
          margin: 0 0 28px;
        }
        .mega-cta {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          font-family: var(--label);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #fff;
          background: #000000;
          text-decoration: none;
          padding: 12px 20px;
          border-radius: 4px;
          box-shadow: 0 3px 12px rgba(124,58,237,0.28);
          transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s, gap 0.2s;
        }
        .mega-cta:hover {
          opacity: 0.92;
          gap: 12px;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(124,58,237,0.38);
        }

        /* Right subcategory grid */
        .mega-subs-panel {
          padding: 40px 44px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--lilac) transparent;
        }
        .mega-subs-panel::-webkit-scrollbar { width: 4px; }
        .mega-subs-panel::-webkit-scrollbar-thumb { background: var(--lilac); border-radius: 2px; }

        .mega-subs-grid {
          columns: 3 220px;
          column-gap: 36px;
        }
        @media (min-width: 1100px) {
          .mega-subs-grid { columns: 4 220px; }
        }

        .mega-sub-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 8px;
          margin-bottom: 2px;
          border-radius: 8px;
          font-family: var(--label);
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.01em;
          color: var(--ink);
          text-decoration: none;
          break-inside: avoid;
          -webkit-column-break-inside: avoid;
          transition: background 0.14s, color 0.14s, transform 0.14s;
          animation: megaItemIn 0.3s ease both;
        }
        .mega-sub-item:hover {
          background: var(--mist);
          color: var(--deep);
          transform: translateX(3px);
        }
        .mega-sub-item .sub-link-img,
        .mega-sub-item .sub-link-img-placeholder {
          width: 34px;
          height: 34px;
        }
        .mega-sub-item span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sub-link-img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }
        .sub-link-img-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          background: linear-gradient(135deg, var(--lilac), var(--mist));
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
        }

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
          overflow: hidden;
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
      <div
        className={`announcement-bar${announcementVisible ? "" : " hidden"}`}
      >
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="ticker-wrap">
            {[0, 1].map((n) => (
              <span key={n} className="ticker-item">
                <DiamondDot color="#c4b5fd" size={5} />
                Free Shipping on 100+ Gemstones &amp; Diamonds
                <DiamondDot color="#7c3aed" size={4} />
                Questions? Email&nbsp;
                <a href="mailto:info@alphagemimports.com">
                  info@alphagemimports.com
                </a>
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
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
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
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="nav-logo"
          >
            <Image
              src="/logo/applogo.png"
              alt="Alpha Gemstones Logo"
              width={150}
              height={50}
              priority
            />
          </Link>

          {/* Desktop Search */}
          <div
            className="desktop-only"
            style={{ flex: "1 1 auto", maxWidth: "340px" }}
          >
            <SearchBar
              initialCategories={initialCategories}
              variant="desktop"
            />
          </div>

          {/* Desktop Right */}
          <div className="nav-right">
            <div className="nav-actions-row">
              <Link href="/" className="nav-link" data-track-click="nav_home">
                Home
              </Link>
              <Link
                href="/about"
                className="nav-link"
                data-track-click="nav_about"
              >
                About
              </Link>
              <Link
                href="/blogs"
                className="nav-link"
                data-track-click="nav_blog"
              >
                Blog
              </Link>
              <Link
                href="/contact"
                className="nav-link"
                data-track-click="nav_contact"
              >
                Contact
              </Link>

              {user ? (
                <>
                  <WishlistNavButton />
                  <CartIconButton />
                  <a href="/orders" className="nav-link">
                    Orders
                  </a>

                  <div ref={profileRef} style={{ position: "relative" }}>
                    <button
                      className="nav-profile-btn"
                      onClick={() => setProfileOpen(!profileOpen)}
                    >
                      <div className="nav-avatar">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={user.name}
                            width={26}
                            height={26}
                            className="nav-avatar-img"
                          />
                        ) : (
                          user.name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      Account
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 10 10"
                        fill="none"
                        className={`nav-chevron${profileOpen ? " open" : ""}`}
                      >
                        <path
                          d="M2 3.5L5 6.5L8 3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <div
                      className={`profile-dropdown${profileOpen ? " open" : " closed"}`}
                    >
                      <div className="profile-dropdown-header profile-dropdown-header-row">
                        <div className="nav-avatar nav-avatar-lg">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.name}
                              width={38}
                              height={38}
                              className="nav-avatar-img"
                            />
                          ) : (
                            user.name?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="profile-dropdown-label">Signed in as</p>
                          <p className="profile-dropdown-name">{user.name}</p>
                          <p className="profile-dropdown-email">{user.email}</p>
                        </div>
                      </div>
                      <div style={{ padding: "6px 0" }}>
                        <a
                          href="/orders"
                          className="dropdown-nav-link"
                          onClick={() => setProfileOpen(false)}
                        >
                          <DiamondDot color="#c4b5fd" /> My Orders
                        </a>
                        <a
                          href="/account"
                          className="dropdown-nav-link"
                          onClick={() => setProfileOpen(false)}
                        >
                          <DiamondDot color="#c4b5fd" /> Account Settings
                        </a>
                        {isAdmin && (
                          <a
                            href="/admin"
                            className="dropdown-nav-link"
                            onClick={() => setProfileOpen(false)}
                          >
                            <DiamondDot color="#c4b5fd" /> Admin Panel
                          </a>
                        )}
                      </div>
                      <div
                        style={{
                          borderTop: "1px solid var(--lilac)",
                          padding: "6px 0",
                        }}
                      >
                        <button
                          onClick={handleLogout}
                          className="dropdown-signout"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <a
                    href="/login"
                    className="nav-link"
                    data-track-click="nav_login"
                  >
                    Login
                  </a>
                  <Link
                    href="/signup"
                    className="nav-signup-btn"
                    data-track-click="nav_signup"
                  >
                    Sign Up
                  </Link>
                </>
              )}

              {isAdmin && (
                <a
                  href="/admin"
                  className="nav-admin-badge"
                  data-track-click="nav_admin"
                >
                  Admin
                </a>
              )}
            </div>

            {/* Contact row */}
            <div className="nav-contact-row">
              <a href="tel:+19143101480" className="nav-contact-link">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                1-914-310-1480
              </a>
              <a
                href="mailto:info@alphagemimports.com"
                className="nav-contact-link"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="22,6 12,13 2,6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                info@alphagemimports.com
              </a>
            </div>
          </div>

          {/* Mobile: Cart + Hamburger */}
          <div
            className="mobile-only"
            style={{ alignItems: "center", gap: "10px" }}
          >
            {user && <WishlistNavButton mobile />}
            {user && <CartIconButton mobile />}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="hamburger"
            >
              <span
                className="hamburger-line"
                style={{
                  transform: menuOpen
                    ? "translateY(6.5px) rotate(45deg)"
                    : "none",
                }}
              />
              <span
                className="hamburger-line"
                style={{ opacity: menuOpen ? 0 : 1 }}
              />
              <span
                className="hamburger-line"
                style={{
                  transform: menuOpen
                    ? "translateY(-6.5px) rotate(-45deg)"
                    : "none",
                }}
              />
            </button>
          </div>
        </div>

        {/* ── Category Row — Desktop ── */}
        <div className="cat-row desktop-block">
          <div className="cat-row-inner">
            {loading &&
              [110, 105, 145, 75, 88, 120, 88, 55].map((w, i) => (
                <div key={i} className="cat-shimmer" style={{ width: w }} />
              ))}

            {!loading &&
              categories.map((cat) => {
                const isOpen = openDropdown === cat.slug;
                return (
                  <div
                    key={cat._id}
                    style={{ position: "relative" }}
                    onMouseEnter={() => scheduleOpen(cat.slug)}
                    onMouseLeave={() => {
                      cancelOpen();
                      schedulClose();
                    }}
                  >
                    <Link
                      href={`/products?category=${cat.slug}`}
                      className={`cat-tab${isOpen ? " open" : ""}`}
                      data-track-click={`category_tab_${cat.slug}`}
                      onClick={() =>
                        trackEvent("filter_apply", {
                          filterType: "category",
                          filterValue: cat.slug,
                        })
                      }
                    >
                      {cat.name}
                      {(cat.subcategories?.length ?? 0) > 0 && (
                        <svg
                          className="chevron"
                          width="9"
                          height="9"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </Link>
                  </div>
                );
              })}
          </div>
        </div>

        {/* ── Mega Menu — full width / half viewport, one shared panel ──
             The backdrop covers the whole page below the menu. It must NOT
             cancel the close timer on hover — that was the bug: touching
             the backdrop anywhere kept re-cancelling the close, so leaving
             the dropdown never actually closed it. Now it schedules a
             close (same as leaving the tab) and also closes on click. */}
        <div
          className={`mega-backdrop${openDropdown ? " visible" : ""}`}
          onMouseEnter={schedulClose}
          onClick={() => {
            cancelOpen();
            setOpenDropdown(null);
          }}
        />
        {!loading &&
          categories.map((cat, i) => {
            if ((cat.subcategories?.length ?? 0) === 0) return null;
            const isOpen = openDropdown === cat.slug;
            return (
              <div
                key={cat._id}
                className={`cat-dropdown${isOpen ? " visible" : " hidden"}`}
                onMouseEnter={cancelClose}
                onMouseLeave={() => {
                  cancelOpen();
                  schedulClose();
                }}
              >
                <div className="mega-inner">
                  <div className="mega-feature">
                    <FacetPattern seed={i} />
                    <span className="mega-eyebrow">
                      <DiamondDot color="#7c3aed" size={6} />
                      Collection
                    </span>
                    <h3 className="mega-title">{cat.name}</h3>
                    <p className="mega-count">
                      {cat.subcategories.length} curated{" "}
                      {cat.subcategories.length === 1 ? "cut" : "cuts"} &amp;
                      styles
                    </p>
                    <Link
                      href={`/products?category=${cat.slug}`}
                      onClick={() => {
                        setOpenDropdown(null);
                        trackEvent("cta_click", {
                          ctaId: `mega_shop_all_${cat.slug}`,
                        });
                      }}
                      className="mega-cta"
                      data-track-cta={`mega_shop_all_${cat.slug}`}
                    >
                      Shop all {cat.name}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3 8h10M9 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </div>

                  <div className="mega-subs-panel">
                    <div className="mega-subs-grid">
                      {cat.subcategories.map((sub, si) => (
                        <Link
                          key={sub._id}
                          href={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                          onClick={() => {
                            setOpenDropdown(null);
                            trackEvent("filter_apply", {
                              filterType: "subcategory",
                              filterValue: sub.slug,
                              productCategory: cat.slug,
                            });
                          }}
                          className="mega-sub-item"
                          style={{
                            animationDelay: `${Math.min(si, 12) * 18}ms`,
                          }}
                        >
                          {sub.imageUrl ? (
                            <img
                              src={sub.imageUrl}
                              alt={sub.name}
                              className="sub-link-img"
                            />
                          ) : (
                            <div className="sub-link-img-placeholder">
                              <DiamondDot color="#c4b5fd" size={4} />
                            </div>
                          )}
                          <span>{sub.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </nav>

      {/* ── Mobile / Tablet Menu Overlay ── */}
      {/* Rendered always so the slide-out animation plays; pointer-events handled by .closed class */}
      <div
        className={`mobile-overlay${menuOpen ? " open" : " closed"} desktop-only-hide`}
        style={{ display: menuOpen ? undefined : "none" }}
        aria-hidden={!menuOpen}
      >
        <div
          style={{
            padding: "20px 24px 60px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Mobile Search */}
          <div className="mobile-search">
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: "var(--silver)", flexShrink: 0 }}
            >
              <circle
                cx="6.5"
                cy="6.5"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input type="text" placeholder="Search gemstones…" />
          </div>

          {/* Categories */}
          <p className="mobile-section-label">Collections</p>

          {loading &&
            [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mobile-shimmer" />
            ))}

          {!loading &&
            categories.map((cat, idx) => {
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
                        trackEvent("filter_apply", {
                          filterType: "category",
                          filterValue: cat.slug,
                        });
                        router.push(`/products?category=${cat.slug}`);
                        setMenuOpen(false);
                      } else {
                        setActiveMobileCategory(isExpanded ? null : cat.slug);
                      }
                    }}
                    className={`mobile-cat-btn${isExpanded ? " active" : ""}`}
                    data-track-click={`mobile_category_${cat.slug}`}
                  >
                    {cat.name}
                    {hasSubs && (
                      <div
                        className={`mobile-cat-chevron${isExpanded ? " active" : ""}`}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 10 10"
                          fill="none"
                          style={{
                            transition: "transform 0.25s",
                            transform: isExpanded
                              ? "rotate(180deg)"
                              : "rotate(0)",
                          }}
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke={isExpanded ? "#fff" : "var(--deep)"}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </button>

                  {hasSubs && (
                    <div
                      className="mobile-subs"
                      style={{
                        maxHeight: isExpanded
                          ? `${(cat.subcategories.length + 1) * 46}px`
                          : "0",
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
                          onClick={() => {
                            setMenuOpen(false);
                            trackEvent("filter_apply", {
                              filterType: "subcategory",
                              filterValue: sub.slug,
                              productCategory: cat.slug,
                            });
                          }}
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
          <p className="mobile-section-label" style={{ marginTop: 8 }}>
            Pages
          </p>
          {[
            { href: "/", label: "Home" },
            { href: "/about", label: "About" },
            { href: "/blogs", label: "Blog" },
            { href: "/contact", label: "Contact Us" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="mobile-nav-link"
            >
              {label}
            </Link>
          ))}

          {/* Auth */}
          {user ? (
            <>
              <p className="mobile-section-label" style={{ marginTop: 8 }}>
                Account
              </p>
              <div className="mobile-user-block">
                <div className="mobile-user-avatar">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.name}
                      width={42}
                      height={42}
                      className="nav-avatar-img"
                    />
                  ) : (
                    user.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="mobile-user-name">{user.name}</p>
                  <p className="mobile-user-email">{user.email}</p>
                </div>
              </div>
              <Link
                href="/orders"
                onClick={() => setMenuOpen(false)}
                className="mobile-nav-link"
              >
                My Orders
              </Link>
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="mobile-nav-link"
              >
                Account Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="mobile-nav-link"
                  style={{ color: "#b45309" }}
                >
                  Admin Panel
                </Link>
              )}
              <div style={{ marginTop: 24 }}>
                <button onClick={handleLogout} className="mobile-signout">
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mobile-section-label" style={{ marginTop: 8 }}>
                Account
              </p>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="mobile-nav-link"
                data-track-click="nav_login_mobile"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="mobile-create-btn"
                data-track-click="nav_signup_mobile"
              >
                Create Account
              </Link>
            </>
          )}

          {/* Contact */}
          <div
            style={{
              marginTop: 36,
              paddingTop: 20,
              borderTop: "1px solid var(--lilac)",
            }}
          >
            <a
              href="tel:+19143101480"
              className="nav-contact-link"
              style={{ marginBottom: 10 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              1-914-310-1480
            </a>
            <a
              href="mailto:info@alphagemimports.com"
              className="nav-contact-link"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="22,6 12,13 2,6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
