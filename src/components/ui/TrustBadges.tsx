"use client";
import { useState } from "react";
import { View, BadgeCheck, ShieldCheck, BadgeDollarSign, Award } from "lucide-react";

const badges = [
  { icon: View,            label: "View Gems in 360°",    sub: "Immersive Preview" },
  { icon: BadgeCheck,      label: "All Gems Certified",   sub: "GIA · IGI · AGS" },
  { icon: ShieldCheck,     label: "100% Conflict Free",   sub: "Ethically Sourced" },
  { icon: BadgeDollarSign, label: "Best Price Guarantee", sub: "Price Match Promise" },
  { icon: Award,           label: "Lifetime Warranty",    sub: "Always Protected" },
];

const HEX = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

export default function TrustBadges() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section style={{ position: "relative", overflow: "hidden", background: "#09111f" }}>

      {/* ── Ambient background ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 60% 80% at 10% 50%, rgba(200,169,110,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 60% 80% at 90% 50%, rgba(26,42,94,0.5) 0%, transparent 60%)
        `,
      }} />

      {/* Top ornamental rule */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent 0%, #c8a96e 20%, #f0d898 50%, #c8a96e 80%, transparent 100%)",
      }} />

      {/* Bottom ornamental rule */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent 0%, #c8a96e 20%, #f0d898 50%, #c8a96e 80%, transparent 100%)",
      }} />

      {/* ── DESKTOP ── */}
      <div className="trust-desktop" style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 40px", display: "flex", alignItems: "stretch", justifyContent: "center", gap: 0 }}>

        {badges.map(({ icon: Icon, label, sub }, idx) => {
          const isActive = active === idx;
          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", flex: 1 }}>

              {/* Ornamental diamond divider */}
              {idx !== 0 && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 4px" }}>
                  <div style={{ width: 1, height: 28, background: "linear-gradient(to bottom, transparent, rgba(200,169,110,0.35))" }} />
                  <div style={{
                    width: 6, height: 6, background: "#c8a96e",
                    transform: "rotate(45deg)",
                    boxShadow: "0 0 6px rgba(200,169,110,0.6)",
                  }} />
                  <div style={{ width: 1, height: 28, background: "linear-gradient(to bottom, rgba(200,169,110,0.35), transparent)" }} />
                </div>
              )}

              {/* Badge card */}
              <div
                onMouseEnter={() => setActive(idx)}
                onMouseLeave={() => setActive(null)}
                style={{
                  flex: 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                  padding: "28px 12px",
                  cursor: "default",
                  position: "relative",
                  transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                  transform: isActive ? "translateY(-4px)" : "translateY(0)",
                }}
              >
                {/* Hover glow */}
                <div style={{
                  position: "absolute", inset: "10px 0",
                  background: isActive ? "radial-gradient(ellipse at center, rgba(200,169,110,0.09) 0%, transparent 70%)" : "transparent",
                  transition: "background 0.5s ease",
                  borderRadius: 4,
                }} />

                {/* Gem-cut hexagon medallion */}
                <div style={{ position: "relative", width: 80, height: 80 }}>
                  <div style={{
                    position: "absolute", inset: -5, clipPath: HEX,
                    background: isActive
                      ? "linear-gradient(135deg, #f0d898 0%, #c8a96e 40%, #8b6914 60%, #c8a96e 80%, #f0d898 100%)"
                      : "linear-gradient(135deg, rgba(200,169,110,0.5) 0%, rgba(120,90,30,0.3) 50%, rgba(200,169,110,0.5) 100%)",
                    transition: "background 0.4s ease",
                    animation: isActive ? "hexSpin 8s linear infinite" : "none",
                  }} />
                  <div style={{
                    position: "absolute", inset: 2, clipPath: HEX,
                    background: isActive
                      ? "linear-gradient(145deg, #111d30 0%, #0d1625 100%)"
                      : "linear-gradient(145deg, #0f1b2d 0%, #09111f 100%)",
                    transition: "background 0.4s ease",
                  }} />
                  <div style={{
                    position: "absolute", inset: 2, clipPath: HEX,
                    background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
                  }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{
                      width: 28, height: 28,
                      color: isActive ? "#f0d898" : "#8fa8cc",
                      transition: "color 0.35s ease, transform 0.35s ease",
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                      strokeWidth: 1.3,
                    }} />
                  </div>
                </div>

                {/* Label */}
                <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                  <p style={{
                    fontFamily: '"Google Sans Flex", sans-serif',
                    fontSize: 13, fontWeight: 600, letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: isActive ? "#f0d898" : "#a8bcd4",
                    transition: "color 0.35s ease",
                    marginBottom: 4, lineHeight: 1.4,
                  }}>
                    {label}
                  </p>
                  <p style={{
                    fontFamily: '"Google Sans Flex", sans-serif',
                    fontSize: 10, letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: isActive ? "rgba(200,169,110,0.8)" : "rgba(100,120,150,0.6)",
                    transition: "color 0.35s ease",
                  }}>
                    {sub}
                  </p>
                  <div style={{
                    marginTop: 8, height: 1,
                    background: "linear-gradient(90deg, transparent, #c8a96e, transparent)",
                    transform: isActive ? "scaleX(1)" : "scaleX(0)",
                    transition: "transform 0.4s ease",
                    transformOrigin: "center",
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MOBILE marquee ── */}
      <div className="trust-mobile" style={{ position: "relative", padding: "32px 0" }}>
        {/* Fade edges */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 48, zIndex: 10, background: "linear-gradient(to right, #09111f, transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, zIndex: 10, background: "linear-gradient(to left, #09111f, transparent)", pointerEvents: "none" }} />

        <div className="marquee-track">
          {[...badges, ...badges].map(({ icon: Icon, label, sub }, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                width: 130,
                flexShrink: 0,
                padding: "0 16px",
              }}
            >
              {/* Mini hex medallion */}
              <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                <div style={{
                  position: "absolute", inset: -3, clipPath: HEX,
                  background: "linear-gradient(135deg, #c8a96e 0%, #8b6914 50%, #c8a96e 100%)",
                }} />
                <div style={{
                  position: "absolute", inset: 1, clipPath: HEX,
                  background: "linear-gradient(145deg, #111d30 0%, #09111f 100%)",
                }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon style={{ width: 20, height: 20, color: "#c8a96e", strokeWidth: 1.3 }} />
                </div>
              </div>

              <p style={{
                fontFamily: '"Google Sans Flex", sans-serif',
                fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#8fa8cc",
                textAlign: "center", lineHeight: 1.4,
                whiteSpace: "normal",
                width: 98,
              }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap');

        @keyframes hexSpin {
          0%   { filter: hue-rotate(0deg) brightness(1); }
          50%  { filter: hue-rotate(15deg) brightness(1.2); }
          100% { filter: hue-rotate(0deg) brightness(1); }
        }

        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .marquee-track {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          width: max-content;
          animation: marquee 24s linear infinite;
          will-change: transform;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }

        .trust-desktop { display: flex; }
        .trust-mobile  { display: none; }

        @media (max-width: 767px) {
          .trust-desktop { display: none !important; }
          .trust-mobile  { display: block; overflow: hidden; }
        }
      `}</style>
    </section>
  );
}