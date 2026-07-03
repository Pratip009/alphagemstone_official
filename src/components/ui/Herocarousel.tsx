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
// Only injects quality + format — NO width resize — so the original resolution
// is preserved. f_auto picks the best format (WebP/AVIF) for the browser.
function optimiseCloudinaryUrl(src: string): string {
  if (!src) return src;
  if (!src.includes("res.cloudinary.com")) return src;
  // Avoid double-injecting if a transform is already present
  if (src.includes("/upload/q_")) return src;
  return src.replace("/upload/", "/upload/q_100,f_auto/");
}

// ── Typewriter hook ───────────────────────────────────────────────────────────
function useTypewriter(text: string): string {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    // 520ms pause after slide transition before typing begins
    const delayId = setTimeout(() => {
      let i = 0;
      intervalId = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length && intervalId) clearInterval(intervalId);
      }, 62); // ~62ms per character
    }, 520);

    return () => {
      clearTimeout(delayId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text]);

  return displayed;
}

// ── Diamond-shaped sparkle ────────────────────────────────────────────────────
function DiamondIcon({ accent, size = 10 }: { accent: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect
        x="6" y="0.5"
        width="7.5" height="7.5"
        transform="rotate(45 6 6)"
        fill={accent}
        fillOpacity="0.85"
      />
    </svg>
  );
}

