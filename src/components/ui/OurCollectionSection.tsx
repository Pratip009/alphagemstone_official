"use client";

/**
 * OurCollectionSection — homepage "Our Collection" band.
 *
 * Presents the whole Alpha business (diamonds, precious and semi-precious
 * stones, jewelry, wholesale lots, hard-to-find sizes) rather than a single
 * product. One reveal plays when the section scrolls into view: the gold
 * lines fan out from a single diamond (the "one source") to the six parts
 * of the business. Everything is static for visitors who prefer reduced
 * motion.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gemOutline } from "@/components/home/gemShapes";

interface OurCollectionSectionProps {
  videoSrc: string;
}

type IconKind = "round" | "oval" | "cushion" | "pear" | "lots" | "sizes";

const OFFERINGS: { name: string; note: string; icon: IconKind }[] = [
  { name: "Diamonds", note: "Loose stones, matched pairs and melee", icon: "round" },
  { name: "Precious gemstones", note: "Ruby, sapphire and emerald", icon: "oval" },
  { name: "Semi-precious stones", note: "Colored stones in every shade", icon: "cushion" },
  { name: "Jewelry", note: "Finished pieces set in fine gold", icon: "pear" },
  { name: "Wholesale lots", note: "Parcels priced for the trade", icon: "lots" },
  { name: "Hard-to-find sizes", note: "From 0.5 mm melee to 13 mm and up", icon: "sizes" },
];

function OfferingIcon({ kind }: { kind: IconKind }) {
  const S = 44;
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" as const };
  let paths: { d: string; x: number; y: number }[];

  if (kind === "lots") {
    // A small parcel: three stones clustered together
    const d = gemOutline("round", 17).d;
    paths = [
      { d, x: 13, y: 29 },
      { d, x: 31, y: 29 },
      { d, x: 22, y: 14 },
    ];
  } else if (kind === "sizes") {
    // Three stones stepping up in size along one baseline
    paths = [
      { d: gemOutline("round", 9).d, x: 5.5, y: 32.5 },
      { d: gemOutline("round", 15).d, x: 17.5, y: 29.5 },
      { d: gemOutline("round", 23).d, x: 31.5, y: 25.5 },
    ];
  } else {
    paths = [{ d: gemOutline(kind, 34).d, x: S / 2, y: S / 2 }];
  }

  return (
    <svg className="oc-icon" width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
      {paths.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <path d={p.d} {...stroke} />
          <path d={p.d} {...stroke} transform="scale(0.5)" opacity={0.5} />
        </g>
      ))}
    </svg>
  );
}

export default function OurCollectionSection({ videoSrc }: OurCollectionSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  const fanRef = useRef<HTMLDivElement>(null);
  const [fan, setFan] = useState({ w: 1000, h: 100 });

  // Keep the fan's coordinate system in real pixels so the lines land
  // exactly on each column's centre at every width.
  useEffect(() => {
    const el = fanRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setFan({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const n = OFFERINGS.length;

  return (
    <section
      ref={ref}
      id="our-collection"
      aria-labelledby="our-collection-title"
      className="oc"
      data-revealed={revealed ? "true" : "false"}
    >
      <style>{CSS}</style>

      <div className="oc-inner">
        <div className="oc-top">
          <div className="oc-copy">
            <h2 id="our-collection-title" className="oc-title">
              <span className="oc-title-1">One source.</span>
              <span className="oc-title-2">Thousands of possibilities.</span>
            </h2>
            <p className="oc-lede">
              Explore diamonds, precious gemstones, semi-precious stones, jewelry,
              wholesale lots and hard-to-find sizes — backed by Alpha&rsquo;s
              experience since 1988.
            </p>
            <div className="oc-actions">
              <Link href="/products" className="oc-btn">
                Shop the collection
              </Link>
              <Link href="/contact" className="oc-link">
                Ask about a size or lot
              </Link>
            </div>
          </div>

          <div className="oc-media">
            <div className="oc-frame">
              <video
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/images/our-collection-poster.webp"
                aria-hidden="true"
                className="oc-video"
              >
                {/* Decorative, silent footage; empty captions track satisfies a11y audits. */}
                <track kind="captions" src="/video/empty-captions.vtt" srcLang="en" label="English" default />
              </video>
            </div>
          </div>
        </div>

        {/* One source fanning out to every part of the business */}
        <div className="oc-fan" ref={fanRef} aria-hidden="true">
          <svg className="oc-source" width="30" height="30" viewBox="-15 -15 30 30">
            <path d={gemOutline("round", 26).d} fill="none" stroke="currentColor" strokeWidth={1.2} />
            <path d={gemOutline("round", 26).d} fill="none" stroke="currentColor" strokeWidth={1.2} transform="scale(0.5)" opacity={0.55} />
          </svg>
          <svg className="oc-rays" viewBox={`0 0 ${fan.w} ${fan.h}`}>
            {OFFERINGS.map((_, i) => {
              const cx = fan.w / 2;
              const x = (fan.w / n) * (i + 0.5);
              return (
              <path
                key={i}
                d={`M${cx} 0 C ${cx} ${fan.h * 0.6}, ${x} ${fan.h * 0.35}, ${x} ${fan.h}`}
                pathLength={1}
                style={{ transitionDelay: `${150 + Math.abs(i - (n - 1) / 2) * 90}ms` }}
              />
              );
            })}
          </svg>
        </div>

        <ul className="oc-list">
          {OFFERINGS.map((o, i) => (
            <li
              key={o.name}
              className="oc-item"
              style={{ transitionDelay: `${550 + Math.abs(i - (n - 1) / 2) * 90}ms` }}
            >
              <OfferingIcon kind={o.icon} />
              <h3 className="oc-item-name">{o.name}</h3>
              <p className="oc-item-note">{o.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const CSS = `
.oc {
  --oc-night: #0E1838;
  --oc-navy: #16234f;
  --oc-platinum: #E9EBF1;
  --oc-mist: #A7B0C6;
  --oc-gold: #C8A66A;
  --oc-gold-soft: rgba(200, 166, 106, 0.28);
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(60% 70% at 78% 30%, rgba(80, 110, 190, 0.22), transparent 70%),
    linear-gradient(180deg, var(--oc-night), #0B1430);
  color: var(--oc-platinum);
  font-family: "Elms Sans", system-ui, sans-serif;
}
.oc-inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: clamp(64px, 9vw, 120px) clamp(20px, 5vw, 64px) clamp(56px, 7vw, 96px);
}
.oc-top {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: clamp(32px, 5vw, 80px);
  align-items: center;
}

/* Headline */
.oc-title {
  margin: 0;
  font-family: "Cormorant Garamond", Georgia, serif;
  text-transform: uppercase;
  line-height: 0.95;
}
.oc-title-1 {
  display: block;
  font-weight: 500;
  font-size: clamp(46px, 6vw, 88px);
  letter-spacing: 0.015em;
  white-space: nowrap;
  background: linear-gradient(100deg, var(--oc-platinum) 0%, var(--oc-platinum) 40%, #fff8e6 50%, var(--oc-platinum) 60%, var(--oc-platinum) 100%);
  background-size: 250% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.oc[data-revealed="true"] .oc-title-1 {
  animation: oc-glint 1.8s cubic-bezier(.4,0,.2,1) 0.2s 1 both;
}
@keyframes oc-glint {
  from { background-position: 100% 0; }
  to   { background-position: 0% 0; }
}
.oc-title-2 {
  display: block;
  margin-top: 0.35em;
  font-weight: 400;
  font-size: clamp(19px, 2.05vw, 30px);
  letter-spacing: 0.12em;
  line-height: 1.15;
  color: var(--oc-gold);
}
.oc-lede {
  margin: clamp(22px, 2.4vw, 32px) 0 0;
  max-width: 34em;
  font-size: clamp(16px, 1.25vw, 18px);
  line-height: 1.7;
  color: var(--oc-mist);
}
.oc-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  margin-top: clamp(28px, 3vw, 40px);
}
.oc-btn {
  display: inline-block;
  padding: 15px 30px;
  background: var(--oc-gold);
  color: var(--oc-night);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  border-radius: 2px;
  transition: background-color .25s ease;
}
.oc-btn:hover { background: #D8BA82; }
.oc-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--oc-platinum);
  text-decoration: underline;
  text-decoration-color: var(--oc-gold-soft);
  text-underline-offset: 6px;
  transition: text-decoration-color .25s ease;
}
.oc-link:hover { text-decoration-color: var(--oc-gold); }
.oc-btn:focus-visible, .oc-link:focus-visible {
  outline: 2px solid var(--oc-platinum);
  outline-offset: 4px;
}

/* Video in an emerald-cut frame */
.oc-media { display: flex; justify-content: flex-end; }
.oc-frame {
  --cut: clamp(18px, 2.4vw, 34px);
  position: relative;
  width: 100%;
  max-width: 480px;
  aspect-ratio: 4 / 3.3;
  background-color: var(--oc-navy);
  padding: 1px;
  background: linear-gradient(140deg, var(--oc-gold), rgba(200,166,106,.25) 45%, var(--oc-gold));
  clip-path: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
}
.oc-video {
  display: block;
  background: #e9e9ea;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 40% 55%;
  clip-path: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
}

/* Fan of lines from the single source */
.oc-fan {
  position: relative;
  margin: clamp(56px, 7vw, 96px) auto 0;
  height: clamp(70px, 8vw, 110px);
}
.oc-source {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -100%);
  color: var(--oc-gold);
}
.oc-rays {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.oc-rays path {
  fill: none;
  stroke: var(--oc-gold);
  stroke-opacity: .55;
  stroke-width: 1;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 1.1s cubic-bezier(.3,0,.2,1);
}
.oc[data-revealed="true"] .oc-rays path { stroke-dashoffset: 0; }

/* The six parts of the business */
.oc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border-top: 1px solid var(--oc-gold-soft);
}
.oc-item {
  padding: 26px clamp(10px, 1.4vw, 22px) 6px;
  text-align: center;
  border-left: 1px solid rgba(200,166,106,.14);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity .7s ease, transform .7s ease;
}
.oc-item:first-child { border-left: 0; }
.oc[data-revealed="true"] .oc-item { opacity: 1; transform: none; }
.oc-icon { color: var(--oc-gold); display: block; margin: 0 auto 14px; }
.oc-item-name {
  margin: 0;
  min-height: 2.3em;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Cormorant Garamond", Georgia, serif;
  font-weight: 600;
  font-size: clamp(19px, 1.55vw, 23px);
  line-height: 1.15;
  color: var(--oc-platinum);
}
.oc-item-note {
  margin: 8px auto 0;
  max-width: 17em;
  font-size: 13px;
  line-height: 1.55;
  color: var(--oc-mist);
}

/* Tablet */
@media (max-width: 1023px) {
  .oc-top { grid-template-columns: 1fr; }
  .oc-media { justify-content: flex-start; }
  .oc-frame { max-width: 520px; }
  .oc-fan { display: none; }
  .oc-list {
    margin-top: 56px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .oc-item { border-left: 0; border-bottom: 1px solid rgba(200,166,106,.14); padding-bottom: 24px; }
}
/* Phone */
@media (max-width: 599px) {
  .oc-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .oc-item { padding-left: 8px; padding-right: 8px; }
}

/* Reduced motion: show everything in its final state */
@media (prefers-reduced-motion: reduce) {
  .oc-rays path { transition: none; stroke-dashoffset: 0; }
  .oc-item { transition: none; opacity: 1; transform: none; }
  .oc[data-revealed="true"] .oc-title-1 { animation: none; }
  .oc-title-1 { background: none; color: var(--oc-platinum); }
}
`;