"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const GOLD = "#c9a84c";
const INK = "#1a1714";
const MUTED = "#4d463f";
const BORDER = "#e4dfd2";
const CREAM = "#fffdf9";

// Same lists as the main checkout (src/app/(shop)/checkout/page.tsx) — a
// free-text state field is what caused "state_province must be two
// characters" ShipStation errors; a real dropdown makes that impossible.
const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "Washington D.C."],
];
const CA_PROVINCES = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
];

type Application = {
  fullName: string;
  businessName?: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  active: boolean;
  createdAt: string;
};

type Order = {
  _id: string;
  productName: string;
  productImage?: string;
  unitPrice: number;
  quantity: number;
  productAmount: number;
  amount: number;
  shippingCarrier?: string;
  shippingService?: string;
  shippingCost: number;
  serviceFee: number;
  customerName: string;
  city: string;
  country: string;
  status: string;
  paymentStatus: "pending" | "completed" | "failed";
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  createdAt: string;
};

type ProductResult = {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  image?: string;
  legacySku?: string;
  watchModel?: string;
  category?: { name: string };
  subcategory?: { name: string };
};

type ShippingRate = {
  carrier: string;
  carrierId: string;
  service: string;
  serviceCode: string;
  rateId: string;
  rate: number;
  costWithFee: number;
  currency: string;
  estimatedDays: number | null;
  estimatedDelivery: string | null;
};

const ORDER_FORM_INITIAL = {
  quantity: "1",
  specifications: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  specialInstructions: "",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "#9c7a1f",
  processing: "#1f6fa6",
  shipped: "#1f4d3e",
  delivered: "#1f4d3e",
  cancelled: "#a6402b",
};
const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const PAYMENT_COLORS: Record<string, string> = {
  pending: "#9c7a1f",
  completed: "#1f4d3e",
  failed: "#a6402b",
};

const paypalOptions = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
  currency: "USD",
};

function productImageOf(p: ProductResult): string | undefined {
  return p.images?.[0] || p.image;
}
function productCodeOf(p: ProductResult): string | undefined {
  return p.legacySku || p.watchModel;
}
function categoryPathOf(p: ProductResult): string | undefined {
  return [p.category?.name, p.subcategory?.name].filter(Boolean).join(" › ") || undefined;
}

/**
 * Ranks results so the most useful match is always first: an exact (or
 * prefix) model/SKU match beats a name match, which beats a description-
 * only match. Mirrors the intent of SearchBar.tsx's scoreProduct without
 * importing its internals (that function isn't exported).
 */
function rankProducts(products: ProductResult[], query: string): ProductResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;

  const scoreOf = (p: ProductResult): number => {
    const code = (productCodeOf(p) || "").toLowerCase();
    const name = p.name.toLowerCase();
    if (code && code === q) return 0; // exact model/SKU match
    if (code && code.startsWith(q)) return 1;
    if (code && code.includes(q)) return 2;
    if (name.startsWith(q)) return 3;
    if (name.includes(q)) return 4;
    return 5; // matched on some other field (description, etc.)
  };

  return [...products].sort((a, b) => scoreOf(a) - scoreOf(b));
}

