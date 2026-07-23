"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import OtpInput from "@/components/ui/OtpInput";
import { useAuth } from "@/hooks/useAuth";

type Step = "form" | "otp";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send code.");
      setStep("otp");
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyOtp(form.email, otp);
      setRedirecting(true); // ← add this
      const redirect = searchParams.get("redirect") || "/products";
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setLoading(false); // ← only reset on error now
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend.");
      setOtp("");
      setSuccess("New code sent!");
      setTimeout(() => setSuccess(""), 3000);
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (p: string) => {
    if (!p.length) return null;
    if (p.length < 6) return { width: "33%", color: "#c0392b", label: "Weak" };
    if (p.length < 10) return { width: "66%", color: "#b8922a", label: "Fair" };
    return { width: "100%", color: "#2e7d52", label: "Strong" };
  };
  const strength = passwordStrength(form.password);

  return (
    <>
      <style>{`
       

        :root {
          --navy:#1a1a2e;--deep:#0f3460;--violet:#7c3aed;--gold:#b8922a;
          --petal:#c4b5fd;--silver:#9f9fc0;--border:#e8e4f8;
          --display:'Gilda Display', serif;--label:'Gilda Display', serif;
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        .auth-root{min-height:100vh;display:flex;font-family:var(--display);background:#faf9f7;overflow:hidden;}
        .auth-left{display:none;position:relative;width:46%;flex-shrink:0;background:var(--navy);overflow:hidden;flex-direction:column;justify-content:space-between;padding:52px;}
        @media(min-width:900px){.auth-left{display:flex;}}
        .auth-left-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 110%,rgba(15,52,96,0.9) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 90% -10%,rgba(124,58,237,0.18) 0%,transparent 55%),linear-gradient(160deg,#0d1117 0%,#0f1e35 40%,#1a1a2e 100%);}
        .auth-left-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(165,180,252,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(165,180,252,0.04) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%);}
        .auth-left-orb{position:absolute;width:420px;height:420px;top:50%;left:50%;transform:translate(-50%,-52%);border-radius:50%;background:radial-gradient(circle,rgba(15,52,96,0.55) 0%,rgba(124,58,237,0.12) 45%,transparent 70%);animation:orbPulse 6s ease-in-out infinite;}
        @keyframes orbPulse{0%,100%{transform:translate(-50%,-52%) scale(1);opacity:0.7;}50%{transform:translate(-50%,-52%) scale(1.1);opacity:1;}}
        .auth-left-diamonds{position:absolute;inset:0;overflow:hidden;}
        .auth-left-diamonds svg{position:absolute;top:50%;left:50%;transform:translate(-50%,-54%);animation:diamondFloat 8s ease-in-out infinite;}
        @keyframes diamondFloat{0%,100%{transform:translate(-50%,-54%);}50%{transform:translate(-50%,-57%);}}
        .auth-left-logo{position:relative;z-index:2;display:flex;align-items:center;gap:10px;}
        .auth-left-logo-gem{width:36px;height:36px;background:linear-gradient(135deg,var(--deep),var(--violet));border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(124,58,237,0.35);}
        .auth-left-logo-text{font-family:var(--display);font-size:16px;font-weight:400;color:rgba(240,235,255,0.9);letter-spacing:0.02em;}
        .auth-left-logo-sub{font-family:var(--label);font-size:9px;font-weight:300;letter-spacing:0.22em;color:var(--silver);text-transform:uppercase;display:block;margin-top:1px;}
        .auth-left-center{position:relative;z-index:2;flex:1;display:flex;align-items:center;justify-content:center;}
        .auth-left-bottom{position:relative;z-index:2;}
        .auth-left-eyebrow{font-family:var(--label);font-size:9px;font-weight:400;letter-spacing:0.32em;text-transform:uppercase;color:var(--petal);opacity:0.75;margin-bottom:14px;display:flex;align-items:center;gap:10px;}
        .auth-left-eyebrow::before{content:'';width:28px;height:1px;background:linear-gradient(to right,var(--petal),transparent);}
        .auth-left-headline{font-family:var(--display);font-size:34px;font-weight:300;line-height:1.2;color:rgba(240,235,255,0.92);margin:0 0 14px;letter-spacing:-0.01em;}
        .auth-left-headline em{font-style:italic;color:rgba(196,181,253,0.85);}
        .auth-left-sub{font-family:var(--label);font-size:13px;font-weight:300;color:rgba(159,159,192,0.65);line-height:1.7;max-width:300px;letter-spacing:0.02em;}
        .auth-stat-cards{display:flex;gap:12px;margin-top:28px;}
        .auth-stat-card{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(165,180,252,0.1);border-radius:8px;padding:12px 14px;backdrop-filter:blur(8px);}
        .auth-stat-number{font-family:var(--display);font-size:20px;font-weight:400;color:rgba(196,181,253,0.9);line-height:1;}
        .auth-stat-label{font-family:var(--label);font-size:10px;font-weight:300;letter-spacing:0.1em;color:rgba(159,159,192,0.55);margin-top:4px;text-transform:uppercase;}
        .auth-right{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;background:#faf9f7;position:relative;}
        .auth-right::before{content:'';position:absolute;top:0;right:0;width:320px;height:320px;background:radial-gradient(circle,rgba(124,58,237,0.05) 0%,transparent 70%);pointer-events:none;}
        .auth-form-shell{width:100%;max-width:390px;position:relative;z-index:1;animation:formSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) both;}
        @keyframes formSlideUp{from{opacity:0;transform:translateY(32px);}to{opacity:1;transform:translateY(0);}}
        .auth-mobile-brand{display:inline-flex;align-items:center;gap:8px;margin-bottom:36px;}
        @media(min-width:900px){.auth-mobile-brand{display:none;}}
        .auth-mobile-gem{width:30px;height:30px;background:linear-gradient(135deg,var(--deep),var(--violet));border-radius:7px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(124,58,237,0.3);}
        .auth-mobile-brand-text{font-family:var(--display);font-size:15px;font-weight:400;color:var(--navy);}
        .auth-heading{font-family:var(--display);font-size:33px;font-weight:400;color:var(--navy);margin:0 0 6px;letter-spacing:-0.01em;}
        .auth-subheading{font-family:var(--label);font-size:13px;font-weight:300;letter-spacing:0.04em;color:#8a8898;margin:0 0 32px;}
        .auth-field{margin-bottom:22px;}
        .auth-label{display:block;font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:var(--deep);margin-bottom:8px;}
        .auth-field:focus-within .auth-label{color:var(--violet);}
        .auth-input-wrap{position:relative;}
        .auth-input{width:100%;height:50px;padding:0 16px;font-family:var(--display);font-size:15px;font-weight:300;color:var(--navy);background:#fff;border:1px solid var(--border);border-radius:6px;outline:none;transition:border-color 0.22s,box-shadow 0.22s;letter-spacing:0.01em;}
        .auth-input.has-eye{padding-right:50px;}
        .auth-input:hover{border-color:var(--petal);}
        .auth-input:focus{border-color:var(--deep);box-shadow:0 0 0 3px rgba(15,52,96,0.08);}
        .auth-input::placeholder{font-family:var(--label);font-size:13px;font-weight:300;letter-spacing:0.04em;color:#c0bcd0;}
        .auth-input-line{position:absolute;bottom:0;left:8px;right:8px;height:2px;border-radius:0 0 2px 2px;background:linear-gradient(90deg,var(--deep),var(--violet));transform:scaleX(0);transform-origin:left;transition:transform 0.3s cubic-bezier(0.22,1,0.36,1);pointer-events:none;}
        .auth-input:focus~.auth-input-line{transform:scaleX(1);}
        .auth-eye-btn{position:absolute;right:0;top:0;bottom:0;width:48px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:var(--silver);border-radius:0 6px 6px 0;transition:color 0.2s;}
        .auth-eye-btn:hover{color:var(--deep);}
        .auth-strength-wrap{margin-top:8px;display:flex;align-items:center;gap:10px;}
        .auth-strength-track{flex:1;height:3px;background:var(--border);border-radius:3px;overflow:hidden;}
        .auth-strength-fill{height:100%;border-radius:3px;transition:width 0.4s cubic-bezier(0.22,1,0.36,1),background 0.3s;}
        .auth-strength-label{font-family:var(--label);font-size:9px;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;min-width:38px;text-align:right;}
        .auth-error{display:flex;align-items:flex-start;gap:9px;font-family:var(--label);font-size:12px;color:#c0392b;background:rgba(192,57,43,0.05);border:1px solid rgba(192,57,43,0.18);border-left:3px solid rgba(192,57,43,0.5);padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:18px;animation:formSlideUp 0.3s ease both;}
        .auth-success{display:flex;align-items:center;gap:9px;font-family:var(--label);font-size:12px;color:#2e7d52;background:rgba(46,125,82,0.06);border:1px solid rgba(46,125,82,0.2);border-left:3px solid rgba(46,125,82,0.5);padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:18px;}
        .auth-btn{width:100%;height:52px;font-family:var(--label);font-size:12px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,var(--navy) 0%,var(--deep) 100%);border:none;border-radius:6px;cursor:pointer;position:relative;overflow:hidden;transition:transform 0.15s,box-shadow 0.25s;box-shadow:0 4px 16px rgba(15,52,96,0.22);}
        .auth-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--deep) 0%,var(--violet) 100%);opacity:0;transition:opacity 0.3s;}
        .auth-btn:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(15,52,96,0.28);}
        .auth-btn:not(:disabled):hover::before{opacity:1;}
        .auth-btn:disabled{opacity:0.55;cursor:not-allowed;}
        .auth-btn-inner{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;}
        .auth-spinner{width:14px;height:14px;border:1.5px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.65s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .auth-terms{font-family:var(--label);font-size:11px;font-weight:300;letter-spacing:0.04em;color:var(--silver);text-align:center;margin-top:14px;line-height:1.7;}
        .auth-terms a{color:var(--deep);text-decoration:none;font-weight:500;}
        .auth-divider{display:flex;align-items:center;gap:14px;margin:24px 0;}
        .auth-divider-line{flex:1;height:1px;background:linear-gradient(to right,transparent,var(--border),transparent);}
        .auth-divider-text{font-family:var(--label);font-size:10px;font-weight:400;letter-spacing:0.14em;text-transform:uppercase;color:var(--silver);}
        .auth-footer{text-align:center;font-family:var(--label);font-size:13px;font-weight:300;letter-spacing:0.03em;color:#8a8898;}
        .auth-footer a{color:var(--deep);text-decoration:none;font-weight:500;border-bottom:1px solid transparent;transition:color 0.2s,border-color 0.2s;}
        .auth-footer a:hover{color:var(--violet);border-color:var(--violet);}
        .otp-email-hint{font-family:var(--label);font-size:12px;color:#8a8898;text-align:center;margin-bottom:28px;line-height:1.7;}
        .otp-email-hint strong{color:var(--deep);}
        .otp-resend-row{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;font-family:var(--label);font-size:12px;color:#8a8898;}
        .otp-resend-btn{background:none;border:none;cursor:pointer;font-family:var(--label);font-size:12px;font-weight:500;color:var(--deep);padding:0;transition:color 0.2s;}
        .otp-resend-btn:hover{color:var(--violet);}
        .otp-resend-btn:disabled{color:var(--silver);cursor:not-allowed;}
        .otp-back-btn{background:none;border:none;cursor:pointer;font-family:var(--label);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--silver);padding:0;margin-bottom:24px;display:flex;align-items:center;gap:6px;transition:color 0.2s;}
        .otp-back-btn:hover{color:var(--deep);}
      `}</style>

      <div className="auth-root">
        {/* LEFT PANEL */}
        {redirecting && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(250,249,247,0.92)",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
            }}
          >
            <span
              className="auth-spinner"
              style={{
                width: 40,
                height: 40,
                borderWidth: 2.5,
                borderColor: "rgba(15,52,96,0.15)",
                borderTopColor: "#0f3460",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <p className="auth-heading" style={{ marginBottom: 4 }}>
                Creating your account…
              </p>
              <p className="auth-subheading" style={{ margin: 0 }}>
                Please wait
              </p>
            </div>
          </div>
        )}
        <div className="auth-left">
          <div className="auth-left-bg" />
          <div className="auth-left-grid" />
          <div className="auth-left-orb" />
          <div className="auth-left-diamonds">
            <svg width="280" height="280" viewBox="0 0 280 280" fill="none">
              <rect
                x="28"
                y="28"
                width="224"
                height="224"
                rx="52"
                fill="rgba(15,52,96,0.18)"
                stroke="rgba(165,180,252,0.2)"
                strokeWidth="0.8"
              />
              <polygon
                points="140,28 224,28 224,112"
                fill="rgba(124,58,237,0.12)"
                stroke="rgba(196,181,253,0.22)"
                strokeWidth="0.6"
              />
              <polygon
                points="140,28 56,28 56,112"
                fill="rgba(15,52,96,0.14)"
                stroke="rgba(165,180,252,0.18)"
                strokeWidth="0.5"
              />
              <polygon
                points="140,252 224,252 224,168"
                fill="rgba(124,58,237,0.09)"
                stroke="rgba(196,181,253,0.14)"
                strokeWidth="0.5"
              />
              <polygon
                points="140,252 56,252 56,168"
                fill="rgba(15,52,96,0.10)"
                stroke="rgba(165,180,252,0.14)"
                strokeWidth="0.5"
              />
              <rect
                x="72"
                y="72"
                width="136"
                height="136"
                rx="24"
                fill="rgba(124,58,237,0.06)"
                stroke="rgba(196,181,253,0.18)"
                strokeWidth="0.6"
              />
              <circle cx="140" cy="140" r="4" fill="rgba(196,181,253,0.45)" />
            </svg>
          </div>
          <div className="auth-left-logo">
            <div className="auth-left-logo-gem">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <polygon
                  points="16,3 29,12 16,29 3,12"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                  fill="none"
                />
                <polygon
                  points="16,3 29,12 16,15 3,12"
                  stroke="rgba(196,181,253,0.8)"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.7"
                />
              </svg>
            </div>
            <div>
              <span className="auth-left-logo-text">Alpha Gemstone</span>
              <span className="auth-left-logo-sub">Fine Gemstones</span>
            </div>
          </div>
          <div className="auth-left-center" />
          <div className="auth-left-bottom">
            <div className="auth-left-eyebrow">Join the Collection</div>
            <h2 className="auth-left-headline">
              Begin your
              <br />
              <em>collection today.</em>
            </h2>
            <p className="auth-left-sub">
              Join a discerning circle of collectors with access to
              GIA-certified diamonds, exclusive inventory, and expert guidance.
            </p>
            <div className="auth-stat-cards">
              <div className="auth-stat-card">
                <div className="auth-stat-number">100k+</div>
                <div className="auth-stat-label">Gemstones</div>
              </div>
              <div className="auth-stat-card">
                <div className="auth-stat-number">GIA</div>
                <div className="auth-stat-label">Certified</div>
              </div>
              <div className="auth-stat-card">
                <div className="auth-stat-number">24h</div>
                <div className="auth-stat-label">Shipping</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="auth-right">
          <div className="auth-form-shell">
            <div className="auth-mobile-brand">
              <div className="auth-mobile-gem">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <polygon
                    points="16,3 29,12 16,29 3,12"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    fill="none"
                  />
                </svg>
              </div>
              <span className="auth-mobile-brand-text">Alpha Gemstone</span>
            </div>

            {step === "form" ? (
              <>
                <h1 className="auth-heading">Create account</h1>
                <p className="auth-subheading">
                  Join Alpha Gemstone — we'll verify your email
                </p>

                <form onSubmit={handleFormSubmit}>
                  <div className="auth-field">
                    <label className="auth-label">Full name</label>
                    <div className="auth-input-wrap">
                      <input
                        type="text"
                        className="auth-input"
                        placeholder="Your name"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        required
                      />
                      <div className="auth-input-line" />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label className="auth-label">Email address</label>
                    <div className="auth-input-wrap">
                      <input
                        type="email"
                        className="auth-input"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        required
                      />
                      <div className="auth-input-line" />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label className="auth-label">Password</label>
                    <div className="auth-input-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="auth-input has-eye"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        required
                        minLength={6}
                      />
                      <div className="auth-input-line" />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="1.6"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                    {strength && (
                      <div className="auth-strength-wrap">
                        <div className="auth-strength-track">
                          <div
                            className="auth-strength-fill"
                            style={{
                              width: strength.width,
                              background: strength.color,
                            }}
                          />
                        </div>
                        <span
                          className="auth-strength-label"
                          style={{ color: strength.color }}
                        >
                          {strength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="auth-error">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ flexShrink: 0, marginTop: 1 }}
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="7"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M8 5v3.5M8 11v.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="auth-btn">
                    <span className="auth-btn-inner">
                      {loading && <span className="auth-spinner" />}
                      {loading ? "Sending code…" : "Continue"}
                    </span>
                  </button>
                </form>

                <p className="auth-terms">
                  By continuing you agree to our{" "}
                  <a href="#">Terms of Service</a> and{" "}
                  <a href="#">Privacy Policy</a>
                </p>
                <div className="auth-divider">
                  <div className="auth-divider-line" />
                  <span className="auth-divider-text">Have an account?</span>
                  <div className="auth-divider-line" />
                </div>
                <div className="auth-footer">
                  Already have an account? <Link href="/login">Sign in</Link>
                </div>
              </>
            ) : (
              <>
                <button
                  className="otp-back-btn"
                  onClick={() => {
                    setStep("form");
                    setError("");
                    setOtp("");
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M19 12H5M12 5l-7 7 7 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back
                </button>

                <h1 className="auth-heading">Check your email</h1>
                <p className="auth-subheading">
                  Enter the 6-digit code we sent you
                </p>
                <p className="otp-email-hint">
                  Code sent to <strong>{form.email}</strong>.<br />
                  It expires in 10 minutes.
                </p>

                <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                {error && (
                  <div className="auth-error" style={{ marginTop: 18 }}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ flexShrink: 0, marginTop: 1 }}
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M8 5v3.5M8 11v.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    {error}
                  </div>
                )}
                {success && (
                  <div className="auth-success" style={{ marginTop: 18 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M5 8l2 2 4-4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {success}
                  </div>
                )}

                <button
                  onClick={handleOtpSubmit}
                  disabled={loading || otp.length !== 6}
                  className="auth-btn"
                  style={{ marginTop: 24 }}
                >
                  <span className="auth-btn-inner">
                    {loading && <span className="auth-spinner" />}
                    {loading ? "Verifying…" : "Verify & Create Account"}
                  </span>
                </button>

                <div className="otp-resend-row">
                  Didn&apos;t receive it?{" "}
                  <button
                    className="otp-resend-btn"
                    disabled={countdown > 0 || loading}
                    onClick={handleResend}
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
