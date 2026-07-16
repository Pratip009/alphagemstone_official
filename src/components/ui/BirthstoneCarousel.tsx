"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

/**
 * BirthstoneCarousel
 * ------------------------------------------------------------------
 * A normal (flat, non-3D) horizontal slider for
 * "Make Birthdays More Colourful". Multiple gems are visible at once
 * and the whole strip slides left/right, either via the arrows or
 * automatically.
 *
 * HOW TO WIRE UP YOUR OWN IMAGES:
 * Replace the `image` field for each entry in BIRTHSTONES below with
 * the path to your local asset, e.g. "/birth/april.jpg"
 * or an imported module if you're using a bundler:
 *   import aprilImg from "../assets/birthstones/april.jpg";
 *
 * HOW THE "VIEW ALL" LINK WORKS:
 * Clicking "View All" navigates to:
 *   /products?category=occasions-and-gifts&subcategory=birthday-birthstone
 * Change VIEW_ALL_URL below if your route differs, or swap
 * window.location.href for your router's navigate() call (e.g. React
 * Router's useNavigate, or Next.js's useRouter().push).
 */

const VIEW_ALL_URL =
  "/products?category=occasions-and-gifts&subcategory=birthday-birthstone";

interface Birthstone {
  month: string;
  stone: string;
  image: string;
}

const BIRTHSTONES: Birthstone[] = [
  { month: "January", stone: "Garnet", image: "/birth/january.jpg" },
  { month: "February", stone: "Amethyst", image: "/birth/february.jpg" },
  { month: "March", stone: "Aquamarine", image: "/birth/march.jpg" },
  { month: "April", stone: "Diamond", image: "/birth/april.jpg" },
  { month: "May", stone: "Emerald", image: "/birth/may.jpg" },
  { month: "June", stone: "Pearl", image: "/birth/june.jpg" },
  { month: "July", stone: "Ruby", image: "/birth/july.jpg" },
  { month: "August", stone: "Peridot", image: "/birth/august.jpg" },
  { month: "September", stone: "Blue Sapphire", image: "/birth/september.jpg" },
  { month: "October", stone: "Opal", image: "/birth/october.jpg" },
  { month: "November", stone: "Citrine", image: "/birth/november.jpg" },
  { month: "December", stone: "Tanzanite", image: "/birth/december.jpg" },
];

const TOTAL = BIRTHSTONES.length;

// Autoplay interval in milliseconds.
const AUTOPLAY_DELAY = 3000;

// How many gems are visible at once, by breakpoint.
function getVisibleCount(width: number): number {
  if (width < 360) return 1;
  if (width < 480) return 2;
  if (width < 768) return 3;
  if (width < 1024) return 4;
  if (width < 1280) return 5;
  return 7;
}

