"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

const testimonials = [
  {
    id: 1,
    name: "Catherine Whitmore",
    role: "Private Collector · New York",
    gem: "Burmese Ruby",
    gemBg: "rgba(120,30,30,0.55)",
    gemText: "#ffb5b5",
    quote:
      "The 4.2ct Burmese ruby I acquired through Alpha Imports is nothing short of extraordinary. Their gemologists provided certification that matched every facet of the stone's provenance — a truly rare find from a house that understands rarity.",
    photo: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&q=85&fit=crop",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=160&q=80&fit=crop&crop=face",
  },
  {
    id: 2,
    name: "James Harrington III",
    role: "Estate Jeweler · London",
    gem: "Kashmir Sapphire",
    gemBg: "rgba(25,50,110,0.55)",
    gemText: "#a8c0f5",
    quote:
      "I have sourced stones from dealers across four continents. Alpha Imports consistently delivers what others only promise — transparency, impeccable grading, and stones that stop you mid-breath. Their Kashmir sapphires are beyond compare.",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=85&fit=crop",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&q=80&fit=crop&crop=face",
  },
  {
    id: 3,
    name: "Mei-Lin Zhao",
    role: "Haute Joaillerie Designer · Hong Kong",
    gem: "Colombian Emerald",
    gemBg: "rgba(12,55,32,0.55)",
    gemText: "#7de0aa",
    quote:
      "When designing our haute joaillerie collection, only the finest emeralds would suffice. Alpha Imports sourced seven matched Colombian emeralds with identical saturation — something I thought impossible. They made our entire season.",
    photo: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=1200&q=85&fit=crop",
    avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=160&q=80&fit=crop&crop=face",
  },
  {
    id: 4,
    name: "Dominique Arsenault",
    role: "Auction Specialist · Sotheby's Geneva",
    gem: "Fancy Vivid Diamond",
    gemBg: "rgba(80,56,0,0.55)",
    gemText: "#f5d97a",
    quote:
      "For our Geneva auction we required a 3ct+ Fancy Vivid Yellow — flawless provenance, GIA certified. Alpha Imports delivered within a week. The stone achieved 340% of its reserve. Their network is unparalleled in the trade.",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=85&fit=crop",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&q=80&fit=crop&crop=face",
  },
  {
    id: 5,
    name: "Priya Kapoor-Singh",
    role: "Client & Collector · Mumbai",
    gem: "Argyle Pink Diamond",
    gemBg: "rgba(80,22,55,0.55)",
    gemText: "#f5a8d0",
    quote:
      "My engagement ring features a 1.8ct Argyle pink diamond from Alpha Imports. The team walked me through every aspect — origin, grading, setting possibilities. It is the most beautiful object I have ever owned.",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=85&fit=crop",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&q=80&fit=crop&crop=face",
  },
];

const INTERVAL = 5000;

