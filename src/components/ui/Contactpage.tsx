// src/app/(shop)/contact/page.tsx
"use client";

import { useState } from "react";

const contactInfo = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
    // Clear field error on change
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
          // Field-level Zod errors e.g. { name: "...", email: "..." }
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
    "w-full bg-white border rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200";

  const inputStyle = (name: keyof FormState) =>
    `${inputBase} ${
      errors[name]
        ? "border-red-400 ring-2 ring-red-400/15"
        : focused === name
        ? "border-[#112c52] ring-2 ring-[#112c52]/10 shadow-sm"
        : "border-slate-200 hover:border-slate-300"
    }`;

  const FieldError = ({ name }: { name: keyof FormState }) =>
    errors[name] ? (
      <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {errors[name]}
      </p>
    ) : null;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      {/* ── Hero ── */}
      <div className="relative bg-[#112c52] overflow-hidden">
        {[600, 450, 300].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/5 pointer-events-none"
            style={{ width: size, height: size, top: "50%", left: "60%", transform: "translate(-50%,-50%)" }}
          />
        ))}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)`,
            backgroundSize: "30px 30px",
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/80 text-xs font-sans font-medium tracking-widest uppercase">
                We'd love to hear from you
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-[1.05] mb-5 tracking-tight">
              Get in
              <br />
              <span className="text-blue-300 italic">Touch</span>
            </h1>
            <p className="text-white/60 text-base font-sans leading-relaxed max-w-md">
              Whether you're a first-time buyer, a seasoned jeweler, or simply curious about our
              collection — our team is here to help.
            </p>
          </div>
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-br from-slate-50 via-white to-blue-50/30"
          style={{ clipPath: "ellipse(55% 100% at 50% 100%)" }}
        />
      </div>

      {/* ── Info Cards ── */}
      <div className="max-w-6xl mx-auto px-6 -mt-1 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {contactInfo.map((item, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#112c52]/30 hover:shadow-lg hover:shadow-[#112c52]/5 transition-all duration-300 cursor-default"
            >
              <div className="w-9 h-9 rounded-xl bg-[#112c52]/8 flex items-center justify-center text-[#112c52] mb-3 group-hover:bg-[#112c52] group-hover:text-white transition-all duration-300">
                {item.icon}
              </div>
              <p className="text-[10px] font-sans font-semibold tracking-widest uppercase text-slate-400 mb-1">
                {item.label}
              </p>
              {item.href ? (
                <a
                  href={item.href}
                  className="text-sm font-semibold text-slate-800 hover:text-[#112c52] transition-colors block leading-tight font-sans"
                >
                  {item.value}
                </a>
              ) : (
                <p className="text-sm font-semibold text-slate-800 font-sans leading-tight">{item.value}</p>
              )}
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main: Form + Map ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Contact Form (3/5) ── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden">
              {/* Form header */}
              <div className="bg-gradient-to-r from-[#112c52] to-[#1a3d6e] px-8 py-6">
                <h2 className="text-xl font-bold text-white mb-1">Send us a Message</h2>
                <p className="text-white/60 text-sm font-sans">We typically respond within 24 hours.</p>
              </div>

              <div className="p-8">
                {submitted ? (
                  /* ── Success State ── */
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#112c52] mb-1">Message Sent!</h3>
                      <p className="text-slate-500 text-sm font-sans max-w-xs">
                        Thank you for reaching out. Our team will get back to you shortly.
                      </p>
                    </div>
                    <button
                      onClick={resetForm}
                      className="mt-2 px-5 py-2 rounded-xl bg-[#112c52] text-white text-sm font-sans font-semibold hover:bg-[#1a3d6e] transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  /* ── Form ── */
                  <form onSubmit={handleSubmit} className="space-y-5 font-sans" noValidate>

                    {/* Server-level error banner */}
                    {serverError && (
                      <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        {serverError}
                      </div>
                    )}

                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1.5">
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
                        <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1.5">
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
                        <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1.5">
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
                        <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1.5">
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
                      <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1.5">
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
                        <span className={`text-xs mt-1.5 ml-auto ${form.message.length > 1800 ? "text-red-400" : "text-slate-400"}`}>
                          {form.message.length}/2000
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-slate-400">* Required fields</p>
                      <button
                        type="submit"
                        disabled={loading}
                        className="group flex items-center gap-2 bg-[#112c52] hover:bg-[#1a3d6e] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-[#112c52]/20 hover:shadow-[#112c52]/30 hover:-translate-y-0.5 disabled:hover:translate-y-0"
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
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden flex-1">
              <div className="bg-gradient-to-r from-[#112c52] to-[#1a3d6e] px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Find Us</h2>
                  <p className="text-white/60 text-xs font-sans">New York City, NY</p>
                </div>
                <a
                  href="https://maps.google.com/?q=New+York+City,+NY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-sans font-semibold text-blue-300 hover:text-white transition-colors flex items-center gap-1"
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
                  style={{ border: 0, filter: "saturate(0.85) contrast(1.05)" }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d193595.25280949865!2d-74.11976385098924!3d40.69766374859258!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c24fa5d33f083b%3A0xc80b8f06e177fe62!2sNew%20York%2C%20NY%2C%20USA!5e0!3m2!1sen!2sin!4v1716000000000!5m2!1sen!2sin"
                />
              </div>
              <div className="px-5 py-4 border-t border-slate-100">
                <p className="text-xs font-sans text-slate-500 flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 text-[#112c52] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Please call at least a day in advance to schedule a dedicated showroom visit. Bring personal &amp; business ID.
                </p>
              </div>
            </div>

            {/* Appointment CTA */}
            <div className="bg-[#112c52] rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-blue-400/10 pointer-events-none" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-base mb-1">Book a Showroom Visit</h3>
                <p className="text-white/60 text-xs font-sans leading-relaxed mb-4">
                  Browse our full collection in person. One of our specialists will be dedicated to
                  you throughout your visit.
                </p>
                <a
                  href="tel:9143101480"
                  className="inline-flex items-center gap-2 bg-white text-[#112c52] px-4 py-2.5 rounded-xl text-sm font-sans font-semibold hover:bg-blue-50 transition-colors shadow-lg shadow-black/10"
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
      <div className="border-t border-slate-200 bg-white mt-4">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Your Gemstone Store. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Secure 128-bit SSL</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>30-day returns</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>Ships worldwide</span>
          </div>
        </div>
      </div>
    </div>
  );
}