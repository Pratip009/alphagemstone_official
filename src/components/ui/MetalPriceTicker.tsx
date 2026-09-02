'use client';

import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

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

interface MetalCardProps {
  label: string;
  unit: string;
  basePrice: number;
  bg: string;
  ink: string;
  chartLine: string;
  chartFill: string;
  ctaHref: string;
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

function MetalCard({
  label,
  unit,
  basePrice,
  bg,
  ink,
  chartLine,
  chartFill,
  ctaHref,
}: MetalCardProps) {
  const { series, current, change, changePct } = useLivePrice(basePrice);
  const isUp = change >= 0;
  const chartData: ChartPoint[] = series.map((v, i) => ({ i, v }));

  return (
    <div
      style={{
        flex: "0 1 220px",
        minWidth: 200,
        maxWidth: 240,
        background: bg,
        color: ink,
        borderRadius: 20,
        padding: "20px 20px 16px",
        fontFamily: "Elms Sans",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 800 }}>{label}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            background: "rgba(0,0,0,0.06)",
            padding: "3px 8px",
            borderRadius: 999,
          }}
        >
          {unit}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12 }}>
        <span
          style={{
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${current.toFixed(2)}
        </span>
      </div>

      <div style={{ marginTop: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 700,
            background: isUp ? "#16A34A" : "#F43F5E",
            color: "#FFFFFF",
            padding: "4px 10px",
            borderRadius: 999,
          }}
        >
          {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)} ({changePct}%)
        </span>
      </div>

      <div style={{ height: 56, margin: "14px -4px 4px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <defs>
              <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartFill} stopOpacity={0.55} />
                <stop offset="100%" stopColor={chartFill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area
              type="monotone"
              dataKey="v"
              stroke={chartLine}
              strokeWidth={2.5}
              fill={`url(#fill-${label})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <a
        href={ctaHref}
        style={{
          display: "inline-block",
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          color: ink,
          textDecoration: "none",
          borderBottom: `2px solid ${ink}`,
          paddingBottom: 1,
        }}
      >
        Shop {label.toLowerCase()} jewelry →
      </a>
    </div>
  );
}

export default function MetalPriceTicker() {
  return (
    <div
      style={{
        width: "100%",
        padding: "40px 24px",
        background: "#FFFFFF",
        fontFamily: "Elms Sans",
      }}
    >
      <h2
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: "#151417",
          margin: "0 0 10px",
        }}
      >
        Today's gold and silver prices
      </h2>
      <p
        style={{
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.6,
          color: "#4A463D",
          margin: "0 0 24px",
          width: "100%",
        }}
      >
        While gold and silver price is rising, alpha keeps it low. Check today's
        gold and silver price and compare it to our products — in many cases
        our jewelry is way below actual gold or silver price.
      </p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <MetalCard
          label="Gold"
          unit="USD / oz"
          basePrice={4312.91}
          bg="#FDF1DD"
          ink="#8A5A16"
          chartLine="#D18A2E"
          chartFill="#D18A2E"
          ctaHref="/collections/gold"
        />
        <MetalCard
          label="Silver"
          unit="USD / oz"
          basePrice={63.93}
          bg="#EEF1F4"
          ink="#3D4A5C"
          chartLine="#7C8798"
          chartFill="#7C8798"
          ctaHref="/collections/silver"
        />
      </div>
    </div>
  );
}