export default function Testimonials() {
  const [cur, setCur] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = testimonials.length;

  const goTo = useCallback((idx: number) => {
    setCur(idx);
    setAnimKey((k) => k + 1);
  }, []);

  const next = useCallback(() => goTo((cur + 1) % total), [cur, goTo, total]);
  const prev = useCallback(() => goTo((cur - 1 + total) % total), [cur, goTo, total]);

  // Auto-slide: always running unless paused, restarts cleanly when cur/paused changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (paused) return;
    timerRef.current = setInterval(() => {
      setCur((c) => (c + 1) % total);
      setAnimKey((k) => k + 1);
    }, INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, total]);

  return (
    <>
      <style>{`
      


        .tr-root {
          background: #080f1e;
          width: 100%;
          height: 80vh;
          min-height: 480px;
          max-height: 900px;
          font-family: "Elms Sans", sans-serif;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .tr-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 75% 55% at 18% 0%, rgba(30,55,110,0.50) 0%, transparent 60%),
            radial-gradient(ellipse 55% 45% at 82% 100%, rgba(18,38,82,0.45) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .tr-bg-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          opacity: 0.07;
          z-index: 0;
        }

        /* ── Header (compact) ── */
        .tr-header {
          position: relative;
          z-index: 2;
          text-align: center;
          padding: 28px 24px 20px;
          flex-shrink: 0;
        }

        .tr-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-size: 9px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: #5d84cc;
          font-weight: 500;
          margin-bottom: 8px;
        }
        .tr-eyebrow::before, .tr-eyebrow::after {
          content: '';
          display: block;
          width: 32px; height: 1px;
          background: linear-gradient(90deg, transparent, #3a5a9a);
        }
        .tr-eyebrow::after { background: linear-gradient(90deg, #3a5a9a, transparent); }

        .tr-heading {
          font-family: "Elms Sans", sans-serif;
          font-size: clamp(28px, 3.8vw, 48px);
          font-weight: 300;
          color: #eef2fb;
          line-height: 1.06;
          letter-spacing: -0.015em;
        }
        .tr-heading em { font-style: italic; color: #7aa3e8; font-weight: 400; }

        /* ── Stage fills remaining height ── */
        .tr-stage {
          position: relative;
          z-index: 2;
          flex: 1;
          min-height: 0;
        }

        .tr-slide { display: none; }
        .tr-slide.active {
          display: grid;
          grid-template-columns: 1fr 1fr;
          height: 100%;
          animation: trFadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }

        @keyframes trFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Image panel ── */
        .tr-img-panel {
          position: relative;
          overflow: hidden;
        }
        .tr-img-panel img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          filter: brightness(0.78) saturate(0.8);
          transition: transform 8s ease;
        }
        .tr-slide.active .tr-img-panel img { transform: scale(1.04); }

        .tr-img-overlay-r {
          position: absolute; inset: 0;
          background: linear-gradient(100deg, transparent 38%, #080f1e 97%);
        }
        .tr-img-overlay-b {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(8,15,30,0.65) 0%, transparent 45%);
        }

        .tr-gem-pill {
          position: absolute;
          bottom: 20px; left: 20px;
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 600;
          padding: 5px 13px;
          border-radius: 2px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .tr-progress {
          position: absolute;
          bottom: 0; left: 0;
          height: 2px;
          background: rgba(100,150,240,0.75);
          width: 0%;
        }
        .tr-progress.running {
          animation: trProg 5s linear forwards;
        }
        @keyframes trProg { from{width:0%} to{width:100%} }

        /* ── Text panel ── */
        .tr-text-panel {
          padding: 36px 48px 32px 52px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0;
          overflow: hidden;
        }

        .tr-stars {
          display: flex; gap: 4px;
          margin-bottom: 14px;
        }
        .tr-star {
          font-size: 13px; color: #5a82cc;
          animation: trStarPop 0.3s ease backwards;
        }
        @keyframes trStarPop {
          from { transform: scale(0.3); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }

        .tr-big-quote {
          font-family: "Elms Sans", sans-serif;
          font-size: 80px;
          line-height: 0.6;
          color: rgba(90,130,210,0.12);
          font-style: italic;
          user-select: none;
          margin-bottom: 6px;
        }

        .tr-quote {
          font-family: "Elms Sans", sans-serif;
          font-size: clamp(16px, 1.7vw, 20px);
          font-style: italic;
          font-weight: 400;
          color: #b8cef0;
          line-height: 1.72;
          margin-bottom: 24px;
          display: -webkit-box;
          -webkit-line-clamp: 5;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .tr-rule {
          width: 44px; height: 1px;
          background: rgba(90,130,210,0.28);
          margin-bottom: 20px;
          flex-shrink: 0;
        }

        .tr-author {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }

        .tr-avatar {
          width: 44px; height: 44px;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid rgba(90,130,210,0.30);
          flex-shrink: 0;
        }
        .tr-avatar img {
          width: 100%; height: 100%;
          object-fit: cover;
          filter: grayscale(15%);
        }

        .tr-author-name {
          font-size: 13px; font-weight: 600;
          color: #dde8f8; letter-spacing: 0.025em;
          margin-bottom: 4px;
        }
        .tr-author-role {
          font-size: 10px; color: #435f96;
          letter-spacing: 0.12em;
          text-transform: uppercase; font-weight: 400;
        }

        /* ── Nav (compact) ── */
        .tr-nav {
          position: relative; z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 14px 24px 16px;
          flex-shrink: 0;
        }

        .tr-arrow {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(90,130,210,0.22);
          background: rgba(255,255,255,0.03);
          color: #6b9ef0;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.22s, background 0.22s;
        }
        .tr-arrow:hover {
          border-color: rgba(90,130,210,0.55);
          background: rgba(90,130,210,0.10);
        }

        .tr-dots { display: flex; align-items: center; gap: 8px; }
        .tr-dot {
          height: 5px; border-radius: 3px;
          border: none; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          background: rgba(90,130,210,0.22);
          width: 5px; padding: 0;
        }
        .tr-dot.on { background: #6b9ef0; width: 22px; }
        .tr-dot:hover:not(.on) { background: rgba(90,130,210,0.45); }

        .tr-counter {
          position: absolute; right: 24px;
          font-size: 10px; letter-spacing: 0.2em;
          color: #243558; font-weight: 300;
        }
        .tr-counter b { color: #6b9ef0; font-weight: 500; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .tr-root { height: auto; max-height: none; }
          .tr-slide.active {
            grid-template-columns: 1fr;
            height: auto;
          }
          .tr-img-panel { height: 240px; }
          .tr-img-overlay-r {
            background: linear-gradient(to top, #080f1e 0%, transparent 65%);
          }
          .tr-text-panel { padding: 28px 20px 24px; }
          .tr-big-quote { font-size: 60px; }
          .tr-quote { -webkit-line-clamp: 6; }
        }
      `}</style>

      <section
        className="tr-root"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <svg className="tr-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <line x1="0" y1="0" x2="1440" y2="900" stroke="#6b9ef0" strokeWidth="0.8" />
          <line x1="1440" y1="0" x2="0" y2="900" stroke="#6b9ef0" strokeWidth="0.8" />
          <line x1="720" y1="0" x2="720" y2="900" stroke="#6b9ef0" strokeWidth="0.5" />
          <line x1="0" y1="450" x2="1440" y2="450" stroke="#6b9ef0" strokeWidth="0.5" />
          <circle cx="720" cy="450" r="340" fill="none" stroke="#6b9ef0" strokeWidth="0.5" />
          <circle cx="720" cy="450" r="200" fill="none" stroke="#6b9ef0" strokeWidth="0.4" />
          <polygon points="720,100 1140,670 300,670" fill="none" stroke="#6b9ef0" strokeWidth="0.5" />
        </svg>

        <header className="tr-header">
          <div className="tr-eyebrow"><span>Client Voices</span></div>
          <h2 className="tr-heading">Worn with <em>trust</em></h2>
        </header>

        <div className="tr-stage">
          {testimonials.map((item, i) => (
            <div key={item.id} className={`tr-slide${i === cur ? " active" : ""}`}>
              <div className="tr-img-panel">
                <img src={item.photo} alt={item.name} loading="lazy" />
                <div className="tr-img-overlay-r" />
                <div className="tr-img-overlay-b" />
                <div className="tr-gem-pill" style={{ background: item.gemBg, color: item.gemText }}>
                  {item.gem}
                </div>
                <div key={animKey} className={`tr-progress${!paused ? " running" : ""}`} />
              </div>

              <div className="tr-text-panel">
                <div className="tr-stars">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <span key={si} className="tr-star" style={{ animationDelay: `${si * 0.07}s` }}>★</span>
                  ))}
                </div>
                <div className="tr-big-quote" aria-hidden="true">"</div>
                <p className="tr-quote">"{item.quote}"</p>
                <div className="tr-rule" />
                <div className="tr-author">
                  <div className="tr-avatar">
                    <img src={item.avatar} alt={item.name} />
                  </div>
                  <div>
                    <div className="tr-author-name">{item.name}</div>
                    <div className="tr-author-role">{item.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="tr-nav">
          <button className="tr-arrow" aria-label="Previous" onClick={prev}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="tr-dots">
            {testimonials.map((_, i) => (
              <button key={i} className={`tr-dot${i === cur ? " on" : ""}`}
                aria-label={`Go to testimonial ${i + 1}`} onClick={() => goTo(i)} />
            ))}
          </div>

          <button className="tr-arrow" aria-label="Next" onClick={next}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="tr-counter">
            <b>{String(cur + 1).padStart(2, "0")}</b>{" / "}{String(total).padStart(2, "0")}
          </div>
        </div>
      </section>
    </>
  );
}