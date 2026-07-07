"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────
interface HeroSlide {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  desktopImage: string;
  mobileImage?: string;
  accent?: string;
  accentGlow?: string;
  buttonText?: string;
  buttonLink?: string;
  openInNewTab?: boolean;
  displayOrder: number;
  isActive: boolean;
}

interface HeroCarouselProps {
  initialSlides?: HeroSlide[];
}

const AUTO_ROTATE_MS = 6000;

// ── Cloudinary URL optimiser ─────────────────────────────────────────────────
function optimiseCloudinaryUrl(src: string): string {
  if (!src) return src;
  if (!src.includes("res.cloudinary.com")) return src;
  if (src.includes("/upload/q_")) return src;
  return src.replace("/upload/", "/upload/q_100,f_auto/");
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function CarouselSkeleton() {
  return (
    <section className="relative w-full select-none" style={{ background: "#FBFBF9" }}>
      <div
        className="relative w-full overflow-hidden animate-pulse flex flex-col sm:flex-row"
        style={{ height: "var(--stage-h)", minHeight: 320 }}
      >
        <div className="w-full sm:w-[44%] h-full flex items-center" style={{ background: "#F1EFE8", paddingLeft: "clamp(24px,5vw,72px)" }}>
          <div className="flex flex-col gap-3">
            <div className="h-3 w-24 rounded-sm bg-black/10" />
            <div className="h-10 w-56 rounded-sm bg-black/10" />
            <div className="h-10 w-48 rounded-sm bg-black/10" />
            <div className="h-1 w-14 rounded-sm bg-black/10" />
            <div className="h-8 w-32 rounded-sm bg-black/10" />
          </div>
        </div>
        <div className="w-full sm:w-[56%] h-full bg-[#E7E4DB]" />
      </div>
    </section>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function CarouselEmpty() {
  return (
    <section
      className="relative w-full flex items-center justify-center select-none"
      style={{ background: "#FBFBF9", height: "var(--stage-h)", minHeight: 320 }}
    >
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <ImageOff size={32} strokeWidth={1} className="text-[#14171C]/25" />
        <p className="hc-mono" style={{ fontWeight: 500, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(20,23,28,0.4)" }}>
          Nothing here yet
        </p>
      </div>
    </section>
  );
}

// ── Main carousel ─────────────────────────────────────────────────────────────
export default function HeroCarousel({ initialSlides }: HeroCarouselProps) {
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides ?? []);
  const [loading, setLoading] = useState(!initialSlides);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (initialSlides) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch("/api/hero-slides")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setSlides(json.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialSlides]);

  const go = useCallback((index: number) => setCurrent((index + slides.length) % slides.length), [slides.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const id = setInterval(next, AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [isPaused, next, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev, slides.length]);

  // Preload next slide image
  useEffect(() => {
    if (slides.length <= 1) return;
    const nextIndex = (current + 1) % slides.length;
    const nextSlide = slides[nextIndex];
    if (!nextSlide) return;
    const url = optimiseCloudinaryUrl(nextSlide.desktopImage);
    const img = new Image();
    img.src = url;
  }, [current, slides]);

  // Gentle parallax drift on the product image — a soft, controlled pan,
  // not a gimmick. Skipped on touch devices.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || isMobile) return;
    const isFine = window.matchMedia("(pointer: fine)").matches;
    if (!isFine) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      if (imageRef.current) {
        imageRef.current.style.transform = `scale(1.05) translate(${-nx * 10}px, ${-ny * 8}px)`;
      }
    };
    const handleLeave = () => {
      if (imageRef.current) imageRef.current.style.transform = "scale(1.03) translate(0,0)";
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [isMobile, current]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
    touchStartY.current = e.changedTouches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44) dx < 0 ? next() : prev();
  };

  if (loading) return <CarouselSkeleton />;
  if (error || slides.length === 0) return <CarouselEmpty />;

  const b = slides[current];
  const signal = b.accent || "#2F5DFF";
  const sand = b.accentGlow || "#F1EFE8";

  const desktopSrc = optimiseCloudinaryUrl(b.desktopImage);
  const mobileSrc = b.mobileImage ? optimiseCloudinaryUrl(b.mobileImage) : desktopSrc;
  const bgImage = isMobile ? mobileSrc : desktopSrc;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap');
        .hc-display, .hc-body, .hc-mono { font-family: "Elms Sans", sans-serif; }
        :root { --stage-h: 62svh; }
        @media (min-width: 640px) { :root { --stage-h: 78vh; } }
        @keyframes hc-rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hc-tag-in {
          from { opacity: 0; transform: rotate(-9deg) translateY(14px) scale(0.94); }
          to   { opacity: 1; transform: rotate(-6deg) translateY(0) scale(1); }
        }
        @keyframes hc-swing {
          0%, 100% { transform: rotate(-6deg); }
          50%      { transform: rotate(-3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hc-swing, [style*="hc-rise"], [style*="hc-tag-in"] { animation: none !important; }
        }
      `}</style>

      <section className="relative w-full select-none" aria-label="Featured products" aria-roledescription="carousel" style={{ background: "#ffffff" }}>
        <div
          ref={stageRef}
          className="relative w-full overflow-hidden flex flex-col sm:flex-row"
          style={{ height: "var(--stage-h)", minHeight: 320 }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full flex flex-col sm:flex-row"
              aria-roledescription="slide"
              aria-label={`Product ${current + 1} of ${slides.length}`}
            >
              {/* ── Text column — bright paper ground ── */}
              <div className="relative w-full sm:w-[44%] h-auto sm:h-full flex items-center order-2 sm:order-1" style={{ background: "#FBFBF9" }}>
                <div
                  className="flex flex-col"
                  style={{
                    paddingLeft: "clamp(24px, 5vw, 72px)",
                    paddingRight: "clamp(20px, 3vw, 48px)",
                    paddingTop: "clamp(28px, 3vh, 40px)",
                    paddingBottom: "clamp(28px, 3vh, 40px)",
                    maxWidth: 460,
                  }}
                >
                  {b.subtitle && (
                    <div className="flex items-center gap-3 mb-4" style={{ opacity: 0, animation: "hc-rise 0.7s cubic-bezier(.16,1,.3,1) 0.05s forwards" }}>
                      <span
                        className="hc-mono"
                        style={{
                          fontWeight: 500,
                          fontSize: 11,
                          letterSpacing: "0.24em",
                          textTransform: "uppercase",
                          color: signal,
                          padding: "3px 9px",
                          border: `1px solid ${signal}40`,
                          background: `${signal}0d`,
                        }}
                      >
                        {b.subtitle}
                      </span>
                    </div>
                  )}

                  <h2
                    className="hc-display"
                    style={{
                      color: "#14171C",
                      fontWeight: 600,
                      fontSize: "clamp(32px, 3.6vw, 58px)",
                      lineHeight: 1.05,
                      letterSpacing: "-0.02em",
                      margin: 0,
                      opacity: 0,
                      animation: "hc-rise 0.8s cubic-bezier(.16,1,.3,1) 0.15s forwards",
                    }}
                  >
                    {b.title}
                  </h2>

                  {b.description && (
                    <p
                      className="hc-body"
                      style={{
                        fontWeight: 400,
                        fontSize: "clamp(14px, 1.05vw, 16.5px)",
                        lineHeight: 1.7,
                        color: "rgba(20,23,28,0.62)",
                        marginTop: "clamp(14px, 2vh, 22px)",
                        marginBottom: "clamp(18px, 2.5vh, 30px)",
                        maxWidth: 380,
                        opacity: 0,
                        animation: "hc-rise 0.8s cubic-bezier(.16,1,.3,1) 0.28s forwards",
                      }}
                    >
                      {b.description}
                    </p>
                  )}

                  {!b.description && (
                    <div
                      style={{
                        width: 40,
                        height: 2,
                        background: signal,
                        marginTop: "clamp(14px, 2vh, 22px)",
                        marginBottom: "clamp(18px, 2.5vh, 30px)",
                        opacity: 0,
                        animation: "hc-rise 0.8s cubic-bezier(.16,1,.3,1) 0.28s forwards",
                      }}
                    />
                  )}

                  {b.buttonText && b.buttonLink && (
                    <div style={{ opacity: 0, animation: "hc-rise 0.8s cubic-bezier(.16,1,.3,1) 0.4s forwards" }}>
                      <a
                        href={b.buttonLink}
                        target={b.openInNewTab ? "_blank" : undefined}
                        rel={b.openInNewTab ? "noopener noreferrer" : undefined}
                        className="hc-body group inline-flex items-center gap-2"
                        style={{
                          fontWeight: 600,
                          fontSize: "clamp(13px, 0.95vw, 14px)",
                          color: "#FBFBF9",
                          textDecoration: "none",
                          padding: "12px 22px",
                          background: signal,
                          transition: "transform 0.25s ease, box-shadow 0.25s ease",
                          boxShadow: `0 6px 20px ${signal}40`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                        }}
                      >
                        {b.buttonText}
                        <ChevronRight size={14} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-1" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Product image ── */}
              <div className="relative w-full sm:w-[56%] h-[46vh] sm:h-full order-1 sm:order-2 overflow-hidden" style={{ background: sand }}>
                <div
                  ref={imageRef}
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    transform: "scale(1.03)",
                    transition: "transform 0.6s cubic-bezier(.16,1,.3,1)",
                  }}
                />

                
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ── Arrows ── */}
          {slides.length > 1 &&
            (["prev", "next"] as const).map((dir) => (
              <button
                key={dir}
                onClick={dir === "prev" ? prev : next}
                aria-label={dir === "prev" ? "Previous product" : "Next product"}
                className="hidden sm:flex absolute top-1/2 -translate-y-1/2 z-30 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5DFF]"
                style={{
                  [dir === "prev" ? "left" : "right"]: "clamp(12px, 2.5vw, 32px)",
                  width: "clamp(38px, 3vw, 46px)",
                  height: "clamp(38px, 3vw, 46px)",
                  background: "rgba(251,251,249,0.9)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(20,23,28,0.1)",
                  boxShadow: "0 4px 16px rgba(20,23,28,0.1)",
                  color: "#14171C",
                  transition: "all 0.25s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "#14171C";
                  el.style.color = "#FBFBF9";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(251,251,249,0.9)";
                  el.style.color = "#14171C";
                }}
              >
                {dir === "prev" ? <ChevronLeft size={16} strokeWidth={2} /> : <ChevronRight size={16} strokeWidth={2} />}
              </button>
            ))}

          {/* ── Vertical tick nav ── */}
          {slides.length > 1 && (
            <div className="absolute right-5 bottom-16 z-30 hidden sm:flex flex-col items-center gap-[10px]">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`View product ${i + 1}`}
                  style={{
                    width: 2,
                    height: i === current ? 30 : 10,
                    background: i === current ? "#14171C" : "rgba(20,23,28,0.22)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 0.4s ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Progress bar ── */}
        {slides.length > 1 && (
          <div className="relative w-full overflow-hidden" style={{ height: 2, background: "rgba(20,23,28,0.08)" }}>
            {!isPaused && (
              <motion.div
                key={`progress-${current}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: AUTO_ROTATE_MS / 1000, ease: "linear" }}
                className="absolute inset-0 origin-left"
                style={{ background: signal }}
              />
            )}
          </div>
        )}

        {/* ── Dot nav — mobile ── */}
        {slides.length > 1 && (
          <div className="flex sm:hidden items-center justify-center gap-[10px] py-3" style={{ background: "#FBFBF9" }} role="tablist" aria-label="Product navigation">
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`View product ${i + 1}`}
                onClick={() => go(i)}
                className="focus:outline-none"
                style={{
                  height: 2,
                  width: i === current ? 26 : 8,
                  background: i === current ? "#14171C" : "rgba(20,23,28,0.2)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.4s ease",
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}