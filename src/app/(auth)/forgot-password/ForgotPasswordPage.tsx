'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OtpInput from '@/components/ui/OtpInput';

type Step = 'email' | 'otp' | 'password' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed.');
      setStep('otp');
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = () => {
    if (otp.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setError('');
    setStep('password');
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(''); setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setOtp('');
      startCountdown();
    } catch {
      setError('Failed to resend. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed.');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
      if (err instanceof Error && err.message.toLowerCase().includes('code')) {
        setStep('otp');
        setOtp('');
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (p: string) => {
    if (!p.length) return null;
    if (p.length < 6) return { width: '33%', color: '#c0392b', label: 'Weak' };
    if (p.length < 10) return { width: '66%', color: '#b8922a', label: 'Fair' };
    return { width: '100%', color: '#2e7d52', label: 'Strong' };
  };
  const strength = passwordStrength(newPassword);

  const steps: Step[] = ['email', 'otp', 'password'];
  const currentIdx = steps.indexOf(step);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap');
        :root{--navy:#1a1a2e;--deep:#0f3460;--violet:#7c3aed;--petal:#c4b5fd;--silver:#9f9fc0;--border:#e8e4f8;--display:'Google Sans Flex', sans-serif;--label:'Google Sans Flex', sans-serif;}
        *{box-sizing:border-box;margin:0;padding:0;}
        .auth-root{min-height:100vh;display:flex;font-family:var(--display);background:#faf9f7;overflow:hidden;}
        .auth-left{display:none;position:relative;width:46%;flex-shrink:0;background:var(--navy);overflow:hidden;flex-direction:column;justify-content:space-between;padding:52px;}
        @media(min-width:900px){.auth-left{display:flex;}}
        .auth-left-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 110%,rgba(15,52,96,0.9) 0%,transparent 60%),linear-gradient(160deg,#0d1117 0%,#0f1e35 40%,#1a1a2e 100%);}
        .auth-left-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(165,180,252,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(165,180,252,0.04) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%);}
        .auth-left-orb{position:absolute;width:420px;height:420px;top:50%;left:50%;transform:translate(-50%,-52%);border-radius:50%;background:radial-gradient(circle,rgba(15,52,96,0.55) 0%,rgba(124,58,237,0.12) 45%,transparent 70%);animation:orbPulse 6s ease-in-out infinite;}
        @keyframes orbPulse{0%,100%{transform:translate(-50%,-52%) scale(1);opacity:0.7;}50%{transform:translate(-50%,-52%) scale(1.1);opacity:1;}}
        .auth-left-logo{position:relative;z-index:2;display:flex;align-items:center;gap:10px;}
        .auth-left-logo-gem{width:36px;height:36px;background:linear-gradient(135deg,var(--deep),var(--violet));border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(124,58,237,0.35);}
        .auth-left-logo-text{font-family:var(--display);font-size:16px;font-weight:400;color:rgba(240,235,255,0.9);}
        .auth-left-logo-sub{font-family:var(--label);font-size:9px;font-weight:300;letter-spacing:0.22em;color:var(--silver);text-transform:uppercase;display:block;margin-top:1px;}
        .auth-left-center{position:relative;z-index:2;flex:1;display:flex;align-items:center;justify-content:center;}
        .auth-left-bottom{position:relative;z-index:2;}
        .auth-left-eyebrow{font-family:var(--label);font-size:9px;letter-spacing:0.32em;text-transform:uppercase;color:var(--petal);opacity:0.75;margin-bottom:14px;display:flex;align-items:center;gap:10px;}
        .auth-left-eyebrow::before{content:'';width:28px;height:1px;background:linear-gradient(to right,var(--petal),transparent);}
        .auth-left-headline{font-family:var(--display);font-size:34px;font-weight:300;line-height:1.2;color:rgba(240,235,255,0.92);margin:0 0 14px;}
        .auth-left-headline em{font-style:italic;color:rgba(196,181,253,0.85);}
        .auth-left-sub{font-family:var(--label);font-size:13px;font-weight:300;color:rgba(159,159,192,0.65);line-height:1.7;max-width:300px;}
        .auth-right{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;background:#faf9f7;position:relative;}
        .auth-form-shell{width:100%;max-width:390px;position:relative;z-index:1;animation:formSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) both;}
        @keyframes formSlideUp{from{opacity:0;transform:translateY(32px);}to{opacity:1;transform:translateY(0);}}
        .auth-mobile-brand{display:inline-flex;align-items:center;gap:8px;margin-bottom:36px;}
        @media(min-width:900px){.auth-mobile-brand{display:none;}}
        .auth-mobile-gem{width:30px;height:30px;background:linear-gradient(135deg,var(--deep),var(--violet));border-radius:7px;display:flex;align-items:center;justify-content:center;}
        .auth-mobile-brand-text{font-family:var(--display);font-size:15px;font-weight:400;color:var(--navy);}
        .auth-heading{font-family:var(--display);font-size:33px;font-weight:400;color:var(--navy);margin:0 0 6px;letter-spacing:-0.01em;}
        .auth-subheading{font-family:var(--label);font-size:13px;font-weight:300;letter-spacing:0.04em;color:#8a8898;margin:0 0 32px;}
        .auth-field{margin-bottom:22px;}
        .auth-label{display:block;font-family:var(--label);font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:var(--deep);margin-bottom:8px;}
        .auth-field:focus-within .auth-label{color:var(--violet);}
        .auth-input-wrap{position:relative;}
        .auth-input{width:100%;height:50px;padding:0 16px;font-family:var(--display);font-size:15px;font-weight:300;color:var(--navy);background:#fff;border:1px solid var(--border);border-radius:6px;outline:none;transition:border-color 0.22s,box-shadow 0.22s;}
        .auth-input.has-eye{padding-right:50px;}
        .auth-input:hover{border-color:var(--petal);}
        .auth-input:focus{border-color:var(--deep);box-shadow:0 0 0 3px rgba(15,52,96,0.08);}
        .auth-input::placeholder{font-family:var(--label);font-size:13px;font-weight:300;letter-spacing:0.04em;color:#c0bcd0;}
        .auth-input-line{position:absolute;bottom:0;left:8px;right:8px;height:2px;border-radius:0 0 2px 2px;background:linear-gradient(90deg,var(--deep),var(--violet));transform:scaleX(0);transform-origin:left;transition:transform 0.3s;pointer-events:none;}
        .auth-input:focus~.auth-input-line{transform:scaleX(1);}
        .auth-eye-btn{position:absolute;right:0;top:0;bottom:0;width:48px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:var(--silver);transition:color 0.2s;}
        .auth-eye-btn:hover{color:var(--deep);}
        .auth-strength-wrap{margin-top:8px;display:flex;align-items:center;gap:10px;}
        .auth-strength-track{flex:1;height:3px;background:var(--border);border-radius:3px;overflow:hidden;}
        .auth-strength-fill{height:100%;border-radius:3px;transition:width 0.4s,background 0.3s;}
        .auth-strength-label{font-family:var(--label);font-size:9px;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;min-width:38px;text-align:right;}
        .auth-error{display:flex;align-items:flex-start;gap:9px;font-family:var(--label);font-size:12px;color:#c0392b;background:rgba(192,57,43,0.05);border:1px solid rgba(192,57,43,0.18);border-left:3px solid rgba(192,57,43,0.5);padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:18px;animation:formSlideUp 0.3s ease both;}
        .auth-btn{width:100%;height:52px;font-family:var(--label);font-size:12px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,var(--navy) 0%,var(--deep) 100%);border:none;border-radius:6px;cursor:pointer;position:relative;overflow:hidden;transition:transform 0.15s,box-shadow 0.25s;box-shadow:0 4px 16px rgba(15,52,96,0.22);}
        .auth-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--deep) 0%,var(--violet) 100%);opacity:0;transition:opacity 0.3s;}
        .auth-btn:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(15,52,96,0.28);}
        .auth-btn:not(:disabled):hover::before{opacity:1;}
        .auth-btn:disabled{opacity:0.55;cursor:not-allowed;}
        .auth-btn-inner{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;}
        .auth-spinner{width:14px;height:14px;border:1.5px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.65s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .auth-footer{text-align:center;font-family:var(--label);font-size:13px;font-weight:300;color:#8a8898;margin-top:24px;}
        .auth-footer a{color:var(--deep);text-decoration:none;font-weight:500;}
        .auth-footer a:hover{color:var(--violet);}
        .otp-back-btn{background:none;border:none;cursor:pointer;font-family:var(--label);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--silver);padding:0;margin-bottom:24px;display:flex;align-items:center;gap:6px;transition:color 0.2s;}
        .otp-back-btn:hover{color:var(--deep);}
        .otp-email-hint{font-family:var(--label);font-size:12px;color:#8a8898;text-align:center;margin-bottom:28px;line-height:1.7;}
        .otp-email-hint strong{color:var(--deep);}
        .otp-resend-row{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;font-family:var(--label);font-size:12px;color:#8a8898;}
        .otp-resend-btn{background:none;border:none;cursor:pointer;font-family:var(--label);font-size:12px;font-weight:500;color:var(--deep);padding:0;transition:color 0.2s;}
        .otp-resend-btn:hover{color:var(--violet);}
        .otp-resend-btn:disabled{color:var(--silver);cursor:not-allowed;}
        .step-dots{display:flex;gap:8px;justify-content:center;margin-bottom:28px;}
        .step-dot{width:6px;height:6px;border-radius:50%;background:var(--border);transition:background 0.3s,transform 0.3s;}
        .step-dot.active{background:var(--deep);transform:scale(1.4);}
        .step-dot.done{background:var(--violet);}
        .done-icon{width:64px;height:64px;background:linear-gradient(135deg,rgba(46,125,82,0.12),rgba(46,125,82,0.06));border:1px solid rgba(46,125,82,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;}
      `}</style>

      <div className="auth-root">

        {/* LEFT PANEL */}
        <div className="auth-left">
          <div className="auth-left-bg" />
          <div className="auth-left-grid" />
          <div className="auth-left-orb" />
          <div className="auth-left-logo">
            <div className="auth-left-logo-gem">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <polygon points="16,3 29,12 16,29 3,12" stroke="#ffffff" strokeWidth="1.6" fill="none"/>
                <polygon points="16,3 29,12 16,15 3,12" stroke="rgba(196,181,253,0.8)" strokeWidth="1.2" fill="none" opacity="0.7"/>
              </svg>
            </div>
            <div>
              <span className="auth-left-logo-text">Alpha Imports</span>
              <span className="auth-left-logo-sub">Fine Gemstones</span>
            </div>
          </div>
          <div className="auth-left-center" />
          <div className="auth-left-bottom">
            <div className="auth-left-eyebrow">Account Security</div>
            <h2 className="auth-left-headline">Recover your<br /><em>account securely.</em></h2>
            <p className="auth-left-sub">We'll send a one-time code to your email so only you can reset your password.</p>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="auth-right">
          <div className="auth-form-shell">

            <div className="auth-mobile-brand">
              <div className="auth-mobile-gem">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <polygon points="16,3 29,12 16,29 3,12" stroke="#ffffff" strokeWidth="1.8" fill="none"/>
                </svg>
              </div>
              <span className="auth-mobile-brand-text">Alpha Imports</span>
            </div>

            {step !== 'done' && (
              <div className="step-dots">
                {steps.map((s, i) => (
                  <div key={s} className={`step-dot ${i === currentIdx ? 'active' : i < currentIdx ? 'done' : ''}`} />
                ))}
              </div>
            )}

            {step === 'email' && (
              <>
                <h1 className="auth-heading">Forgot password?</h1>
                <p className="auth-subheading">Enter your email and we'll send a reset code</p>
                <form onSubmit={handleEmailSubmit}>
                  <div className="auth-field">
                    <label className="auth-label">Email address</label>
                    <div className="auth-input-wrap">
                      <input type="email" className="auth-input" placeholder="you@example.com"
                        value={email} onChange={(e) => setEmail(e.target.value)} required />
                      <div className="auth-input-line" />
                    </div>
                  </div>
                  {error && (
                    <div className="auth-error">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      {error}
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="auth-btn">
                    <span className="auth-btn-inner">
                      {loading && <span className="auth-spinner" />}
                      {loading ? 'Sending…' : 'Send Reset Code'}
                    </span>
                  </button>
                </form>
                <div className="auth-footer"><Link href="/login">← Back to sign in</Link></div>
              </>
            )}

            {step === 'otp' && (
              <>
                <button className="otp-back-btn" onClick={() => { setStep('email'); setError(''); setOtp(''); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Back
                </button>
                <h1 className="auth-heading">Check your email</h1>
                <p className="auth-subheading">Enter the 6-digit reset code</p>
                <p className="otp-email-hint">Code sent to <strong>{email}</strong>.<br />It expires in 10 minutes.</p>
                <OtpInput value={otp} onChange={setOtp} disabled={loading} />
                {error && (
                  <div className="auth-error" style={{ marginTop: 18 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    {error}
                  </div>
                )}
                <button onClick={handleOtpSubmit} disabled={loading || otp.length !== 6}
                  className="auth-btn" style={{ marginTop: 24 }}>
                  <span className="auth-btn-inner">
                    {loading && <span className="auth-spinner" />}
                    {loading ? 'Verifying…' : 'Verify Code'}
                  </span>
                </button>
                <div className="otp-resend-row">
                  Didn&apos;t receive it?{' '}
                  <button className="otp-resend-btn" disabled={countdown > 0 || loading} onClick={handleResend}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                </div>
              </>
            )}

            {step === 'password' && (
              <>
                <button className="otp-back-btn" onClick={() => { setStep('otp'); setError(''); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Back
                </button>
                <h1 className="auth-heading">New password</h1>
                <p className="auth-subheading">Choose a strong password for your account</p>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="auth-field">
                    <label className="auth-label">New password</label>
                    <div className="auth-input-wrap">
                      <input type={showPassword ? 'text' : 'password'} className="auth-input has-eye"
                        placeholder="••••••••" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                      <div className="auth-input-line" />
                      <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                        {showPassword
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M1 1l22 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/></svg>
                        }
                      </button>
                    </div>
                    {strength && (
                      <div className="auth-strength-wrap">
                        <div className="auth-strength-track">
                          <div className="auth-strength-fill" style={{ width: strength.width, background: strength.color }} />
                        </div>
                        <span className="auth-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                      </div>
                    )}
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Confirm password</label>
                    <div className="auth-input-wrap">
                      <input type="password" className="auth-input" placeholder="••••••••"
                        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                      <div className="auth-input-line" />
                    </div>
                  </div>
                  {error && (
                    <div className="auth-error">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      {error}
                    </div>
                  )}
                  <button type="submit" disabled={loading} className="auth-btn">
                    <span className="auth-btn-inner">
                      {loading && <span className="auth-spinner" />}
                      {loading ? 'Resetting…' : 'Reset Password'}
                    </span>
                  </button>
                </form>
              </>
            )}

            {step === 'done' && (
              <div style={{ textAlign: 'center', animation: 'formSlideUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
                <div className="done-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#2e7d52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h1 className="auth-heading" style={{ textAlign: 'center' }}>Password reset!</h1>
                <p style={{ fontFamily: 'var(--label)', fontSize: 13, color: '#8a8898', marginTop: 8, marginBottom: 32, lineHeight: 1.7 }}>
                  Your password has been updated. You can now sign in with your new password.
                </p>
                <button onClick={() => router.push('/login')} className="auth-btn">
                  <span className="auth-btn-inner">Sign In</span>
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}