/** Bolds the first occurrence of `query` inside `text` (case-insensitive). */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: INK, fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function DropshipPortal({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(ORDER_FORM_INITIAL);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Product picker — searches the real catalog by name, description, or
  // model/SKU number (legacySku / watchModel), same fields the storefront's
  // own search uses (see /api/products/search).
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchAbort = useRef<AbortController | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Shipping — real ShipEngine rates for the customer's address, same
  // origin/package/service-fee logic as normal customer checkout.
  const [shippingRates, setShippingRates] = useState<ShippingRate[] | null>(null);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  // Payment
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    try {
      const res = await fetch(`/api/dropship/portal/${token}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setApplication(data.data.application);
      setOrders(data.data.orders);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  // Debounced product search against the real catalog — matches on name,
  // description, and model/SKU number, so typing a model number surfaces
  // the exact product (same endpoint the storefront search bar uses).
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIdx(-1);
      return;
    }
    const handle = setTimeout(async () => {
      searchAbort.current?.abort();
      const controller = new AbortController();
      searchAbort.current = controller;
      setSearching(true);
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(query)}&limit=10`,
          { signal: controller.signal }
        );
        const data = await res.json();
        const list: ProductResult[] = Array.isArray(data) ? data : data?.data ?? [];
        setResults(rankProducts(list, query));
        setActiveIdx(-1);
      } catch {
        // aborted or failed — ignore, next keystroke will retry
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Click outside the search box closes the results dropdown.
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const chooseProduct = (p: ProductResult) => {
    setSelectedProduct(p);
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < results.length) chooseProduct(results[activeIdx]);
    } else if (e.key === "Escape") {
      setResults([]);
      setActiveIdx(-1);
    }
  };

  const addressComplete =
    form.addressLine1.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.postalCode.trim() &&
    form.country.trim();

  // Any address edit invalidates a previously fetched/selected rate — the
  // seller must re-quote before continuing, so we never charge shipping
  // for the wrong destination.
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Changing country invalidates whatever state was picked for the
      // previous country's dropdown options.
      ...(name === "country" ? { state: "" } : {}),
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined as any }));
    if (["addressLine1", "addressLine2", "city", "state", "postalCode", "country"].includes(name)) {
      setShippingRates(null);
      setSelectedRate(null);
      setRatesError(null);
    }
  };

  const fetchRates = async () => {
    setFetchingRates(true);
    setRatesError(null);
    setShippingRates(null);
    setSelectedRate(null);
    try {
      const res = await fetch(`/api/dropship/portal/${token}/shipping-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street1: form.addressLine1,
          street2: form.addressLine2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRatesError(data.message || "Could not fetch shipping rates for this address.");
        return;
      }
      setShippingRates(data.data.rates || []);
    } catch {
      setRatesError("Network error fetching shipping rates. Please try again.");
    } finally {
      setFetchingRates(false);
    }
  };

  const resetOrderForm = () => {
    setForm(ORDER_FORM_INITIAL);
    setSelectedProduct(null);
    setQuery("");
    setResults([]);
    setShippingRates(null);
    setSelectedRate(null);
    setRatesError(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    if (!selectedProduct) {
      setServerError("Please select a product first.");
      return;
    }
    if (!selectedRate) {
      setServerError("Please choose a shipping method before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dropship/portal/${token}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productId: selectedProduct._id,
          quantity: parseInt(form.quantity, 10) || 1,
          shippingSelection: {
            carrier: selectedRate.carrier,
            service: selectedRate.service,
            serviceCode: selectedRate.serviceCode,
            rateId: selectedRate.rateId,
            rate: selectedRate.rate,
            estimatedDays: selectedRate.estimatedDays ?? undefined,
            estimatedDelivery: selectedRate.estimatedDelivery ?? undefined,
          },
        }),
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

      const newOrderId = data.data.orderId;
      resetOrderForm();
      await loadPortal();
      // Jump straight into payment for the order just created.
      setPayingOrderId(newOrderId);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center" style={{ color: MUTED }}>
        Loading your portal…
      </div>
    );
  }

  if (notFound || !application) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-2xl mb-4" style={{ color: INK }}>
          Portal link not found
        </h1>
        <p style={{ color: MUTED }}>
          This dropship portal link isn't valid. If you believe this is an
          error, please contact us at{" "}
          <a href="mailto:info@alphagemimports.com" style={{ color: GOLD }}>
            info@alphagemimports.com
          </a>
          .
        </p>
      </div>
    );
  }

  if (application.status === "pending") {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl" style={{ background: `${GOLD}18` }}>
          ⏳
        </div>
        <h1 className="font-serif text-2xl mb-4" style={{ color: INK }}>
          Application under review
        </h1>
        <p style={{ color: MUTED }}>
          Thanks, {application.fullName.split(" ")[0]}. Your dropship
          application is still being reviewed. We'll email{" "}
          <strong>{application.email}</strong> as soon as a decision is made —
          usually within 1–2 business days.
        </p>
      </div>
    );
  }

  if (application.status === "rejected") {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-2xl mb-4" style={{ color: INK }}>
          Application not approved
        </h1>
        <p style={{ color: MUTED }}>
          Your dropship application wasn't approved at this time. If you have
          questions, reach out to{" "}
          <a href="mailto:info@alphagemimports.com" style={{ color: GOLD }}>
            info@alphagemimports.com
          </a>
          .
        </p>
      </div>
    );
  }

  if (application.active === false) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl" style={{ background: "#fef2f2" }}>
          🔒
        </div>
        <h1 className="font-serif text-2xl mb-4" style={{ color: INK }}>
          This link is no longer active
        </h1>
        <p style={{ color: MUTED }}>
          Your dropship portal access has been deactivated. If you believe
          this is a mistake, please contact us at{" "}
          <a href="mailto:info@alphagemimports.com" style={{ color: GOLD }}>
            info@alphagemimports.com
          </a>
          .
        </p>
      </div>
    );
  }

  // approved + active
  const fieldClass =
    "w-full rounded-lg border px-4 py-2.5 text-[13px] outline-none transition-colors focus:border-[#c9a84c]";
  const maxQty = 999; // real per-product stock is enforced server-side on submit
  const productAmount = selectedProduct
    ? selectedProduct.price * (parseInt(form.quantity, 10) || 1)
    : 0;
  const grandTotal = productAmount + (selectedRate?.costWithFee || 0);

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="uppercase tracking-[0.3em] text-[11px] font-bold mb-3" style={{ color: GOLD }}>
            Seller Portal
          </p>
          <h1 className="font-serif text-3xl" style={{ color: INK }}>
            {application.businessName || application.fullName}
          </h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            {application.email} · Approved dropship seller
          </p>
        </div>

        {payNotice && (
          <div className="mb-6 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: `${GOLD}55`, background: `${GOLD}12`, color: INK }}>
            {payNotice}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg" style={{ color: INK }}>Your Dropship Orders</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-[#1a1714]"
            style={{ background: GOLD }}
          >
            {showForm ? "Cancel" : "+ Submit Dropship Order"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border p-6 sm:p-8 mb-10 space-y-5"
            style={{ borderColor: BORDER, background: CREAM }}
          >
            {serverError && (
              <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "#e5b8ab", background: "#fbede8", color: "#a6402b" }}>
                {serverError}
              </div>
            )}

            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>
              1. Pick The Product
            </p>

            {!selectedProduct ? (
              <div ref={searchBoxRef} className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  onFocus={() => { if (query.trim()) setResults(rankProducts(results, query)); }}
                  placeholder="Search by name, description, or model/SKU number"
                  className={fieldClass}
                  style={{ borderColor: BORDER }}
                  autoComplete="off"
                />
                {searching && (
                  <p className="text-[12px] mt-2 flex items-center gap-2" style={{ color: MUTED }}>
                    <span
                      className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
                      style={{ borderColor: `${GOLD}55`, borderTopColor: GOLD }}
                    />
                    Searching…
                  </p>
                )}
                {results.length > 0 && (
                  <div
                    className="mt-2 rounded-lg border divide-y max-h-80 overflow-y-auto shadow-lg absolute left-0 right-0 z-20"
                    style={{ borderColor: BORDER, background: "#fff" }}
                  >
                    {results.map((p, i) => {
                      const isActive = i === activeIdx;
                      return (
                        <button
                          type="button"
                          key={p._id}
                          onClick={() => chooseProduct(p)}
                          onMouseEnter={() => setActiveIdx(i)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                          style={{ background: isActive ? "#faf6ec" : "transparent" }}
                        >
                          {productImageOf(p) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={productImageOf(p)} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0 border" style={{ borderColor: BORDER }} />
                          ) : (
                            <div className="w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center text-[10px]" style={{ background: CREAM, color: MUTED }}>
                              No image
                            </div>
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] truncate" style={{ color: INK }}>
                              {highlightMatch(p.name, query)}
                            </span>
                            <span className="flex items-center gap-2 flex-wrap">
                              {productCodeOf(p) && (
                                <span className="text-[11px] font-mono" style={{ color: MUTED }}>
                                  SKU {highlightMatch(productCodeOf(p)!, query)}
                                </span>
                              )}
                              {categoryPathOf(p) && (
                                <span className="text-[11px]" style={{ color: "#b5b0a8" }}>
                                  {categoryPathOf(p)}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: GOLD }}>${p.price.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {!searching && query.trim().length > 1 && results.length === 0 && (
                  <p className="text-[12px] mt-2" style={{ color: MUTED }}>
                    No matches for "{query}" — check the spelling or try just the model number.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: BORDER, background: "#fff" }}>
                {productImageOf(selectedProduct) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={productImageOf(selectedProduct)} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: INK }}>{selectedProduct.name}</p>
                  <p className="text-[12px]" style={{ color: GOLD }}>
                    ${selectedProduct.price.toFixed(2)} · Alpha price
                    {productCodeOf(selectedProduct) && ` · Model/SKU: ${productCodeOf(selectedProduct)}`}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="text-[12px] font-semibold underline" style={{ color: MUTED }}>
                  Change
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  name="quantity"
                  value={form.quantity}
                  onChange={handleChange}
                  className={fieldClass}
                  style={{ borderColor: BORDER }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Notes (carat, color, etc. — optional)</label>
                <input
                  name="specifications"
                  value={form.specifications}
                  onChange={handleChange}
                  className={fieldClass}
                  style={{ borderColor: BORDER }}
                />
              </div>
            </div>

            <p className="text-[12px] font-bold uppercase tracking-wider pt-2" style={{ color: GOLD }}>
              2. Ship To (Your Customer)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Customer Full Name *</label>
                <input name="customerName" value={form.customerName} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
                {errors.customerName && <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>{errors.customerName[0]}</p>}
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Customer Email</label>
                <input name="customerEmail" value={form.customerEmail} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Customer Phone</label>
              <input name="customerPhone" value={form.customerPhone} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Address Line 1 *</label>
              <input name="addressLine1" value={form.addressLine1} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
              {errors.addressLine1 && <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>{errors.addressLine1[0]}</p>}
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Address Line 2</label>
              <input name="addressLine2" value={form.addressLine2} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>City *</label>
                <input name="city" value={form.city} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
                {errors.city && <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>{errors.city[0]}</p>}
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Country *</label>
                <select name="country" value={form.country} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }}>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>State / Province *</label>
                <select name="state" value={form.state} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }}>
                  <option value="">Select…</option>
                  {(form.country === "CA" ? CA_PROVINCES : US_STATES).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Postal Code *</label>
                <input name="postalCode" value={form.postalCode} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
                {errors.postalCode && <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>{errors.postalCode[0]}</p>}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Special Instructions</label>
              <textarea name="specialInstructions" value={form.specialInstructions} onChange={handleChange} rows={3} className={fieldClass} style={{ borderColor: BORDER }} />
            </div>

            <p className="text-[12px] font-bold uppercase tracking-wider pt-2" style={{ color: GOLD }}>
              3. Choose Shipping
            </p>
            {!addressComplete ? (
              <p className="text-[12px]" style={{ color: MUTED }}>
                Fill in the customer's address above, then get live shipping rates.
              </p>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={fetchRates}
                  disabled={fetchingRates}
                  className="rounded-md px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider disabled:opacity-60"
                  style={{ border: `1px solid ${GOLD}`, color: GOLD }}
                >
                  {fetchingRates ? "Getting Rates…" : shippingRates ? "Refresh Rates" : "Get Shipping Rates"}
                </button>

                {ratesError && (
                  <p className="text-[12px] mt-2" style={{ color: "#a6402b" }}>{ratesError}</p>
                )}

                {shippingRates && shippingRates.length === 0 && !ratesError && (
                  <p className="text-[12px] mt-2" style={{ color: MUTED }}>
                    No shipping rates available for this address.
                  </p>
                )}

                {shippingRates && shippingRates.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {shippingRates.map((r) => {
                      const isSelected = selectedRate?.rateId === r.rateId;
                      return (
                        <button
                          type="button"
                          key={r.rateId}
                          onClick={() => setSelectedRate(r)}
                          className="w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
                          style={
                            isSelected
                              ? { borderColor: GOLD, background: `${GOLD}12` }
                              : { borderColor: BORDER, background: "#fff" }
                          }
                        >
                          <span>
                            <span className="block text-[13px] font-semibold" style={{ color: INK }}>
                              {r.carrier} — {r.service}
                            </span>
                            <span className="block text-[11px]" style={{ color: MUTED }}>
                              {r.estimatedDays ? `${r.estimatedDays} business day${r.estimatedDays === 1 ? "" : "s"}` : r.estimatedDelivery || "Estimate unavailable"}
                            </span>
                          </span>
                          <span className="text-[13px] font-bold flex-shrink-0" style={{ color: GOLD }}>
                            ${r.costWithFee.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedProduct && (
              <div className="rounded-lg border px-4 py-3 space-y-1" style={{ borderColor: BORDER, background: "#fff" }}>
                <div className="flex justify-between text-[12px]" style={{ color: MUTED }}>
                  <span>Product ({form.quantity} × ${selectedProduct.price.toFixed(2)})</span>
                  <span>${productAmount.toFixed(2)}</span>
                </div>
                {selectedRate && (
                  <>
                    <div className="flex justify-between text-[12px]" style={{ color: MUTED }}>
                      <span>{selectedRate.carrier} – {selectedRate.service}</span>
                      <span>${selectedRate.rate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]" style={{ color: MUTED }}>
                      <span>Service Fee</span>
                      <span>${(selectedRate.costWithFee - selectedRate.rate).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-[13px] font-bold pt-1 border-t" style={{ borderColor: BORDER, color: INK }}>
                  <span>Total to pay Alpha</span>
                  <span style={{ color: GOLD }}>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedProduct || !selectedRate}
              className="rounded-md px-8 py-3 text-sm font-bold uppercase tracking-wider text-[#1a1714] disabled:opacity-60"
              style={{ background: GOLD }}
            >
              {submitting ? "Submitting…" : "Continue To Payment"}
            </button>
          </form>
        )}

        {orders.length === 0 ? (
          <p className="text-sm" style={{ color: MUTED }}>
            You haven't submitted any dropship orders yet.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o._id} className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-[13px] font-semibold" style={{ color: INK }}>
                      {o.quantity} × {o.productName}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                      Ship to: {o.customerName} — {o.city}, {o.country}
                      {o.shippingCarrier && ` · ${o.shippingCarrier} ${o.shippingService || ""}`}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                      {new Date(o.createdAt).toLocaleDateString()} · Product ${o.productAmount.toFixed(2)} + Shipping ${(o.shippingCost - o.serviceFee).toFixed(2)} + Service Fee ${o.serviceFee.toFixed(2)} = <strong style={{ color: INK }}>${o.amount.toFixed(2)}</strong>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: PAYMENT_COLORS[o.paymentStatus] }}>
                      {o.paymentStatus === "completed" ? "Paid" : o.paymentStatus === "failed" ? "Payment failed" : "Unpaid"}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: STATUS_COLORS[o.status] || MUTED }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    {o.trackingNumber && (
                      <span className="text-[11px]" style={{ color: MUTED }}>
                        {o.trackingUrl ? (
                          <a href={o.trackingUrl} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{o.trackingNumber}</a>
                        ) : o.trackingNumber}
                      </span>
                    )}
                  </div>
                  {o.paymentStatus !== "completed" && o.status !== "cancelled" && (
                    <button
                      onClick={() => setPayingOrderId(payingOrderId === o._id ? null : o._id)}
                      className="rounded-md px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-[#1a1714]"
                      style={{ background: GOLD }}
                    >
                      {payingOrderId === o._id ? "Cancel" : "Pay Now"}
                    </button>
                  )}
                </div>

                {payingOrderId === o._id && (
                  <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: BORDER, background: CREAM }}>
                    <p className="text-[12px] mb-3" style={{ color: MUTED }}>
                      Pay ${o.amount.toFixed(2)} to send this order into fulfillment.
                    </p>
                    <PayPalButtons
                      style={{ layout: "horizontal", height: 40 }}
                      forceReRender={[o._id]}
                      createOrder={async () => {
                        const res = await fetch(`/api/dropship/portal/${token}/orders/${o._id}/pay`, {
                          method: "POST",
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || "Could not start payment");
                        return data.data.paypalOrderId;
                      }}
                      onApprove={async (data) => {
                        const res = await fetch(
                          `/api/dropship/portal/${token}/orders/${o._id}/pay/capture`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ paypalOrderId: data.orderID }),
                          }
                        );
                        const result = await res.json();
                        if (!res.ok) {
                          setPayNotice(result.message || "Payment could not be completed.");
                          return;
                        }
                        setPayingOrderId(null);
                        setPayNotice("✓ Payment received — this order is now with Alpha for fulfillment.");
                        setTimeout(() => setPayNotice(null), 5000);
                        await loadPortal();
                      }}
                      onError={() => setPayNotice("Something went wrong with PayPal. Please try again.")}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}