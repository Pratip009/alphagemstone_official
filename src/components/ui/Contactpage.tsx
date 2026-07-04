// src/app/(shop)/contact/page.tsx
"use client";

import { useState } from "react";

/**
 * ── Palette (flat, no gradients) ──
 * ink        #15181C   near-black, hero / footer accents
 * paper      #F7F4EE   warm ivory page background
 * card       #FFFDF9   card surface, slightly lifted off paper
 * brass      #A9814A   primary accent (was blue-900)
 * brass-dark #8C6A3A   brass hover state
 * emerald    #1F4D3E   secondary accent (map header, icon chips)
 * ash        #6B6459   body / muted text
 * ash-light  #96907F   captions
 * line       #E4DFD2   hairline borders
 * rust       #A6402B   error state
 * rust-bg    #FBEDE8   error background
 */

const contactInfo = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.1 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.18 7.84a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
    label: "Phone",
    value: "914-310-1480",
    sub: "Mon–Fri, 9am–6pm EST",
    href: "tel:9143101480",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    label: "Fax",
    value: "212-768-0599",
    sub: "Send documents anytime",
    href: "fax:2127680599",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    label: "Location",
    value: "New York City, NY",
    sub: "By appointment only",
    href: "https://maps.google.com/?q=New+York+City,+NY",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: "Business Hours",
    value: "Mon – Fri: 9am – 6pm",
    sub: "Weekends by arrangement",
    href: null,
  },
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors]           = useState<FormErrors>({});
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted]     = useState(false);
  const [focused, setFocused]         = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);
    setLoading(true);

    try {
      const res  = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          setErrors(data.errors);
        } else {
          setServerError(data.message || "Something went wrong. Please try again.");
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setErrors({});
    setServerError(null);
    setForm({ name: "", email: "", phone: "", subject: "", message: "" });
  };

  // ── Styles ──
  const inputBase =
    "w-full bg-white border rounded-lg px-4 py-3 text-sm text-[#23201A] placeholder:text-[#B3AC9A] outline-none transition-all duration-200";

  const inputStyle = (name: keyof FormState) =>
    `${inputBase} ${
      errors[name]
        ? "border-[#A6402B] ring-2 ring-[#A6402B]/10"
        : focused === name
        ? "border-[#A9814A] ring-2 ring-[#A9814A]/15"
        : "border-[#E4DFD2] hover:border-[#CFC7B0]"
    }`;

  const FieldError = ({ name }: { name: keyof FormState }) =>
    errors[name] ? (
      <p className="text-[#A6402B] text-xs mt-1.5 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {errors[name]}
      </p>
    ) : null;

  return (
    <div className="min-h-screen bg-[#F7F4EE]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
      {/* Google Sans Flex — Next.js hoists <link> tags rendered in the tree into <head> automatically */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500;600;700&display=swap"
      />

      {/* ── Hero ── */}
      <div className="relative bg-[#15181C] overflow-hidden">
        {/* faceted gem-cut motif — signature element, replaces glow blobs */}
        <svg
          className="absolute right-0 top-0 h-full w-[52%] opacity-[0.14] pointer-events-none"
          viewBox="0 0 500 500"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <polygon points="250,40 380,140 340,300 160,300 120,140" stroke="#C9A876" strokeWidth="1.2" />
          <polygon points="250,40 250,190" stroke="#C9A876" strokeWidth="1" />
          <polygon points="120,140 250,190 380,140" stroke="#C9A876" strokeWidth="1" />
          <polygon points="160,300 250,190 340,300" stroke="#C9A876" strokeWidth="1" />
          <polygon points="250,190 250,460" stroke="#C9A876" strokeWidth="1" />
          <polygon points="160,300 250,460 340,300" stroke="#C9A876" strokeWidth="1" />
          <circle cx="250" cy="190" r="3" fill="#C9A876" />
        </svg>

        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 border border-[#C9A876]/30 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A876]" />
              <span className="text-[#C9A876] text-xs font-semibold tracking-[0.15em] uppercase">
                We'd love to hear from you
              </span>
            </div>
            <h1
              className="text-5xl md:text-6xl text-white leading-[1.05] mb-5 tracking-tight"
              style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
            >
              Get in
              <br />
              <span className="text-[#C9A876] italic">Touch</span>
            </h1>
            <p className="text-white/55 text-base leading-relaxed max-w-md">
              Whether you're a first-time buyer, a seasoned jeweler, or simply curious about our
              collection — our team is here to help.
            </p>
          </div>
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div className="max-w-6xl mx-auto px-6 -mt-8 relative z-10 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {contactInfo.map((item, i) => (
            <div
              key={i}
              className="group bg-[#FFFDF9] rounded-xl border border-[#E4DFD2] p-4 hover:border-[#A9814A]/40 hover:shadow-lg hover:shadow-black/5 transition-all duration-300 cursor-default"
            >
              <div className="w-9 h-9 rounded-lg bg-[#1F4D3E]/8 flex items-center justify-center text-[#1F4D3E] mb-3 group-hover:bg-[#1F4D3E] group-hover:text-white transition-all duration-300">
                {item.icon}
              </div>
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#96907F] mb-1">
                {item.label}
              </p>
              {item.href ? (
                <a
                  href={item.href}
                  className="text-sm font-semibold text-[#23201A] hover:text-[#A9814A] transition-colors block leading-tight"
                >
                  {item.value}
                </a>
              ) : (
                <p className="text-sm font-semibold text-[#23201A] leading-tight">{item.value}</p>
              )}
              <p className="text-[11px] text-[#96907F] mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main: Form + Map ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Contact Form (3/5) ── */}
          <div className="lg:col-span-3">
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#E4DFD2] shadow-xl shadow-black/[0.04] overflow-hidden">
              <div className="bg-[#15181C] px-8 py-6">
                <h2
                  className="text-xl text-white mb-1"
                  style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
                >
                  Send us a Message
                </h2>
                <p className="text-white/55 text-sm">We typically respond within 24 hours.</p>
              </div>

              <div className="p-8">
                {submitted ? (
                  /* ── Success State ── */
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#1F4D3E]/8 border-2 border-[#1F4D3E]/25 flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#1F4D3E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3
                        className="text-xl text-[#15181C] mb-1"
                        style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
                      >
                        Message Sent!
                      </h3>
                      <p className="text-[#6B6459] text-sm max-w-xs">
                        Thank you for reaching out. Our team will get back to you shortly.
                      </p>
                    </div>
                    <button
                      onClick={resetForm}
                      className="mt-2 px-5 py-2 rounded-lg bg-[#15181C] text-white text-sm font-semibold hover:bg-[#272B31] transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  /* ── Form ── */
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                    {serverError && (
                      <div className="flex items-start gap-3 bg-[#FBEDE8] border border-[#A6402B]/25 text-[#A6402B] rounded-lg px-4 py-3 text-sm">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        {serverError}
                      </div>
                    )}

                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                          Full Name *
                        </label>
                        <input
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          onFocus={() => setFocused("name")}
                          onBlur={() => setFocused(null)}
                          placeholder="Jane Smith"
                          className={inputStyle("name")}
                        />
                        <FieldError name="name" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                          Email *
                        </label>
                        <input
                          name="email"
                          type="email"
                          value={form.email}
                          onChange={handleChange}
                          onFocus={() => setFocused("email")}
                          onBlur={() => setFocused(null)}
                          placeholder="jane@example.com"
                          className={inputStyle("email")}
                        />
                        <FieldError name="email" />
                      </div>
                    </div>

                    {/* Phone + Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                          Phone
                        </label>
                        <input
                          name="phone"
                          type="tel"
                          value={form.phone}
                          onChange={handleChange}
                          onFocus={() => setFocused("phone")}
                          onBlur={() => setFocused(null)}
                          placeholder="+1 (555) 000-0000"
                          className={inputStyle("phone")}
                        />
                        <FieldError name="phone" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                          Subject *
                        </label>
                        <select
                          name="subject"
                          value={form.subject}
                          onChange={handleChange}
                          onFocus={() => setFocused("subject")}
                          onBlur={() => setFocused(null)}
                          className={inputStyle("subject")}
                        >
                          <option value="">Select a topic…</option>
                          <option>Product Inquiry</option>
                          <option>Order &amp; Shipping</option>
                          <option>Returns &amp; Refunds</option>
                          <option>Custom / Resize Order</option>
                          <option>Wholesale / Bulk</option>
                          <option>Showroom Visit</option>
                          <option>Other</option>
                        </select>
                        <FieldError name="subject" />
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                        Message *
                      </label>
                      <textarea
                        name="message"
                        rows={5}
                        value={form.message}
                        onChange={handleChange}
                        onFocus={() => setFocused("message")}
                        onBlur={() => setFocused(null)}
                        placeholder="Tell us what you're looking for, or ask us anything…"
                        className={`${inputStyle("message")} resize-none`}
                      />
                      <div className="flex items-start justify-between">
                        <FieldError name="message" />
                        <span className={`text-xs mt-1.5 ml-auto ${form.message.length > 1800 ? "text-[#A6402B]" : "text-[#96907F]"}`}>
                          {form.message.length}/2000
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-[#96907F]">* Required fields</p>
                      <button
                        type="submit"
                        disabled={loading}
                        className="group flex items-center gap-2 bg-[#A9814A] hover:bg-[#8C6A3A] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg shadow-[#A9814A]/20 hover:-translate-y-0.5 disabled:hover:translate-y-0"
                      >
                        {loading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sending…
                          </>
                        ) : (
                          <>
                            Send Message
                            <svg
                              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* ── Map + Appointment (2/5) ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Map */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#E4DFD2] shadow-xl shadow-black/[0.04] overflow-hidden flex-1">
              <div className="bg-[#1F4D3E] px-6 py-4 flex items-center justify-between">
                <div>
                  <h2
                    className="text-base text-white"
                    style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
                  >
                    Find Us
                  </h2>
                  <p className="text-white/60 text-xs">New York City, NY</p>
                </div>
                <a
                  href="https://maps.google.com/?q=New+York+City,+NY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#C9A876] hover:text-white transition-colors flex items-center gap-1"
                >
                  Open in Maps
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <div className="relative" style={{ paddingBottom: "65%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 0, filter: "saturate(0.8) contrast(1.05) sepia(0.06)" }}
                  loading="lazy"
                  allowFullScreen
                  src="https://www.google.com/maps?q=New+York+City,+NY&output=embed"
                />
              </div>
              <div className="px-5 py-4 border-t border-[#E4DFD2]">
                <p className="text-xs text-[#6B6459] flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-[#1F4D3E] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Please call at least a day in advance to schedule a dedicated showroom visit. Bring personal &amp; business ID.
                </p>
              </div>
            </div>

            {/* Appointment CTA */}
            <div className="bg-[#15181C] rounded-2xl p-6 relative overflow-hidden">
              <svg className="absolute -right-6 -bottom-8 w-40 h-40 opacity-[0.16] pointer-events-none" viewBox="0 0 200 200" fill="none">
                <polygon points="100,10 160,55 140,130 60,130 40,55" stroke="#C9A876" strokeWidth="1" />
              </svg>
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-lg border border-[#C9A876]/30 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-[#C9A876]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3
                  className="text-white text-base mb-1"
                  style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
                >
                  Book a Showroom Visit
                </h3>
                <p className="text-white/55 text-xs leading-relaxed mb-4">
                  Browse our full collection in person. One of our specialists will be dedicated to
                  you throughout your visit.
                </p>
                <a
                  href="tel:9143101480"
                  className="inline-flex items-center gap-2 bg-[#C9A876] text-[#15181C] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#D8BB8F] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call 914-310-1480
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom strip ── */}
      <div className="border-t border-[#E4DFD2] bg-[#FFFDF9] mt-4">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#96907F]">
            © {new Date().getFullYear()} Your Gemstone Store. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#96907F]">
            <span>Secure 128-bit SSL</span>
            <span className="w-1 h-1 rounded-full bg-[#CFC7B0]" />
            <span>30-day returns</span>
            <span className="w-1 h-1 rounded-full bg-[#CFC7B0]" />
            <span>Ships worldwide</span>
          </div>
        </div>
      </div>
    </div>
  );
}