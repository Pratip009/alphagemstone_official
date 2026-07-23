"use client";

import { useState, useEffect, useCallback } from "react";

interface JewelryModalProps {
  delay?: number;
  onSubmit?: (email: string) => void;
  onDismiss?: () => void;
  storageKey?: string;
}

export default function JewelryModal({
  delay = 2500,
  onSubmit,
  onDismiss,
  storageKey = "jewelry_modal_dismissed",
}: JewelryModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey)) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, storageKey]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible]);

  useEffect(() => {
    document.body.style.overflow = visible ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  const closeModal = useCallback(() => {
    setClosing(true);
    localStorage.setItem(storageKey, "true");
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      onDismiss?.();
    }, 300);
  }, [storageKey, onDismiss]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/coupons/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
      localStorage.setItem(storageKey, "true");
      onSubmit?.(trimmed);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Exclusive offer"
      onClick={handleOverlayClick}
      className={[
        // px-4 keeps a safe gutter on narrow phones; py-6 stops the modal
        // from touching the top/bottom edge on short viewports (landscape
        // phones, small tablets in split-screen, etc).
        "fixed inset-0 z-50 flex items-center justify-center px-4 py-6",
        "bg-[#0a1a2e]/80 backdrop-blur-sm",
        "transition-opacity duration-300",
        closing ? "opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <div
        className={[
          // Fluid width: fills nearly the full gutter on phones, settles to
          // a fixed max on tablet/desktop. max-h + overflow-y-auto lets the
          // card scroll internally instead of overflowing the viewport on
          // very short screens, without needing separate mobile markup.
          "relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-sm",
          "bg-[#faf8f5] shadow-2xl",
          "transition-all duration-300",
          closing
            ? "opacity-0 scale-95 translate-y-2"
            : "opacity-100 scale-100 translate-y-0",
        ].join(" ")}
      >
        {/* gold accent bar */}
        <div
          className="h-[5px] w-full"
          style={{
            background:
              "linear-gradient(90deg,#c9a96e 0%,#e8d5a3 50%,#c9a96e 100%)",
          }}
        />

        {/* close button — enlarged tap target on touch devices while
            keeping the same visual icon size */}
        <button
          onClick={closeModal}
          aria-label="Close offer"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center text-[#8099b5] hover:text-[#0f3460] active:text-[#0f3460] transition-colors sm:right-3 sm:top-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="px-5 pb-5 pt-6 text-center font-[family-name:var(--font-jost,sans-serif)] sm:px-8 sm:pb-6 sm:pt-7">
          {!submitted ? (
            <>
              <p className="mb-2.5 text-[9px] font-normal uppercase tracking-[0.18em] text-[#0f3460] sm:mb-3 sm:text-[10px] sm:tracking-[0.2em]">
                Welcome
              </p>

              <h2
                className="mb-2 text-[28px] font-light leading-tight text-[#0f3460] sm:text-[34px] md:text-[38px]"
                style={{ fontFamily: '"Elms Sans", sans-serif' }}
              >
                Enjoy{" "}
                <em className="italic text-[#c9a96e]">10% off</em>
                <br />
                your first piece
              </h2>

              <p className="mb-1 text-[12.5px] font-light leading-relaxed text-[#4a6080] sm:text-[13px]">
                Join our community for exclusive access to fine jewelry crafted
                in the USA.
              </p>

              <p className="mb-5 text-[10.5px] font-light text-[#8099b5] sm:text-[11px]">
                Min. $200 purchase · Valid 30 days · One use only
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div
                  className={[
                    // Stacks input/button on very narrow phones (<375px,
                    // Tailwind's default `xs` isn't in core so we use the
                    // base + `min-[375px]:` arbitrary breakpoint) so neither
                    // control gets squeezed; sits side-by-side from ~375px
                    // up, which covers virtually all phones in portrait.
                    "mb-3 flex flex-col overflow-hidden border rounded-[1px] min-[375px]:flex-row",
                    error ? "border-red-400" : "border-[#c4d4e8]",
                  ].join(" ")}
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Your email address"
                    aria-label="Email address"
                    disabled={loading}
                    className={[
                      "h-11 w-full flex-1 bg-white px-3.5 text-[16px] font-light",
                      // 16px prevents iOS Safari's automatic zoom-on-focus;
                      // visually scaled back down to match the design above
                      // that breakpoint where zoom-on-focus isn't a concern.
                      "sm:text-[13px]",
                      "text-[#0f3460] placeholder:text-[#8099b5]",
                      "outline-none focus:outline-none disabled:opacity-60",
                    ].join(" ")}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={[
                      "h-11 w-full shrink-0 bg-[#0f3460] px-4 text-[11px] font-medium min-[375px]:w-auto",
                      "uppercase tracking-[0.12em] text-white",
                      "transition-colors hover:bg-[#0c2a4f] active:bg-[#091f3a]",
                      "disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5",
                    ].join(" ")}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      "Unlock 10% Off"
                    )}
                  </button>
                </div>

                {error && (
                  <p className="mb-2 text-[11px] text-red-500">{error}</p>
                )}

                <p className="mb-4 text-[10.5px] font-light leading-relaxed text-[#8099b5] sm:text-[11px]">
                  By signing up you agree to our{" "}
                  <a href="/terms" className="underline hover:text-[#0f3460]">
                    terms
                  </a>{" "}
                  &amp;{" "}
                  <a href="/privacy" className="underline hover:text-[#0f3460]">
                    privacy policy
                  </a>
                  .
                </p>
              </form>

              <div className="border-t border-[#dce8f0] pt-3.5">
                <button
                  onClick={closeModal}
                  className={[
                    "text-[10.5px] font-normal tracking-[0.06em] text-[#8099b5] sm:text-[11px]",
                    "hover:text-[#0f3460] hover:underline transition-colors",
                  ].join(" ")}
                >
                  No thanks, I'll pass on the offer
                </button>
              </div>
            </>
          ) : (
            <div className="py-4">
              <div className="mb-4 flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0f3460" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-[42px] sm:w-[42px]">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12 11 15 16 9" />
                </svg>
              </div>
              <h3
                className="mb-2 text-[24px] font-light text-[#0f3460] sm:text-[28px]"
                style={{ fontFamily: '"Elms Sans", sans-serif' }}
              >
                You're in
              </h3>
              <p className="text-[12.5px] font-light leading-relaxed text-[#4a6080] sm:text-[13px]">
                Check your inbox — your 10% off code is on its way.
              </p>
              <p className="mt-2 text-[10.5px] text-[#8099b5] sm:text-[11px]">
                Valid for 30 days · Min. $200 purchase
              </p>
              <button
                onClick={closeModal}
                className="mt-6 text-[10.5px] tracking-[0.08em] uppercase text-[#8099b5] hover:text-[#0f3460] transition-colors sm:text-[11px]"
              >
                Continue browsing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}