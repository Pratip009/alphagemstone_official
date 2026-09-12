"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const GOLD = "#c9a84c";
const INK = "#1a1714";
const MUTED = "#4d463f";
const BORDER = "#e4dfd2";
const CREAM = "#fffdf9";

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
  amount: number;
  customerName: string;
  city: string;
  country: string;
  status: string;
  paymentStatus: "pending" | "completed" | "failed";
  trackingNumber?: string;
  trackingUrl?: string;
  createdAt: string;
};

type ProductResult = {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  image?: string;
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
  country: "United States",
  shippingMethod: "",
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

  // Product picker
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

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

  // Debounced product search against the real catalog
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      searchAbort.current?.abort();
      const controller = new AbortController();
      searchAbort.current = controller;
      setSearching(true);
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(query)}&limit=8`,
          { signal: controller.signal }
        );
        const data = await res.json();
        const list: ProductResult[] = Array.isArray(data) ? data : data?.data ?? [];
        setResults(list);
      } catch {
        // aborted or failed — ignore, next keystroke will retry
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined as any }));
  };

  const resetOrderForm = () => {
    setForm(ORDER_FORM_INITIAL);
    setSelectedProduct(null);
    setQuery("");
    setResults([]);
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

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dropship/portal/${token}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productId: selectedProduct._id,
          quantity: parseInt(form.quantity, 10) || 1,
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

  if (!application.active) {
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
              <div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Alpha's catalog — e.g. sapphire, tanzanite ring, 1ct diamond"
                  className={fieldClass}
                  style={{ borderColor: BORDER }}
                />
                {searching && <p className="text-[12px] mt-2" style={{ color: MUTED }}>Searching…</p>}
                {results.length > 0 && (
                  <div className="mt-3 rounded-lg border divide-y max-h-72 overflow-y-auto" style={{ borderColor: BORDER, background: "#fff" }}>
                    {results.map((p) => (
                      <button
                        type="button"
                        key={p._id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setQuery("");
                          setResults([]);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03]"
                        style={{ borderColor: BORDER }}
                      >
                        {productImageOf(p) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={productImageOf(p)} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        )}
                        <span className="flex-1 text-[13px]" style={{ color: INK }}>{p.name}</span>
                        <span className="text-[13px] font-semibold" style={{ color: GOLD }}>${p.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
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
                  <p className="text-[12px]" style={{ color: GOLD }}>${selectedProduct.price.toFixed(2)} · Alpha price</p>
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

            {selectedProduct && (
              <p className="text-[13px] font-semibold" style={{ color: INK }}>
                Total to pay Alpha: <span style={{ color: GOLD }}>
                  ${(selectedProduct.price * (parseInt(form.quantity, 10) || 1)).toFixed(2)}
                </span>
              </p>
            )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Customer Phone</label>
                <input name="customerPhone" value={form.customerPhone} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Shipping Method</label>
                <input name="shippingMethod" value={form.shippingMethod} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} placeholder="e.g. UPS Ground" />
              </div>
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
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>State</label>
                <input name="state" value={form.state} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Postal Code *</label>
                <input name="postalCode" value={form.postalCode} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
                {errors.postalCode && <p className="text-[12px] mt-1" style={{ color: "#a6402b" }}>{errors.postalCode[0]}</p>}
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Country *</label>
                <input name="country" value={form.country} onChange={handleChange} className={fieldClass} style={{ borderColor: BORDER }} />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: INK }}>Special Instructions</label>
              <textarea name="specialInstructions" value={form.specialInstructions} onChange={handleChange} rows={3} className={fieldClass} style={{ borderColor: BORDER }} />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedProduct}
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
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                      {new Date(o.createdAt).toLocaleDateString()} · ${o.amount.toFixed(2)}
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
