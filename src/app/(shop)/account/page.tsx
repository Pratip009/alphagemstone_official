// src/app/(shop)/account/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/**
 * ── Palette (flat, no gradients) — shared with /contact ──
 * ink        #15181C   near-black, header / footer panels
 * paper      #F7F4EE   warm ivory page background
 * card       #FFFDF9   card surface
 * brass      #A9814A   primary accent
 * brass-dark #8C6A3A   brass hover state
 * emerald    #1F4D3E   secondary accent
 * ash        #6B6459   body / muted text
 * ash-light  #96907F   captions
 * line       #E4DFD2   hairline borders
 * rust       #A6402B   error state
 * rust-bg    #FBEDE8   error background
 */

type AddressState = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type FormState = {
  name: string;
  phone: string;
  address: AddressState;
};

type FormErrors = {
  name?: string;
  phone?: string;
  avatar?: string;
  address?: Partial<Record<keyof AddressState, string>>;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;
const REQUIRED_ADDRESS_KEYS: (keyof AddressState)[] = [
  "line1",
  "city",
  "state",
  "postalCode",
  "country",
];

const EMPTY_ADDRESS: AddressState = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

function initialsFrom(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, updateUser, logout } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    address: EMPTY_ADDRESS,
  });
  const [hydrated, setHydrated] = useState(false);

  // Newly-picked file staged for upload (not yet saved).
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // Local base64 preview of the staged file above.
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  // True when the user has asked to clear their already-saved avatar.
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect unauthenticated visitors — this page needs a session.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?redirect=/account");
    }
  }, [authLoading, user, router]);

  // Hydrate the form from the session exactly once, so it doesn't clobber
  // in-progress edits if `user` is refreshed elsewhere in the app.
  useEffect(() => {
    if (user && !hydrated) {
      setForm({
        name: user.name ?? "",
        phone: user.phone ?? "",
        address: {
          line1: user.address?.line1 ?? "",
          line2: user.address?.line2 ?? "",
          city: user.address?.city ?? "",
          state: user.address?.state ?? "",
          postalCode: user.address?.postalCode ?? "",
          country: user.address?.country ?? "",
        },
      });
      setHydrated(true);
    }
  }, [user, hydrated]);

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  const displayedAvatar =
    pendingPreview ?? (avatarRemoved ? null : user?.avatarUrl || null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setSaved(false);

    if (name in form.address) {
      setForm((prev) => ({ ...prev, address: { ...prev.address, [name]: value } }));
      setErrors((prev) => ({ ...prev, address: { ...prev.address, [name]: undefined } }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, avatar: "Please upload a JPG, PNG, or WebP image." }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErrors((prev) => ({ ...prev, avatar: "Image must be smaller than 5MB." }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: undefined }));
    setAvatarFile(file);
    setAvatarRemoved(false);
    setSaved(false);

    const reader = new FileReader();
    reader.onload = () => setPendingPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    if (avatarFile) {
      // Discard the pending, not-yet-saved selection and fall back to
      // whatever avatar (if any) is already saved on the account.
      setAvatarFile(null);
      setPendingPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      // Nothing pending — this clears the avatar that's actually saved.
      setAvatarRemoved(true);
      setPendingPreview(null);
    }
    setErrors((prev) => ({ ...prev, avatar: undefined }));
    setSaved(false);
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};

    if (!form.name.trim()) {
      next.name = "Full name is required.";
    } else if (form.name.trim().length > 100) {
      next.name = "Name cannot exceed 100 characters.";
    }

    if (form.phone && !PHONE_REGEX.test(form.phone.trim())) {
      next.phone = "Enter a valid phone number.";
    }

    const addressTouched = Object.values(form.address).some((v) => v.trim().length > 0);
    if (addressTouched) {
      const addressErrors: Partial<Record<keyof AddressState, string>> = {};
      for (const key of REQUIRED_ADDRESS_KEYS) {
        if (!form.address[key].trim()) {
          addressErrors[key] = "This field is required.";
        }
      }
      if (
        form.address.postalCode &&
        !/^[a-zA-Z0-9\s-]{3,12}$/.test(form.address.postalCode.trim())
      ) {
        addressErrors.postalCode = "Enter a valid postal code.";
      }
      if (Object.keys(addressErrors).length > 0) {
        next.address = addressErrors;
      }
    }

    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("name", form.name.trim());
      payload.append("phone", form.phone.trim());
      Object.entries(form.address).forEach(([key, value]) =>
        payload.append(`address[${key}]`, value.trim())
      );
      if (avatarFile) {
        payload.append("avatar", avatarFile);
      } else if (avatarRemoved) {
        payload.append("removeAvatar", "true");
      }

      const res = await fetch("/api/account", {
        method: "PATCH",
        credentials: "include",
        body: payload,
      });

      if (res.status === 401) {
        await logout();
        router.replace("/login?redirect=/account");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          setErrors(data.errors);
        } else {
          setServerError(data.message || "Something went wrong. Please try again.");
        }
        return;
      }

      // Sync the shared auth context immediately — this is what makes the
      // navbar's name/avatar update without a page refresh.
      updateUser(data.data);
      setForm({
        name: data.data.name ?? "",
        phone: data.data.phone ?? "",
        address: {
          line1: data.data.address?.line1 ?? "",
          line2: data.data.address?.line2 ?? "",
          city: data.data.address?.city ?? "",
          state: data.data.address?.state ?? "",
          postalCode: data.data.address?.postalCode ?? "",
          country: data.data.address?.country ?? "",
        },
      });
      setAvatarFile(null);
      setPendingPreview(null);
      setAvatarRemoved(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 4000);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Shared field styles ──
  const inputBase =
    "w-full bg-white border rounded-lg px-4 py-3 text-sm text-[#23201A] placeholder:text-[#B3AC9A] outline-none transition-all duration-200";

  const inputStyle = (name: string, hasError?: boolean) =>
    `${inputBase} ${
      hasError
        ? "border-[#A6402B] ring-2 ring-[#A6402B]/10"
        : focused === name
        ? "border-[#A9814A] ring-2 ring-[#A9814A]/15"
        : "border-[#E4DFD2] hover:border-[#CFC7B0]"
    }`;

  const FieldError = ({ message }: { message?: string }) =>
    message ? (
      <p className="text-[#A6402B] text-xs mt-1.5 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {message}
      </p>
    ) : null;

  // ── Loading / auth-gate states ──
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F7F4EE]">
        <svg className="w-6 h-6 animate-spin text-[#A9814A]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-[#6B6459]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
          Loading your account…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F4EE]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
      {/* Google Sans Flex — Next.js hoists <link> tags rendered in the tree into <head> automatically */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500;600;700&display=swap"
      />

      {/* ── Header ── */}
      <div className="relative bg-[#15181C] overflow-hidden w-full">
        <svg
          className="absolute right-0 top-0 h-full w-[40%] opacity-[0.12] pointer-events-none"
          viewBox="0 0 500 500"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <polygon points="250,40 380,140 340,300 160,300 120,140" stroke="#C9A876" strokeWidth="1.2" />
          <polygon points="250,190 250,460" stroke="#C9A876" strokeWidth="1" />
          <polygon points="160,300 250,460 340,300" stroke="#C9A876" strokeWidth="1" />
          <circle cx="250" cy="190" r="3" fill="#C9A876" />
        </svg>
        <div className="relative z-10 w-full px-6 md:px-10 xl:px-16 py-14 md:py-16">
          <p className="text-[#C9A876] text-xs font-semibold tracking-[0.15em] uppercase mb-3">
            Account
          </p>
          <h1
            className="text-4xl md:text-5xl text-white tracking-tight"
            style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
          >
            Your Profile
          </h1>
          <p className="text-white/55 text-base mt-3 max-w-md">
            Update your photo and shipping address. Your email stays fixed to keep your account secure.
          </p>
        </div>
      </div>

      {/* ── Main ── */}
      <form onSubmit={handleSubmit} className="w-full px-6 md:px-10 xl:px-16 -mt-8 relative z-10 pb-16" noValidate>

        {/* Top-level banners */}
        {serverError && (
          <div className="flex items-start gap-3 bg-[#FBEDE8] border border-[#A6402B]/25 text-[#A6402B] rounded-lg px-4 py-3 text-sm mb-6">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Photo card (2/5) ── */}
          <div className="lg:col-span-2">
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#E4DFD2] shadow-xl shadow-black/[0.04] overflow-hidden">
              <div className="bg-[#1F4D3E] px-6 py-4">
                <h2 className="text-base text-white" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>
                  Profile Photo
                </h2>
                <p className="text-white/60 text-xs mt-0.5">Shown on your orders and reviews.</p>
              </div>

              <div className="p-8 flex flex-col items-center text-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-[#E4DFD2] bg-[#1F4D3E]/8 flex items-center justify-center">
                    {displayedAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayedAvatar} alt="Your profile photo" className="w-full h-full object-cover" />
                    ) : (
                      <span
                        className="text-3xl text-[#1F4D3E]"
                        style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
                      >
                        {initialsFrom(form.name || user?.name || "")}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAvatarPick}
                    aria-label="Change profile photo"
                    className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#A9814A] hover:bg-[#8C6A3A] text-white flex items-center justify-center border-4 border-[#FFFDF9] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />

                <div className="flex items-center gap-3 mt-5">
                  <button
                    type="button"
                    onClick={handleAvatarPick}
                    className="text-sm font-semibold text-[#A9814A] hover:text-[#8C6A3A] transition-colors"
                  >
                    Upload new photo
                  </button>
                  {displayedAvatar && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-[#CFC7B0]" />
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="text-sm font-semibold text-[#96907F] hover:text-[#A6402B] transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-[#96907F] mt-3">JPG, PNG, or WebP · up to 5MB</p>
                <FieldError message={errors.avatar} />
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#E4DFD2] shadow-xl shadow-black/[0.04] overflow-hidden mt-6">
              <div className="bg-[#15181C] px-6 py-4">
                <h2 className="text-base text-white" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>
                  Quick Links
                </h2>
                <p className="text-white/55 text-xs mt-0.5">Jump to the rest of your account.</p>
              </div>

              <nav className="p-2">
                {[
                  {
                    href: "/orders",
                    label: "My Orders",
                    sub: "Track, review, and reorder",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    ),
                  },
                  {
                    href: "/wishlist-saved",
                    label: "Wishlist",
                    sub: "Items you've saved",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
                    ),
                  },
                  {
                    href: "/cart",
                    label: "Shopping Cart",
                    sub: "Review items before checkout",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3.6-8H5.4M7 13L5.4 5M7 13l-1.6 4h11.2M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
                    ),
                  },
                  {
                    href: "/where-is-my-order",
                    label: "Track an Order",
                    sub: "Real-time shipping status",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    ),
                  },
                  {
                    href: "/help-center",
                    label: "Help Center",
                    sub: "FAQs and support",
                    icon: (
                      <>
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2 1.75-2 3.25M12 16.5h.01" />
                      </>
                    ),
                  },
                  {
                    href: "/contact",
                    label: "Contact Us",
                    sub: "Get in touch with our team",
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
                    ),
                  },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-[#1F4D3E]/[0.06]"
                  >
                    <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1F4D3E]/8 text-[#1F4D3E] flex items-center justify-center group-hover:bg-[#1F4D3E] group-hover:text-white transition-colors duration-150">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        {link.icon}
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-[#23201A]">{link.label}</span>
                      <span className="block text-xs text-[#96907F] truncate">{link.sub}</span>
                    </span>
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-[#CFC7B0] group-hover:text-[#A9814A] group-hover:translate-x-0.5 transition-all duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* ── Details (3/5) ── */}
          <div className="lg:col-span-3 flex flex-col gap-6">

            {/* Personal info */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#E4DFD2] shadow-xl shadow-black/[0.04] overflow-hidden">
              <div className="bg-[#15181C] px-6 py-4">
                <h2 className="text-base text-white" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>
                  Personal Info
                </h2>
              </div>
              <div className="p-6 space-y-5">
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
                    className={inputStyle("name", !!errors.name)}
                  />
                  <FieldError message={errors.name} />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                    Email
                    <svg className="w-3 h-3 text-[#96907F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    readOnly
                    aria-readonly="true"
                    className="w-full bg-[#F1EEE5] border border-[#E4DFD2] rounded-lg px-4 py-3 text-sm text-[#6B6459] cursor-not-allowed"
                  />
                  <p className="text-[11px] text-[#96907F] mt-1.5">
                    Your email can't be changed here. Contact support if you need it updated.
                  </p>
                </div>

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
                    className={inputStyle("phone", !!errors.phone)}
                  />
                  <FieldError message={errors.phone} />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#E4DFD2] shadow-xl shadow-black/[0.04] overflow-hidden">
              <div className="bg-[#15181C] px-6 py-4">
                <h2 className="text-base text-white" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>
                  Shipping Address
                </h2>
                <p className="text-white/55 text-xs mt-0.5">Used by default at checkout.</p>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                    Address Line 1 *
                  </label>
                  <input
                    name="line1"
                    value={form.address.line1}
                    onChange={handleChange}
                    onFocus={() => setFocused("line1")}
                    onBlur={() => setFocused(null)}
                    placeholder="123 Fifth Avenue"
                    className={inputStyle("line1", !!errors.address?.line1)}
                  />
                  <FieldError message={errors.address?.line1} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                    Address Line 2
                  </label>
                  <input
                    name="line2"
                    value={form.address.line2}
                    onChange={handleChange}
                    onFocus={() => setFocused("line2")}
                    onBlur={() => setFocused(null)}
                    placeholder="Apartment, suite, etc. (optional)"
                    className={inputStyle("line2", !!errors.address?.line2)}
                  />
                  <FieldError message={errors.address?.line2} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                      City *
                    </label>
                    <input
                      name="city"
                      value={form.address.city}
                      onChange={handleChange}
                      onFocus={() => setFocused("city")}
                      onBlur={() => setFocused(null)}
                      placeholder="New York"
                      className={inputStyle("city", !!errors.address?.city)}
                    />
                    <FieldError message={errors.address?.city} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                      State / Province *
                    </label>
                    <input
                      name="state"
                      value={form.address.state}
                      onChange={handleChange}
                      onFocus={() => setFocused("state")}
                      onBlur={() => setFocused(null)}
                      placeholder="NY"
                      className={inputStyle("state", !!errors.address?.state)}
                    />
                    <FieldError message={errors.address?.state} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                      Postal Code *
                    </label>
                    <input
                      name="postalCode"
                      value={form.address.postalCode}
                      onChange={handleChange}
                      onFocus={() => setFocused("postalCode")}
                      onBlur={() => setFocused(null)}
                      placeholder="10001"
                      className={inputStyle("postalCode", !!errors.address?.postalCode)}
                    />
                    <FieldError message={errors.address?.postalCode} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A4638] tracking-wide uppercase mb-1.5">
                      Country *
                    </label>
                    <select
                      name="country"
                      value={form.address.country}
                      onChange={handleChange}
                      onFocus={() => setFocused("country")}
                      onBlur={() => setFocused(null)}
                      className={inputStyle("country", !!errors.address?.country)}
                    >
                      <option value="">Select a country</option>
                      <option>United States</option>
                      <option>Canada</option>
                      <option>United Kingdom</option>
                      <option>Australia</option>
                      <option>India</option>
                      <option>Other</option>
                    </select>
                    <FieldError message={errors.address?.country} />
                  </div>
                </div>
              </div>
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {saved && (
                  <span className="flex items-center gap-1.5 text-[#1F4D3E] font-semibold">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Changes saved
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="group flex items-center gap-2 bg-[#A9814A] hover:bg-[#8C6A3A] disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg shadow-[#A9814A]/20 hover:-translate-y-0.5 disabled:hover:translate-y-0"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}