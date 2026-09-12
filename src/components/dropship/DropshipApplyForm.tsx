"use client";

import { useState } from "react";
import Link from "next/link";

const GOLD = "#c9a84c";
const INK = "#1a1714";
const MUTED = "#4d463f";
const BORDER = "#e4dfd2";

const CHANNEL_OPTIONS = [
  "Own Website / Online Store",
  "eBay",
  "Etsy",
  "Amazon",
  "Walmart Marketplace",
  "Facebook / Instagram",
  "Google Shopping",
  "Other",
];

type FormState = {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  website: string;
  sellingChannels: string[];
  message: string;
};

type FormErrors = Partial<Record<keyof Omit<FormState, "sellingChannels">, string[]>>;

const INITIAL_FORM: FormState = {
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  website: "",
  sellingChannels: [],
  message: "",
};

export default function DropshipApplyForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if ((errors as any)[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const toggleChannel = (channel: string) => {
    setForm((prev) => ({
      ...prev,
      sellingChannels: prev.sellingChannels.includes(channel)
        ? prev.sellingChannels.filter((c) => c !== channel)
        : [...prev.sellingChannels, channel],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dropship/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          setErrors(data.errors);
        } else {
          setServerError(
            data.message || "Something went wrong. Please try again."
          );
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl"
          style={{ background: `${GOLD}18` }}
        >
          💎
        </div>
        <h2 className="font-serif text-2xl mb-4" style={{ color: INK }}>
          Application received
        </h2>
        <p className="leading-7 mb-8" style={{ color: MUTED }}>
          Thanks for applying to the Alpha Gemstone Dropship Program. We've
          sent a confirmation to <strong>{form.email}</strong>. Our team
          typically reviews applications within 1–2 business days — once
          approved, we'll email you a private link to your Seller Portal.
        </p>
        <Link
          href="/drop-shipping"
          className="text-sm font-semibold underline underline-offset-4"
          style={{ color: GOLD }}
        >
          ← Back to the Dropship Program
        </Link>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-lg border px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#c9a84c]";

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <p
          className="uppercase tracking-[0.3em] text-[11px] font-bold mb-4"
          style={{ color: GOLD }}
        >
          Free Dropship Program
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl mb-4" style={{ color: INK }}>
          Apply To Start Selling
        </h1>
        <p className="leading-7" style={{ color: MUTED }}>
          No membership fee, no login required. Tell us a bit about your
          business and we'll be in touch.
        </p>
      </div>

      {serverError && (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "#e5b8ab", background: "#fbede8", color: "#a6402b" }}
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[12px] font-semibold mb-2" style={{ color: INK }}>
              Full Name *
            </label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className={fieldClass}
              style={{ borderColor: BORDER }}
              placeholder="Jane Doe"
            />
            {errors.fullName && (
              <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>
                {errors.fullName[0]}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-2" style={{ color: INK }}>
              Business Name
            </label>
            <input
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              className={fieldClass}
              style={{ borderColor: BORDER }}
              placeholder="Jane's Jewelry Co."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[12px] font-semibold mb-2" style={{ color: INK }}>
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={fieldClass}
              style={{ borderColor: BORDER }}
              placeholder="jane@example.com"
            />
            {errors.email && (
              <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>
                {errors.email[0]}
              </p>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-semibold mb-2" style={{ color: INK }}>
              Phone
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className={fieldClass}
              style={{ borderColor: BORDER }}
              placeholder="(555) 555-5555"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold mb-2" style={{ color: INK }}>
            Website or Social Media Profile
          </label>
          <input
            name="website"
            value={form.website}
            onChange={handleChange}
            className={fieldClass}
            style={{ borderColor: BORDER }}
            placeholder="https://instagram.com/janesjewelry"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold mb-3" style={{ color: INK }}>
            Where Do You Plan To Sell?
          </label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((channel) => {
              const active = form.sellingChannels.includes(channel);
              return (
                <button
                  type="button"
                  key={channel}
                  onClick={() => toggleChannel(channel)}
                  className="text-[12px] font-medium rounded-full px-4 py-2 border transition-colors"
                  style={
                    active
                      ? { background: GOLD, borderColor: GOLD, color: "#1a1714" }
                      : { borderColor: BORDER, color: MUTED }
                  }
                >
                  {channel}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold mb-2" style={{ color: INK }}>
            Anything Else We Should Know?
          </label>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={4}
            className={fieldClass}
            style={{ borderColor: BORDER }}
            placeholder="Tell us about your business, audience, or goals"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md px-8 py-4 text-sm font-bold uppercase tracking-wider text-[#1a1714] transition-opacity disabled:opacity-60"
          style={{ background: GOLD }}
        >
          {loading ? "Submitting..." : "Submit Application"}
        </button>

        <p className="text-center text-[12px]" style={{ color: "#9c9388" }}>
          No account or password required. We'll email you a private Seller
          Portal link once approved.
        </p>
      </form>
    </div>
  );
}
