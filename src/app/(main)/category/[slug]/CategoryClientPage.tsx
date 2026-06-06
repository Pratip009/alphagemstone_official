"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ISubcategory {
  _id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  description?: string | null;
  category: { _id: string; name: string; slug: string };
}

interface ICategory {
  _id: string;
  name: string;
  slug: string;
  description?: string | null;
}

// ─── Strip HTML tags & decode entities ───────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Subcategory Card ─────────────────────────────────────────────────────────
function SubcategoryCard({
  sub,
  onSelect,
  index,
}: {
  sub: ISubcategory;
  onSelect: (sub: ISubcategory) => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const fallback =
    "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=400";

  return (
    <div
      onClick={() => onSelect(sub)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        gap: 16,
        animationDelay: `${index * 50}ms`,
        padding: "8px 4px",
      }}
      className="sub-card-animate"
    >
      {/* Circle image */}
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          maxWidth: 190,
          margin: "0 auto",
          overflow: "hidden",
          borderRadius: "50%",
          transition: "box-shadow 0.35s ease, border-color 0.35s ease",
          border: hovered ? "2.5px solid #ffffff" : "2.5px solid #ffffff",
          boxShadow: hovered
            ? "0 16px 40px -10px rgba(26,42,94,0.20)"
            : "0 2px 12px -4px rgba(0,0,0,0.08)",
        }}
      >
        <img
          src={sub.imageUrl ?? fallback}
          alt={sub.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: hovered ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.5s ease",
          }}
        />
      </div>

      {/* Label */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 13,
            fontWeight: hovered ? 600 : 500,
            color: hovered ? "#1a2a5e" : "#1a1714",
            lineHeight: 1.4,
            transition: "color 0.2s, font-weight 0.2s",
            letterSpacing: "0.01em",
            marginBottom: sub.description ? 6 : 0,
          }}
        >
          {sub.name}
        </p>
        {sub.description && (
          <p
            style={{
              fontSize: 11,
              color: "#a09a90",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 300,
              lineHeight: 1.55,
              maxWidth: 150,
              margin: "0 auto",
            }}
          >
            {sub.description}
          </p>
        )}
      </div>

      {/* Gold underline cue */}
      <div
        style={{
          height: "1.5px",
          width: hovered ? 36 : 0,
          background: "#c8a96e",
          borderRadius: 2,
          transition: "width 0.3s ease",
          marginTop: -8,
        }}
      />
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────
export default function CategoryClientPage({
  category,
  subcategories,
}: {
  category: ICategory;
  subcategories: ISubcategory[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = subcategories.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const cleanDescription = category.description
    ? stripHtml(category.description)
    : null;

  const descParagraphs = cleanDescription
    ? cleanDescription.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  function handleSelectSub(sub: ISubcategory) {
    router.push(
      `/products?category=${sub.category.slug}&subcategory=${sub.slug}`
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .cat-page-root {
          font-family: 'Poppins', sans-serif;
          background: #fff;
          min-height: 100vh;
          color: #1a1714;
          width: 100%;
        }

        /* ── Hero ── */
        .cat-hero {
          background: linear-gradient(140deg, #0e1a40 0%, #1a2a5e 45%, #162348 100%);
          padding: 72px 48px 64px;
          position: relative;
          overflow: hidden;
          width: 100%;
        }
        .cat-hero-pattern {
          position: absolute;
          inset: 0;
          opacity: 1;
          background-image:
            radial-gradient(circle at 20% 50%, rgba(200,169,110,0.07) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(200,169,110,0.05) 0%, transparent 40%);
        }
        .cat-hero-dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(200,169,110,0.12) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .cat-hero-inner {
          position: relative;
          z-index: 1;
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }
        .cat-hero-eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-bottom: 20px;
        }
        .cat-hero-eyebrow span {
          font-size: 10px;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: #c8a96e;
          font-family: 'Poppins', sans-serif;
          font-weight: 500;
        }
        .cat-hero-eyebrow-line {
          height: 1px;
          width: 48px;
          background: linear-gradient(90deg, transparent, #c8a96e);
        }
        .cat-hero-eyebrow-line.rev {
          background: linear-gradient(90deg, #c8a96e, transparent);
        }
        .cat-hero-title {
          font-family: 'Poppins', sans-serif;
          font-size: clamp(32px, 5.5vw, 52px);
          font-weight: 700;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 28px;
        }
        .cat-hero-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .cat-hero-divider-line {
          height: 1px;
          width: 72px;
          background: linear-gradient(90deg, transparent, rgba(200,169,110,0.45));
        }
        .cat-hero-divider-line.rev {
          background: linear-gradient(90deg, rgba(200,169,110,0.45), transparent);
        }
        .cat-hero-diamond {
          width: 7px;
          height: 7px;
          background: #c8a96e;
          transform: rotate(45deg);
          flex-shrink: 0;
        }

        /* ── Breadcrumb ── */
        .cat-breadcrumb {
          padding: 13px 48px;
          background: #fff;
          border-bottom: 1px solid #f0ece4;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-family: 'Poppins', sans-serif;
          color: #c8c2b8;
          font-weight: 400;
          width: 100%;
        }
        .cat-breadcrumb button {
          color: #1a2a5e;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 11px;
          font-family: 'Poppins', sans-serif;
          padding: 0;
          font-weight: 500;
          transition: color 0.15s;
        }
        .cat-breadcrumb button:hover { color: #c8a96e; text-decoration: underline; }

        /* ── Description section ── */
        .cat-desc-section {
          background: #fff;
          width: 100%;
          border-bottom: 1px solid #f5f2ed;
        }
        .cat-desc-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 56px 48px;
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 64px;
          align-items: start;
        }
        .cat-desc-sidebar {
          padding-top: 4px;
        }
        .cat-desc-sidebar-label {
          font-size: 9px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #c8a96e;
          font-weight: 600;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cat-desc-sidebar-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #ede9e0;
        }
        .cat-desc-name {
          font-family: 'Poppins', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a1714;
          line-height: 1.15;
          letter-spacing: -0.01em;
          margin-bottom: 16px;
        }
        .cat-desc-count-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 100px;
          background: rgba(200,169,110,0.10);
          border: 1px solid rgba(200,169,110,0.25);
          font-size: 10px;
          font-weight: 600;
          color: #9a7a35;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .cat-desc-count-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #c8a96e;
        }
        .cat-desc-text {
          color: #6b6560;
          font-size: 14.5px;
          line-height: 1.85;
          font-weight: 300;
          font-family: 'Poppins', sans-serif;
        }
        .cat-desc-text p {
          margin-bottom: 18px;
        }
        .cat-desc-text p:last-child {
          margin-bottom: 0;
        }

        /* ── Body / grid section ── */
        .cat-body {
          background: #ffffff;
          width: 100%;
          padding: 56px 48px 80px;
        }
        .cat-body-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Search + count row */
        .cat-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 44px;
          gap: 20px;
          flex-wrap: wrap;
        }
        .cat-toolbar-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cat-toolbar-heading {
          font-size: 18px;
          font-weight: 700;
          color: #1a1714;
          letter-spacing: -0.01em;
        }
        .cat-toolbar-sub {
          font-size: 12px;
          color: #a09a90;
          font-weight: 400;
        }
        .cat-search-wrap {
          position: relative;
          width: 280px;
        }
        .cat-search-input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border: 1.5px solid #ffffff;
          border-radius: 100px;
          background: #ffffff;
          font-family: 'Poppins', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #1a1714;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cat-search-input::placeholder { color: #ffffff; }
        .cat-search-input:focus {
          border-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(200,169,110,0.12);
        }
        .cat-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #c8c2b8;
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        /* Grid */
        .cat-grid {
          display: grid;
          gap: 40px 24px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 480px)  { .cat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 720px)  { .cat-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 1024px) { .cat-grid { grid-template-columns: repeat(5, 1fr); } }

        /* Card animation */
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sub-card-animate {
          animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Empty state */
        .cat-empty {
          text-align: center;
          padding: 80px 0;
        }
        .cat-empty-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 1.5px solid #ffffff;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #c8a96e;
          font-size: 22px;
        }
        .cat-empty p {
          font-family: 'Poppins', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #6b6560;
          margin-bottom: 6px;
        }
        .cat-empty span {
          font-size: 12px;
          font-family: 'Poppins', sans-serif;
          color: #c8c2b8;
          letter-spacing: 0.05em;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .cat-hero { padding: 52px 24px 48px; }
          .cat-breadcrumb { padding: 11px 24px; }
          .cat-desc-inner {
            grid-template-columns: 1fr;
            gap: 28px;
            padding: 40px 24px;
          }
          .cat-desc-name { font-size: 22px; }
          .cat-body { padding: 40px 24px 64px; }
          .cat-toolbar { flex-direction: column; align-items: flex-start; }
          .cat-search-wrap { width: 100%; }
        }
      `}</style>

      <div className="cat-page-root">

        {/* ── Hero ── */}
        <div className="cat-hero">
          <div className="cat-hero-pattern" />
          <div className="cat-hero-dots" />
          <div className="cat-hero-inner">
            <div className="cat-hero-eyebrow">
              <div className="cat-hero-eyebrow-line" />
              <span>Collection</span>
              <div className="cat-hero-eyebrow-line rev" />
            </div>
            <h1 className="cat-hero-title">{category.name}</h1>
            <div className="cat-hero-divider">
              <div className="cat-hero-divider-line" />
              <div className="cat-hero-diamond" />
              <div className="cat-hero-divider-line rev" />
            </div>
          </div>
        </div>

        {/* ── Breadcrumb ── */}
        <div className="cat-breadcrumb">
          <button onClick={() => window.history.back()}>Shop</button>
          <span>›</span>
          <span style={{ color: "#6b6560" }}>{category.name}</span>
        </div>

        {/* ── Description section (only when description exists) ── */}
        {descParagraphs.length > 0 && (
          <div className="cat-desc-section">
            <div className="cat-desc-inner">
              {/* Sidebar */}
              <div className="cat-desc-sidebar">
                <div className="cat-desc-sidebar-label">About</div>
                <div className="cat-desc-name">{category.name}</div>
                <div className="cat-desc-count-pill">
                  <div className="cat-desc-count-dot" />
                  {subcategories.length}{" "}
                  {subcategories.length === 1 ? "Collection" : "Collections"}
                </div>
              </div>

              {/* Description text */}
              <div className="cat-desc-text">
                {descParagraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Subcategory grid ── */}
        <div className="cat-body">
          <div className="cat-body-inner">

            {/* Toolbar */}
            <div className="cat-toolbar">
              <div className="cat-toolbar-left">
                <div className="cat-toolbar-heading">Browse Collections</div>
                <div className="cat-toolbar-sub">
                  {filtered.length} of {subcategories.length}{" "}
                  {subcategories.length === 1 ? "collection" : "collections"}
                  {search && ` matching "${search}"`}
                </div>
              </div>

              <div className="cat-search-wrap">
                <span className="cat-search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder={`Search in ${category.name}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="cat-search-input"
                />
              </div>
            </div>

            {/* Grid or empty state */}
            {filtered.length === 0 ? (
              <div className="cat-empty">
                <div className="cat-empty-icon">◆</div>
                <p>No collections found</p>
                <span>Try a different search term</span>
              </div>
            ) : (
              <div className="cat-grid">
                {filtered.map((sub, i) => (
                  <SubcategoryCard
                    key={sub._id}
                    sub={sub}
                    onSelect={handleSelectSub}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}