"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaPinterestP,
} from "react-icons/fa";
import { Share2, X } from "lucide-react";

const socials = [
  {
    name: "Instagram",
    href: "https://instagram.com",
    icon: FaInstagram,
    bg: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
    glow: "rgba(220,39,67,0.6)",
  },
  {
    name: "Facebook",
    href: "https://facebook.com",
    icon: FaFacebookF,
    bg: "linear-gradient(135deg, #1877f2, #0c5ecc)",
    glow: "rgba(24,119,242,0.6)",
  },
  {
    name: "YouTube",
    href: "https://youtube.com",
    icon: FaYoutube,
    bg: "linear-gradient(135deg, #ff0000, #cc0000)",
    glow: "rgba(255,0,0,0.6)",
  },
  {
    name: "TikTok",
    href: "https://tiktok.com",
    icon: FaTiktok,
    bg: "linear-gradient(135deg, #010101, #2d2d2d)",
    glow: "rgba(105,201,208,0.5)",
  },
  {
    name: "Pinterest",
    href: "https://pinterest.com",
    icon: FaPinterestP,
    bg: "linear-gradient(135deg, #e60023, #b5001a)",
    glow: "rgba(230,0,35,0.6)",
  },
];

export default function FloatingSocialIcons() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes socialFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes socialIn {
          from { opacity: 0; transform: translateX(-18px) scale(0.8); }
          to   { opacity: 1; transform: translateX(0px)  scale(1);   }
        }
        @keyframes triggerPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(201,168,76,0); }
        }
        .social-trigger { animation: triggerPulse 2.8s ease-in-out infinite; }
        .social-trigger.open { animation: none; }
        .social-item {
          animation: socialFloat 4s ease-in-out infinite, socialIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        }
      `}</style>

      <div className="fixed bottom-6 left-6 z-[999] flex flex-col items-start gap-3">

        {/* Social links — visible when open */}
        {open && socials.map((social, i) => {
          const Icon = social.icon;
          return (
            <Link
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3"
              style={{
                animationDelay: `${i * 0.06}s`,
                animationDuration: `${3.5 + i * 0.3}s, 0.35s`,
              }}
            >
              {/* Icon pill */}
              <div
                className="social-item relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:scale-110"
                style={{
                  background: social.bg,
                  boxShadow: `0 4px 18px ${social.glow}`,
                  animationDelay: `${i * 0.06}s`,
                  animationDuration: `${3.5 + i * 0.3}s, 0.35s`,
                }}
              >
                <Icon className="text-[16px] relative z-10" />
                {/* shimmer on hover */}
                <div className="absolute inset-0 rounded-xl bg-white/0 transition-all duration-300 group-hover:bg-white/15" />
              </div>

              {/* Label */}
              <span
                className="whitespace-nowrap rounded-full border border-white/10 bg-[#0f0e0c]/85 px-3 py-1 text-[11px] font-medium tracking-widest text-white/70 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:text-white group-hover:opacity-100"
                style={{ letterSpacing: "0.14em" }}
              >
                {social.name.toUpperCase()}
              </span>
            </Link>
          );
        })}

        {/* Trigger button */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close social links" : "Open social links"}
          className={`social-trigger${open ? " open" : ""} group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c9a84c]/40 bg-[#0f0e0c] text-[#c9a84c] transition-all duration-500 hover:border-[#c9a84c]/80 hover:bg-[#1a1714] hover:scale-110`}
          style={{
            boxShadow: open
              ? `0 0 0 2px rgba(201,168,76,0.35), 0 8px 32px rgba(0,0,0,0.6)`
              : undefined,
          }}
        >
          {/* Gold ring that expands on open */}
          <span
            className="absolute inset-0 rounded-2xl border border-[#c9a84c]/0 transition-all duration-500"
            style={{ borderColor: open ? "rgba(201,168,76,0.3)" : "transparent" }}
          />
          {/* Rotating icon swap */}
          <span
            className="absolute transition-all duration-300"
            style={{
              opacity: open ? 0 : 1,
              transform: open ? "rotate(90deg) scale(0.5)" : "rotate(0deg) scale(1)",
            }}
          >
            <Share2 size={16} strokeWidth={1.5} />
          </span>
          <span
            className="absolute transition-all duration-300"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.5)",
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </span>
        </button>
      </div>
    </>
  );
}