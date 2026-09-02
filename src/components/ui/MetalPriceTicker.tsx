'use client';

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

// ─── Design tokens (matches GemsPromise.tsx / TrustBadges.tsx) ────────────
const paper = "#FAFAF7";
const ink = "#161A21";
const inkSoft = "#5B6472";
const inkFaint = "#8B8F96";
const hairline = "#E3E0D6";
const brass = "#8A6A2E";

interface ChartPoint {
  i: number;
  v: number;
}

interface LivePriceState {
  series: number[];
  current: number;
  change: number;
  changePct: string;
}

function seedSeries(base: number, points = 32): number[] {
  const arr: number[] = [base];
  for (let i = 1; i < points; i++) {
    const drift = (Math.random() - 0.52) * (base * 0.0009);
    arr.push(+(arr[i - 1] + drift).toFixed(2));
  }
  return arr;
}

function useLivePrice(basePrice: number): LivePriceState {
  const [series, setSeries] = useState<number[]>(() => seedSeries(basePrice));
  const openRef = useRef<number>(series[0]);

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const step = (Math.random() - 0.5) * (basePrice * 0.0015);
        const next = +(last + step).toFixed(2);
        return [...prev.slice(1), next];
      });
    }, 2200);
    return () => clearInterval(id);
  }, [basePrice]);

  const current = series[series.length - 1];
  const change = +(current - openRef.current).toFixed(2);
  const changePct = ((change / openRef.current) * 100).toFixed(2);

  return { series, current, change, changePct };
}

function CornerMark({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: -1, left: -1, borderRight: "none", borderBottom: "none" },
    tr: { top: -1, right: -1, borderLeft: "none", borderBottom: "none" },
    bl: { bottom: -1, left: -1, borderRight: "none", borderTop: "none" },
    br: { bottom: -1, right: -1, borderLeft: "none", borderTop: "none" },
  };
  return (
    <div
      className="absolute w-[14px] h-[14px] pointer-events-none"
      style={{ border: `1px solid ${brass}`, opacity: 0.55, ...styles[position] }}
    />
  );
}

interface MetalCellProps {
  index: number;
  label: string;
  reportCode: string;
  unit: string;
  basePrice: number;
  accent: string;
  ctaHref: string;
}

