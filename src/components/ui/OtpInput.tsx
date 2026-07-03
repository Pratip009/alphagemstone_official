'use client';
import { useRef, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export default function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const focus = (i: number) => inputs.current[i]?.focus();

  const handleChange = (i: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const next = [...digits];
    next[i] = char;
    onChange(next.join('').replace(/\s/g, ''));
    if (char && i < 5) focus(i + 1);
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) focus(i - 1);
    if (e.key === 'ArrowLeft' && i > 0) focus(i - 1);
    if (e.key === 'ArrowRight' && i < 5) focus(i + 1);
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    focus(Math.min(pasted.length, 5));
  };

  return (
    <>
      <style>{`
        .otp-wrap {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .otp-cell {
          width: 52px;
          height: 60px;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 24px;
          font-weight: 500;
          text-align: center;
          color: #1a1a2e;
          background: #fff;
          border: 1.5px solid #e8e4f8;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          caret-color: transparent;
          -moz-appearance: textfield;
        }
        .otp-cell::-webkit-outer-spin-button,
        .otp-cell::-webkit-inner-spin-button { -webkit-appearance: none; }
        .otp-cell:focus {
          border-color: #0f3460;
          box-shadow: 0 0 0 3px rgba(15,52,96,0.10);
          background: #f5f3ff;
        }
        .otp-cell.filled {
          border-color: #7c3aed;
          background: #f5f3ff;
        }
        .otp-cell:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 400px) {
          .otp-cell { width: 42px; height: 52px; font-size: 20px; }
          .otp-wrap { gap: 7px; }
        }
      `}</style>
      <div className="otp-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            className={`otp-cell${digits[i] ? ' filled' : ''}`}
            value={digits[i] || ''}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value.slice(-1))}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            autoComplete="one-time-code"
          />
        ))}
      </div>
    </>
  );
}