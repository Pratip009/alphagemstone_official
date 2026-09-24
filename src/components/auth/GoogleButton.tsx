"use client";
import { useEffect, useState } from "react";

interface GoogleButtonProps {
  /** Where to send the user after a successful sign-in (relative path). */
  redirect?: string | null;
  /** Which page the button is on, so errors come back to the same page. */
  from: "login" | "signup";
  label?: string;
  disabled?: boolean;
}

/**
 * "Continue with Google" — a plain link to /api/auth/google, so it works
 * without any Google script and even before React hydrates. Follows
 * Google's branding guidelines (standard multicolour "G", neutral button).
 */
export default function GoogleButton({
  redirect,
  from,
  label = "Continue with Google",
  disabled,
}: GoogleButtonProps) {
  const [pending, setPending] = useState(false);

  // If the user presses Back on Google's screen, the browser may restore
  // this page from the back/forward cache with the spinner still showing.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const params = new URLSearchParams({ from });
  if (redirect) params.set("redirect", redirect);
  const href = `/api/auth/google?${params.toString()}`;

  const inactive = disabled || pending;

  return (
    <>
      <style>{`
        .gbtn {
          width: 100%;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-family: "Roboto", "Segoe UI", system-ui, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #1f1f1f;
          background: #ffffff;
          border: 1px solid #dadce0;
          border-radius: 6px;
          text-decoration: none;
          cursor: pointer;
          transition: background-color 0.18s, border-color 0.18s, box-shadow 0.18s;
          -webkit-tap-highlight-color: transparent;
        }
        .gbtn:hover { background: #f8f9fa; border-color: #c6c9cf; box-shadow: 0 1px 3px rgba(60,64,67,0.12); }
        .gbtn:active { background: #f1f3f4; }
        .gbtn:focus-visible { outline: 2px solid #0f3460; outline-offset: 2px; }
        .gbtn[aria-disabled="true"] { opacity: 0.6; cursor: default; pointer-events: none; }
        .gbtn-spinner {
          width: 16px; height: 16px;
          border: 2px solid #dadce0; border-top-color: #4285f4;
          border-radius: 50%;
          animation: gbtnSpin 0.7s linear infinite;
        }
        @keyframes gbtnSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .gbtn-spinner { animation-duration: 2s; } }
      `}</style>
      <a
        // The href must stay on the element at all times. Removing it on
        // click (via a state re-render) cancels the browser's navigation,
        // which left the spinner running forever.
        href={href}
        className="gbtn"
        role="button"
        aria-disabled={inactive || undefined}
        aria-busy={pending || undefined}
        onClick={(e) => {
          // Let the browser handle "open in new tab" (Ctrl/Cmd/Shift/middle click).
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          // Ignore clicks while disabled or already on the way to Google, so
          // a double click can't start two flows (the second would overwrite
          // the first's state cookie).
          if (inactive) return;
          setPending(true);
          window.location.assign(href);
        }}
      >
        {pending ? (
          <span className="gbtn-spinner" aria-hidden="true" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        )}
        <span>{pending ? "Opening Google…" : label}</span>
      </a>
    </>
  );
}