// ── Scanline texture overlay ──────────────────────────────────────────────────
function Scanlines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
        mixBlendMode: "multiply",
      }}
    />
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function CarouselSkeleton() {
  return (
    <section
      className="relative w-full select-none"
      style={{ background: "#04080c" }}
    >
      <div
        className="relative w-full overflow-hidden animate-pulse"
        style={{ height: "var(--carousel-h)", minHeight: 280 }}
      >
        <div className="absolute inset-0 bg-[#0d1620]" />
        <div className="absolute inset-0 flex items-center" style={{ paddingLeft: "clamp(24px,7vw,140px)" }}>
          <div className="flex flex-col gap-3">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-10 w-56 rounded bg-white/10" />
            <div className="h-10 w-48 rounded bg-white/10" />
            <div className="h-1 w-14 rounded bg-white/10" />
            <div className="h-8 w-32 rounded bg-white/10" />
          </div>
        </div>
      </div>
      <div className="h-px w-full bg-white/5" />
    </section>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function CarouselEmpty() {
  return (
    <section
      className="relative w-full flex items-center justify-center select-none"
      style={{ background: "#04080c", height: "var(--carousel-h)", minHeight: 280 }}
    >
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <ImageOff size={36} strokeWidth={1} className="text-white/20" />
        <p className="text-white/30 text-sm tracking-widest uppercase font-light">
          No slides available
        </p>
      </div>
    </section>
  );
}

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const stagger = (i: number) => ({
  hidden: { opacity: 0, x: -18, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { delay: 0.08 + i * 0.12, duration: 0.7, ease: EASE },
  },
});

// ── Typewriter title component ────────────────────────────────────────────────
function TypewriterTitle({
  text,
  accentGlow,
  slideKey,
}: {
  text: string;
  accentGlow: string;
  slideKey: number;
}) {
  // Re-mount on slide change so animation restarts
  const displayed = useTypewriter(text);

  return (
    <motion.h2
      key={`${slideKey}-title`}
      variants={stagger(1)}
      initial="hidden"
      animate="visible"
      className="hero-display text-white"
      style={{
        // ← Smaller than before: was clamp(28px, 5.8vw, 92px)
        fontSize: "clamp(22px, 4.2vw, 68px)",
        fontWeight: 300,
        lineHeight: 0.95,
        letterSpacing: "-0.01em",
        textShadow: `0 0 80px ${accentGlow}40, 0 4px 40px rgba(0,0,0,0.6)`,
        margin: 0,
      }}
    >
      {displayed}
      {/* Blinking cursor while typing */}
      {displayed.length < text.length && (
        <span
          style={{
            display: "inline-block",
            width: "2px",
            height: "0.85em",
            background: "rgba(255,255,255,0.6)",
            marginLeft: "2px",
            verticalAlign: "middle",
            animation: "tw-blink 0.6s step-end infinite",
          }}
        />
      )}
    </motion.h2>
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
    return () => { cancelled = true; };
  }, [initialSlides]);

  const go = useCallback(
    (index: number) => setCurrent((index + slides.length) % slides.length),
    [slides.length]
  );
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % slides.length),
    [slides.length]
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + slides.length) % slides.length),
    [slides.length]
  );

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
  const accent = b.accent || "#b8c9d4";
  const accentGlow = b.accentGlow || "#5a8fa8";

  // Full quality — no width downscaling, just format optimisation
  const desktopSrc = optimiseCloudinaryUrl(b.desktopImage);
  const mobileSrc  = b.mobileImage
    ? optimiseCloudinaryUrl(b.mobileImage)
    : desktopSrc;
  const bgImage = isMobile ? mobileSrc : desktopSrc;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap');
        .hero-display { font-family: "Google Sans Flex", sans-serif; }
        .hero-label   { font-family: "Google Sans Flex", sans-serif; font-weight: 300; }
        :root { --carousel-h: 42svh; }
        @media (min-width: 640px) { :root { --carousel-h: 70vh; } }
        @keyframes tw-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <section
        className="relative w-full select-none"
        style={{ background: "#04080c" }}
        aria-label="Promotional banners"
        aria-roledescription="carousel"
      >
        {/* ── Stage ── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: "var(--carousel-h)", minHeight: 280 }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={current}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full"
              aria-roledescription="slide"
              aria-label={`Slide ${current + 1} of ${slides.length}`}
            >
              {/* Background photo — original quality, no width downscale */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bgImage}
                srcSet={
                  b.mobileImage
                    ? `${mobileSrc} 768w, ${desktopSrc} 3840w`
                    : `${desktopSrc} 3840w`
                }
                sizes="100vw"
                alt=""
                aria-hidden="true"
                loading={current === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={current === 0 ? "high" : "auto"}
                onError={(e) => {
                  if (isMobile && b.mobileImage && bgImage !== desktopSrc) {
                    (e.currentTarget as HTMLImageElement).src = desktopSrc;
                  }
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 40%",
                  display: "block",
                }}
                draggable={false}
              />

              <Scanlines />

              {/* Dark gradient overlay */}
              <div
                className="absolute inset-0 z-10"
                style={{
                  background:
                    "linear-gradient(to right, rgba(4,8,12,0.72) 0%, rgba(4,8,12,0.35) 55%, rgba(4,8,12,0.05) 100%)",
                }}
              />

              {/* ── Text block ── */}
              <div className="absolute inset-0 flex items-center z-20">
                <div
                  className="flex flex-col"
                  style={{
                    paddingLeft: "clamp(24px, 7vw, 140px)",
                    paddingRight: "clamp(20px, 4vw, 60px)",
                    maxWidth: "clamp(260px, 60vw, 600px)",
                  }}
                >
                  {/* Eyebrow */}
                  {b.subtitle && (
                    <motion.div
                      key={`${current}-eyebrow`}
                      variants={stagger(0)}
                      initial="hidden"
                      animate="visible"
                      className="flex items-center gap-3 mb-3 sm:mb-5"
                    >
                      <DiamondIcon accent={accent} size={7} />
                      <span
                        className="hero-label"
                        style={{
                          fontSize: "clamp(8px, 0.9vw, 10px)",
                          letterSpacing: "0.38em",
                          textTransform: "uppercase",
                          color: accent,
                          opacity: 0.9,
                        }}
                      >
                        {b.subtitle}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          maxWidth: 48,
                          background: `linear-gradient(to right, ${accent}66, transparent)`,
                        }}
                      />
                    </motion.div>
                  )}

                  {/* ── Typewriter headline ── */}
                  <TypewriterTitle
                    text={b.title}
                    accentGlow={accentGlow}
                    slideKey={current}
                  />

                  {/* Description */}
                  {b.description && (
                    <motion.p
                      key={`${current}-desc`}
                      variants={stagger(2)}
                      initial="hidden"
                      animate="visible"
                      className="hero-label text-white/60"
                      style={{
                        fontSize: "clamp(11px, 1.1vw, 14px)",
                        lineHeight: 1.6,
                        marginTop: "clamp(10px, 1.5vh, 18px)",
                        marginBottom: "clamp(12px, 2vh, 24px)",
                        maxWidth: 380,
                        fontWeight: 300,
                      }}
                    >
                      {b.description}
                    </motion.p>
                  )}

                  {/* Divider */}
                  {!b.description && (
                    <motion.div
                      key={`${current}-rule`}
                      variants={stagger(2)}
                      initial="hidden"
                      animate="visible"
                      style={{
                        width: 56,
                        height: 1,
                        background: `linear-gradient(to right, ${accent}cc, transparent)`,
                        marginTop: "clamp(10px, 1.5vh, 18px)",
                        marginBottom: "clamp(12px, 2.5vh, 28px)",
                      }}
                    />
                  )}

                  {/* CTA button */}
                  {b.buttonText && b.buttonLink && (
                    <motion.div
                      key={`${current}-cta`}
                      variants={stagger(3)}
                      initial="hidden"
                      animate="visible"
                      className="flex items-center gap-5 flex-wrap"
                    >
                      <a
                        href={b.buttonLink}
                        target={b.openInNewTab ? "_blank" : undefined}
                        rel={b.openInNewTab ? "noopener noreferrer" : undefined}
                        className="hero-label group inline-flex items-center gap-2"
                        style={{
                          fontSize: "clamp(8px, 0.95vw, 10px)",
                          letterSpacing: "0.1em",
                          
                          color: "rgba(255,255,255,0.7)",
                          textDecoration: "none",
                          border: `1px solid ${accent}66`,
                          padding: "6px 18px",
                          background: `${accentGlow}10`,
                          transition: "all 0.3s",
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLAnchorElement;
                          el.style.color = accent;
                          el.style.borderColor = `${accent}99`;
                          el.style.background = `${accentGlow}22`;
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLAnchorElement;
                          el.style.color = "rgba(255,255,255,0.7)";
                          el.style.borderColor = `${accent}66`;
                          el.style.background = `${accentGlow}10`;
                        }}
                      >
                        {b.buttonText}
                        <ChevronRight
                          size={10}
                          strokeWidth={1.5}
                          className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </a>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ── Slide counter top-right ── */}
          {slides.length > 1 && (
            <div
              className="absolute top-5 right-5 z-30 hero-label"
              aria-live="polite"
              aria-atomic="true"
              style={{
                fontSize: 9,
                letterSpacing: "0.28em",
                color: "rgba(255,255,255,0.28)",
              }}
            >
              {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </div>
          )}

          {/* ── Arrows ── */}
          {slides.length > 1 &&
            (["prev", "next"] as const).map((dir) => (
              <button
                key={dir}
                onClick={dir === "prev" ? prev : next}
                aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
                className="hidden sm:flex absolute top-1/2 -translate-y-1/2 z-30 items-center justify-center focus:outline-none"
                style={{
                  [dir === "prev" ? "left" : "right"]: "clamp(12px, 2.5vw, 32px)",
                  width: "clamp(34px, 3vw, 46px)",
                  height: "clamp(34px, 3vw, 46px)",
                  background: "rgba(4,8,12,0.55)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.5)",
                  borderRadius: 0,
                  transition: "all 0.25s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = `${accentGlow}22`;
                  el.style.borderColor = `${accent}55`;
                  el.style.color = accent;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(4,8,12,0.55)";
                  el.style.borderColor = "rgba(255,255,255,0.08)";
                  el.style.color = "rgba(255,255,255,0.5)";
                }}
              >
                {dir === "prev" ? (
                  <ChevronLeft size={14} strokeWidth={1.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={1.5} />
                )}
              </button>
            ))}

          {/* ── Vertical tick nav — desktop right edge ── */}
          {slides.length > 1 && (
            <div className="absolute right-5 bottom-16 z-30 hidden sm:flex flex-col items-center gap-[10px]">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    width: 1,
                    height: i === current ? 32 : 10,
                    background: i === current ? accent : "rgba(255,255,255,0.2)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 0.45s ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Progress bar ── */}
        {slides.length > 1 && (
          <div
            className="relative w-full overflow-hidden"
            style={{ height: 1, background: "rgba(255,255,255,0.04)" }}
          >
            {!isPaused && (
              <motion.div
                key={`progress-${current}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: AUTO_ROTATE_MS / 1000, ease: "linear" }}
                className="absolute inset-0 origin-left"
                style={{ background: accent }}
              />
            )}
          </div>
        )}

        {/* ── Dot nav — mobile only ── */}
        {slides.length > 1 && (
          <div
            className="flex sm:hidden items-center justify-center gap-[10px] py-3"
            style={{ background: "#04080c" }}
            role="tablist"
            aria-label="Slide navigation"
          >
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => go(i)}
                className="focus:outline-none"
                style={{
                  height: 1,
                  width: i === current ? 28 : 8,
                  background: i === current ? accent : "rgba(255,255,255,0.15)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.45s ease",
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}