function MetalCell({ index, label, reportCode, unit, basePrice, accent, ctaHref }: MetalCellProps) {
  const { series, current, change, changePct } = useLivePrice(basePrice);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevCurrent = useRef(current);
  const isUp = change >= 0;
  const chartData: ChartPoint[] = series.map((v, i) => ({ i, v }));

  useEffect(() => {
    if (current !== prevCurrent.current) {
      setFlash(current > prevCurrent.current ? "up" : "down");
      prevCurrent.current = current;
      const t = setTimeout(() => setFlash(null), 500);
      return () => clearTimeout(t);
    }
  }, [current]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className="relative px-6 sm:px-9 md:px-11 py-8 sm:py-10"
    >
      {/* report tag */}
      <div className="flex items-center justify-between mb-6">
        <span
          className="text-[10px] tracking-[0.28em] uppercase"
          style={{ fontFamily: '"Elms Sans", sans-serif', color: brass, fontWeight: 500 }}
        >
          {reportCode}
        </span>
        <span
          className="inline-flex items-center gap-[6px] text-[10px] tracking-[0.2em] uppercase"
          style={{ fontFamily: '"Elms Sans", sans-serif', color: inkFaint, fontWeight: 500 }}
        >
          <span className="relative w-[6px] h-[6px] rounded-full" style={{ background: "#3F7A4D" }}>
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: "#3F7A4D", animation: "metalTickerPulse 1.8s ease-out infinite" }}
            />
          </span>
          Live
        </span>
      </div>

      {/* name + unit */}
      <div className="flex items-baseline justify-between mb-1">
        <h3
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            fontSize: "clamp(22px, 2.4vw, 28px)",
            fontWeight: 500,
            color: ink,
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </h3>
        <span
          className="text-[11px]"
          style={{ fontFamily: '"Elms Sans", sans-serif', color: inkFaint, fontWeight: 500 }}
        >
          {unit}
        </span>
      </div>

      {/* price */}
      <div className="flex items-center gap-3 mt-4 mb-1 flex-wrap">
        <span
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            fontSize: "clamp(30px, 4vw, 40px)",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            color: flash === "up" ? "#3F7A4D" : flash === "down" ? "#A6392F" : ink,
            transition: "color 0.4s ease",
          }}
        >
          ${current.toFixed(2)}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-[3px] rounded-full"
          style={{
            fontFamily: '"Elms Sans", sans-serif',
            color: isUp ? "#2E5C3A" : "#8A2E24",
            background: isUp ? "rgba(63,122,77,0.1)" : "rgba(166,57,47,0.1)",
          }}
        >
          {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)} ({changePct}%)
        </span>
      </div>

      {/* sparkline */}
      <div className="h-[64px] -mx-1 my-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area
              type="monotone"
              dataKey="v"
              stroke={accent}
              strokeWidth={1.75}
              fill={`url(#fill-${label})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <a
        href={ctaHref}
        className="inline-flex items-center gap-2 text-[13px] group"
        style={{ fontFamily: '"Elms Sans", sans-serif', color: ink, fontWeight: 500 }}
      >
        <span style={{ borderBottom: `1px solid ${brass}`, paddingBottom: 1 }}>
          Shop {label.toLowerCase()} jewelry
        </span>
        <span className="transition-transform duration-200 group-hover:translate-x-1" style={{ color: brass }}>
          →
        </span>
      </a>
    </motion.div>
  );
}

export default function MetalPriceTicker() {
  const headingRef = useRef(null);
  const isHeadingInView = useInView(headingRef, { once: true, margin: "-80px" });

  const metals: Omit<MetalCellProps, "index">[] = [
    {
      label: "Gold",
      reportCode: "MR–01",
      unit: "USD / troy oz",
      basePrice: 4312.91,
      accent: "#B48A3F",
      ctaHref: "/collections/gold",
    },
    {
      label: "Silver",
      reportCode: "MR–02",
      unit: "USD / troy oz",
      basePrice: 63.93,
      accent: "#6E7C8C",
      ctaHref: "/collections/silver",
    },
  ];

  return (
    <section className="relative w-full" style={{ background: paper }}>
      <style>{`
        @keyframes metalTickerPulse {
          0% { transform: scale(1); opacity: 0.7; }
          70% { transform: scale(2.6); opacity: 0; }
          100% { transform: scale(2.6); opacity: 0; }
        }
      `}</style>

      <div className="relative w-full px-6 sm:px-10 md:px-14 lg:px-20 py-16 sm:py-20 md:py-24">
        {/* ── HEADER (matches GemsPromise heading pattern) ── */}
        <div ref={headingRef} className="mb-10 sm:mb-14 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={isHeadingInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex items-center gap-3 mb-5"
          >
            <div className="w-6 h-px" style={{ background: brass, opacity: 0.6 }} />
            <span
              className="text-[10px] tracking-[0.30em] uppercase"
              style={{ fontFamily: '"Elms Sans", sans-serif', color: brass, fontWeight: 500 }}
            >
              Market Report
            </span>
          </motion.div>

          <div className="overflow-hidden mb-4">
            <motion.h2
              initial={{ y: "105%" }}
              animate={isHeadingInView ? { y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: '"Elms Sans", sans-serif',
                fontSize: "clamp(30px, 4.4vw, 48px)",
                lineHeight: 1.08,
                fontWeight: 500,
                color: ink,
                letterSpacing: "-0.015em",
              }}
            >
              Today's{" "}
              <em style={{ fontStyle: "italic", color: brass, fontWeight: 500 }}>
                gold &amp; silver
              </em>{" "}
              rates
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={isHeadingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.28, ease: "easeOut" }}
            style={{
              fontFamily: '"Elms Sans", sans-serif',
              fontSize: "14px",
              lineHeight: 1.75,
              fontWeight: 400,
              color: inkSoft,
            }}
          >
            While spot price keeps climbing, alpha keeps it low. Compare today's
            live gold and silver price against our jewelry — in many cases
            we're priced well under the metal itself.
          </motion.p>
        </div>

        {/* ── LIVE RATES GRID (framed like a document, matching GemsPromise) ── */}
        <div className="relative">
          <CornerMark position="tl" />
          <CornerMark position="tr" />
          <CornerMark position="bl" />
          <CornerMark position="br" />
          <div
            className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E3E0D6]"
            style={{ border: `1px solid ${hairline}` }}
          >
            {metals.map((metal, index) => (
              <MetalCell key={metal.label} index={index} {...metal} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}