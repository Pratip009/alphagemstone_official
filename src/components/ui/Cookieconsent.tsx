"use client";

import { useState, useEffect } from "react";
import { X, Cookie, ChevronDown, ChevronUp, Shield, BarChart2, Megaphone } from "lucide-react";

type ConsentState = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "alpha_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (acceptAll?: boolean) => {
    const finalConsent: ConsentState = acceptAll
      ? { necessary: true, analytics: true, marketing: true }
      : consent;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...finalConsent, ts: Date.now() }));
    setAnimatingOut(true);
    setTimeout(() => setVisible(false), 600);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes ccSlideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes ccSlideDown {
          from { opacity: 1; transform: translateY(0)    scale(1);    }
          to   { opacity: 0; transform: translateY(32px) scale(0.96); }
        }
        @keyframes ccGlow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1;   }
        }
        @keyframes ccShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .cc-wrap {
          animation: ${animatingOut ? "ccSlideDown" : "ccSlideUp"} 0.55s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .cc-gem-glow {
          animation: ccGlow 3s ease-in-out infinite;
        }
        .cc-shimmer-btn {
          background-size: 200% auto;
          animation: ccShimmer 3s linear infinite;
        }
        .cc-toggle {
          transition: background 0.3s, box-shadow 0.3s;
        }
        .cc-toggle.on  { background: var(--gold); box-shadow: 0 0 0 3px rgba(201,168,76,0.25); }
        .cc-toggle.off { background: var(--border-dark); }
        .cc-details-panel {
          overflow: hidden;
          transition: max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease;
        }
        .cc-details-panel.open  { max-height: 400px; opacity: 1; }
        .cc-details-panel.shut  { max-height: 0;     opacity: 0; }
      `}</style>

      {/* Backdrop blur */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(26,24,20,0.35) 0%, transparent 60%)",
          opacity: animatingOut ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      />

      {/* Card */}
      <div
        className="cc-wrap fixed z-[9999] bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[640px]"
        role="dialog"
        aria-label="Cookie preferences"
        aria-modal="true"
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderTop: "2px solid var(--gold)",
            boxShadow: "0 24px 80px rgba(26,24,20,0.22), 0 4px 16px rgba(26,24,20,0.1)",
            borderRadius: "2px",
          }}
        >
          {/* Gold top accent bar */}
          <div
            style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent 0%, var(--gold) 40%, var(--accent) 70%, transparent 100%)",
              backgroundSize: "200% auto",
            }}
            className="cc-shimmer-btn"
          />

          <div className="px-6 pt-5 pb-6">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                {/* Diamond gem icon */}
                <div
                  className="relative flex-shrink-0 flex items-center justify-center w-10 h-10"
                  style={{
                    background: "linear-gradient(135deg, var(--gold-light), var(--accent-light))",
                    border: "1px solid var(--gold)",
                    borderRadius: "2px",
                    transform: "rotate(45deg)",
                  }}
                >
                  <div style={{ transform: "rotate(-45deg)" }}>
                    <Cookie size={16} strokeWidth={1.5} style={{ color: "var(--accent-dark)" }} />
                  </div>
                  {/* Glow */}
                  <div
                    className="cc-gem-glow absolute inset-0"
                    style={{
                      background: "radial-gradient(circle, rgba(201,168,76,0.4) 0%, transparent 70%)",
                      borderRadius: "2px",
                    }}
                  />
                </div>

                <div>
                  <h2
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "var(--text)",
                      letterSpacing: "0.02em",
                      lineHeight: 1.2,
                    }}
                  >
                    Your Privacy Matters
                  </h2>
                  <p
                    style={{
                      fontFamily: "'Josefin Sans', sans-serif",
                      fontSize: "0.65rem",
                      letterSpacing: "0.14em",
                      color: "var(--gold)",
                      textTransform: "uppercase",
                      marginTop: "2px",
                    }}
                  >
                    Alpha Imports · Cookie Preferences
                  </p>
                </div>
              </div>

              <button
                onClick={() => dismiss()}
                aria-label="Close without saving"
                style={{
                  color: "var(--muted)",
                  transition: "color 0.2s",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body text */}
            <p
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: "0.8rem",
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                letterSpacing: "0.02em",
                marginBottom: "18px",
              }}
            >
              We use cookies to enhance your experience discovering our curated gemstone collections.
              You may choose which categories to enable — necessary cookies are always active.{" "}
              <a
                href="/privacy-policy"
                style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                Privacy Policy
              </a>
            </p>

            {/* Expandable preferences */}
            <div
              className="cc-details-panel"
              style={expanded ? { maxHeight: "400px", opacity: 1 } : { maxHeight: 0, opacity: 0 }}
            >
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  padding: "16px 0",
                  marginBottom: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {/* Necessary */}
                <PreferenceRow
                  icon={<Shield size={14} strokeWidth={1.5} />}
                  label="Strictly Necessary"
                  description="Essential for the website to function. Cannot be disabled."
                  checked={true}
                  locked={true}
                  onChange={() => {}}
                />
                {/* Analytics */}
                <PreferenceRow
                  icon={<BarChart2 size={14} strokeWidth={1.5} />}
                  label="Analytics"
                  description="Help us understand how visitors interact with our collections."
                  checked={consent.analytics}
                  locked={false}
                  onChange={v => setConsent(c => ({ ...c, analytics: v }))}
                />
                {/* Marketing */}
                <PreferenceRow
                  icon={<Megaphone size={14} strokeWidth={1.5} />}
                  label="Marketing"
                  description="Personalised offers and gemstone recommendations tailored to you."
                  checked={consent.marketing}
                  locked={false}
                  onChange={v => setConsent(c => ({ ...c, marketing: v }))}
                />
              </div>
            </div>

            {/* Action row */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Accept All — gold shimmer CTA */}
              <button
                onClick={() => dismiss(true)}
                className="cc-shimmer-btn"
                style={{
                  flex: 1,
                  width: "100%",
                  padding: "11px 20px",
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: "0.65rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  color: "#fff",
                  background: "linear-gradient(90deg, var(--gold) 0%, var(--accent) 50%, var(--gold) 100%)",
                  border: "none",
                  borderRadius: "1px",
                  cursor: "pointer",
                  transition: "filter 0.2s, transform 0.15s",
                  boxShadow: "0 4px 20px rgba(201,168,76,0.3)",
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Accept All
              </button>

              {/* Save / Reject */}
              <button
                onClick={() => dismiss(false)}
                style={{
                  flex: 1,
                  width: "100%",
                  padding: "10px 20px",
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: "0.65rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  color: "var(--text)",
                  background: "transparent",
                  border: "1px solid var(--border-dark)",
                  borderRadius: "1px",
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-dark)"; e.currentTarget.style.background = "transparent"; }}
              >
                {expanded ? "Save Preferences" : "Reject Optional"}
              </button>

              {/* Manage / collapse toggle */}
              <button
                onClick={() => setExpanded(v => !v)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "10px 14px",
                  fontFamily: "'Josefin Sans', sans-serif",
                  fontSize: "0.62rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  color: "var(--muted)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "1px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s, border-color 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-light)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? "Less" : "Manage"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Sub-component: preference row ─────────────── */
function PreferenceRow({
  icon,
  label,
  description,
  checked,
  locked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  locked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: "28px",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "2px",
          color: "var(--accent)",
          marginTop: "1px",
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontFamily: "'Josefin Sans', sans-serif",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text)",
            marginBottom: "2px",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "'Josefin Sans', sans-serif",
            fontSize: "0.72rem",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      </div>

      {/* Toggle */}
      <div style={{ flexShrink: 0, paddingTop: "2px" }}>
        {locked ? (
          <div
            style={{
              fontFamily: "'Josefin Sans', sans-serif",
              fontSize: "0.58rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--gold)",
              background: "var(--gold-light)",
              border: "1px solid var(--gold)",
              padding: "3px 8px",
              borderRadius: "1px",
              whiteSpace: "nowrap",
            }}
          >
            Always On
          </div>
        ) : (
          <button
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`cc-toggle ${checked ? "on" : "off"}`}
            style={{
              width: "40px",
              height: "22px",
              borderRadius: "11px",
              border: "none",
              cursor: "pointer",
              position: "relative",
              outline: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "3px",
                left: checked ? "20px" : "3px",
                width: "16px",
                height: "16px",
                background: "#fff",
                borderRadius: "50%",
                transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        )}
      </div>
    </div>
  );
}