export default function BirthstoneCarousel() {
  const [visibleCount, setVisibleCount] = useState(7);
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const dragState = useRef({ startX: 0, dragging: false, moved: false });

  const maxIndex = Math.max(TOTAL - visibleCount, 0);

  // Track viewport width to decide how many gems fit on screen.
  useEffect(() => {
    const updateVisible = () => setVisibleCount(getVisibleCount(window.innerWidth));
    updateVisible();
    window.addEventListener("resize", updateVisible);
    return () => window.removeEventListener("resize", updateVisible);
  }, []);

  // Keep the current index in range if visibleCount changes (e.g. resize).
  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(TOTAL - visibleCount, 0)));
  }, [visibleCount]);

  const handlePrev = useCallback(() => {
    setIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    setIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  // Autoplay — pauses on hover / drag.
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(handleNext, AUTOPLAY_DELAY);
    return () => clearInterval(id);
  }, [isPaused, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrev, handleNext]);

  // Drag / swipe support
  const onPointerDown = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    dragState.current.dragging = true;
    dragState.current.moved = false;
    dragState.current.startX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setIsPaused(true);
  };

  const onPointerMove = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!dragState.current.dragging) return;
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    if (Math.abs(x - dragState.current.startX) > 6) dragState.current.moved = true;
  };

  const onPointerUp = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const x = "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;
    const dx = x - dragState.current.startX;
    if (dx > 40) handlePrev();
    else if (dx < -40) handleNext();
    setIsPaused(false);
  };

  const handleViewAll = () => {
    // Swap this for your router's navigation call if needed, e.g.:
    // navigate(VIEW_ALL_URL);
    window.location.href = VIEW_ALL_URL;
  };

  const itemWidthPercent = 100 / visibleCount;
  const trackOffsetPercent = index * itemWidthPercent;
  const pageCount = maxIndex + 1;
  const currentPage = index;

  return (
    <section className="bsc-wrap">
      <h2 className="bsc-heading">
        Make Birthdays More{" "}
        <span className="bsc-colourful">
          {"Colourful".split("").map((letter, i) => (
            <span key={i} className={`bsc-letter bsc-letter-${i}`}>
              {letter}
            </span>
          ))}
        </span>
      </h2>

      <div
        className="bsc-stage"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={(e) => {
          onPointerUp(e);
          setIsPaused(false);
        }}
      >
        <button
          type="button"
          className="bsc-arrow bsc-arrow-left"
          onClick={handlePrev}
          disabled={index === 0}
          aria-label="Previous birthstone"
        >
          ‹
        </button>

        <div
          className="bsc-viewport"
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        >
          <div
            className="bsc-track"
            style={{ transform: `translateX(-${trackOffsetPercent}%)` }}
          >
            {BIRTHSTONES.map((item) => (
              <div
                key={item.month}
                className="bsc-card"
                style={{ width: `${itemWidthPercent}%` }}
              >
                <div className="bsc-gem-shadow">
                  <img
                    src={item.image}
                    alt={`${item.stone} - ${item.month} birthstone`}
                    className="bsc-gem-img"
                    draggable={false}
                  />
                </div>
                <div className="bsc-month">{item.month}</div>
                <div className="bsc-stone">{item.stone}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="bsc-arrow bsc-arrow-right"
          onClick={handleNext}
          disabled={index >= maxIndex}
          aria-label="Next birthstone"
        >
          ›
        </button>
      </div>

      {pageCount > 1 && (
        <div className="bsc-dots">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              className={`bsc-dot ${i === currentPage ? "bsc-dot-active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      <button type="button" className="bsc-view-all" onClick={handleViewAll}>
        View All
      </button>

      <style>{`
        .bsc-wrap {
          --ink: #1f2733;
          --accent: #c8862a;
          --muted: #5b6472;
          font-family: "Elms Sans", sans-serif;
          text-align: center;
          padding: 56px 16px 40px;
          background: #ffffff;
          width: 100%;
        }
        .bsc-heading {
          font-size: 30px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 40px;
        }
        .bsc-colourful {
          font-weight: 800;
        }
        .bsc-letter-0 { color: #e63946; }
        .bsc-letter-1 { color: #f4a261; }
        .bsc-letter-2 { color: #e9c46a; }
        .bsc-letter-3 { color: #2a9d8f; }
        .bsc-letter-4 { color: #1a56db; }
        .bsc-letter-5 { color: #6a4c93; }
        .bsc-letter-6 { color: #d63384; }
        .bsc-letter-7 { color: #ef476f; }
        .bsc-letter-8 { color: #ff7f11; }
        .bsc-stage {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .bsc-viewport {
          overflow: hidden;
          width: 100%;
          user-select: none;
        }
        .bsc-track {
          display: flex;
          transition: transform 0.5s cubic-bezier(.22,.61,.36,1);
        }
        .bsc-card {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 12px;
          box-sizing: border-box;
        }
        .bsc-gem-shadow {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          
        }
        .bsc-gem-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .bsc-month {
          margin-top: 16px;
          font-size: 17px;
          color: var(--ink);
          font-weight: 500;
        }
        .bsc-stone {
          margin-top: 8px;
          font-size: 14px;
          color: var(--muted);
        }
        .bsc-arrow {
          flex: 0 0 auto;
          background: none;
          border: none;
          font-size: 40px;
          line-height: 1;
          color: var(--muted);
          cursor: pointer;
          padding: 0 14px;
          transition: color 0.2s ease;
        }
        .bsc-arrow:hover:not(:disabled) {
          color: var(--ink);
        }
        .bsc-arrow:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .bsc-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 28px;
        }
        .bsc-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          border: none;
          background: #d8dbe0;
          cursor: pointer;
          padding: 0;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .bsc-dot-active {
          background: var(--accent);
          transform: scale(1.3);
        }
        .bsc-view-all {
          margin-top: 32px;
          padding: 14px 40px;
          background: #fff;
          border: 1px solid var(--ink);
          color: #1a56db;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .bsc-view-all:hover {
          background: #1a56db;
          color: #fff;
          border-color: #1a56db;
        }

        @media (max-width: 1024px) {
          .bsc-wrap { padding: 44px 14px 36px; }
          .bsc-card { padding: 0 10px; }
        }

        @media (max-width: 768px) {
          .bsc-heading { font-size: 26px; margin-bottom: 32px; }
          .bsc-gem-shadow { width: 78px; height: 78px; }
          .bsc-arrow { font-size: 34px; padding: 0 10px; }
        }

        @media (max-width: 640px) {
          .bsc-gem-shadow { width: 68px; height: 68px; }
          .bsc-month { font-size: 14px; }
          .bsc-stone { font-size: 12px; }
          .bsc-heading { font-size: 22px; }
          .bsc-arrow { font-size: 30px; padding: 0 6px; }
        }

        @media (max-width: 480px) {
          .bsc-wrap { padding: 32px 10px 28px; }
          .bsc-card { padding: 0 6px; }
          .bsc-gem-shadow { width: 60px; height: 60px; }
          .bsc-month { font-size: 13px; margin-top: 12px; }
          .bsc-stone { font-size: 11px; margin-top: 6px; }
          .bsc-arrow { font-size: 26px; padding: 0 4px; }
          .bsc-view-all { padding: 12px 28px; font-size: 14px; }
        }

        @media (max-width: 360px) {
          .bsc-heading { font-size: 19px; margin-bottom: 24px; }
          .bsc-gem-shadow { width: 52px; height: 52px; }
          .bsc-arrow { font-size: 22px; padding: 0 3px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bsc-track { transition: none; }
        }
      `}</style>
    </section>
  );
}