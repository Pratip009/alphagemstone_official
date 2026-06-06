"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useApi } from "@/hooks/useApi";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CartItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    images?: string[];
    price: number;
  };
  quantity: number;
  price: number;
}

interface CartData {
  items: CartItem[];
  totals?: {
    subtotal: number;
    total: number;
  };
}

// ── CartSidebar ────────────────────────────────────────────────────────────────
export default function CartSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { apiFetch } = useApi();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch cart whenever sidebar opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch("/api/cart")
      .then((d) => {
        setCart({
          items: d.data.cart.items,
          totals: d.data.totals,
        });
      })
      .catch(() => setCart(null))
      .finally(() => setLoading(false));
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const updateQty = async (
    itemId: string,
    delta: number,
    currentQty: number,
    productId: string,
  ) => {
    const newQty = currentQty + delta;
    if (newQty < 1) return removeItem(itemId, productId);

    // Optimistic update instantly
    setCart((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item._id === itemId ? { ...item, quantity: newQty } : item,
        ),
      };
    });

    setUpdatingId(itemId);
    try {
      const d = await apiFetch("/api/cart", {
        method: "PUT",
        body: JSON.stringify({ productId, quantity: newQty }),
      });
      console.log("PUT response:", d); // ← check this
      // Try all possible response shapes
      const cartData = d.data?.cart ?? d.data ?? d;
      const totals = d.data?.totals ?? d.totals ?? null;
      if (cartData?.items) {
        setCart({ items: cartData.items, totals });
      }
    } catch {
      // Revert by re-fetching
      apiFetch("/api/cart").then((d) =>
        setCart({ items: d.data.cart.items, totals: d.data.totals }),
      );
    } finally {
      setUpdatingId(null);
    }
  };

 const removeItem = async (itemId: string, productId: string) => {
  // Optimistic update instantly
  setCart((prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      items: prev.items.filter((item) => item._id !== itemId),
    };
  });

  setUpdatingId(itemId);
  try {
    const d = await apiFetch(`/api/cart?productId=${productId}`, { method: 'DELETE' });
    const cartData = d.data?.cart ?? d.data ?? d;
    const totals = d.data?.totals ?? d.totals ?? null;
    if (cartData?.items) {
      setCart({ items: cartData.items, totals });
    }
  } catch {
    apiFetch('/api/cart').then((d) =>
      setCart({ items: d.data.cart.items, totals: d.data.totals })
    );
  } finally {
    setUpdatingId(null);
  }
};

  const items = cart?.items ?? [];
  const total = cart?.totals?.total ?? 0;
  const subtotal = cart?.totals?.subtotal ?? 0;

  return (
    <>
      <style>{`
        @keyframes slideInCart {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spinLoader {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmerCart {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .cart-sidebar-panel {
          animation: slideInCart 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .cart-overlay {
          animation: fadeInOverlay 0.25s ease forwards;
        }
        .cart-item-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 0;
          border-bottom: 1px solid #f0eeff;
          transition: background 0.15s;
        }
        .cart-item-row:last-child { border-bottom: none; }
        .qty-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid #e0ddf5;
          border-radius: 8px;
          background: #faf9ff;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          color: #0f3460;
          font-family: 'Poppins', sans-serif;
          transition: background 0.12s, border-color 0.12s, transform 0.1s;
          flex-shrink: 0;
        }
        .qty-btn:hover:not(:disabled) {
          background: #ede9fe;
          border-color: #a5b4fc;
          transform: scale(1.08);
        }
        .qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .remove-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: #c4b5fd;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .remove-btn:hover { color: #dc2626; background: #fff5f5; }
        .checkout-btn {
          display: block;
          width: 100%;
          text-align: center;
          padding: 15px 24px;
          background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 60%, #7c3aed 100%);
          color: #fff;
          font-family: 'Poppins', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.03em;
          border-radius: 12px;
          text-decoration: none;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(79,70,229,0.35);
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .checkout-btn:hover {
          opacity: 0.93;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(79,70,229,0.45);
        }
        .view-cart-link {
          display: block;
          text-align: center;
          padding: 11px 24px;
          border: 1.5px solid #e0ddf5;
          color: #0f3460;
          font-family: 'Poppins', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          border-radius: 12px;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
          margin-top: 10px;
        }
        .view-cart-link:hover { background: #f5f3ff; border-color: #a5b4fc; }
        .cart-img {
          width: 72px;
          height: 72px;
          border-radius: 10px;
          object-fit: cover;
          background: #f5f3ff;
          flex-shrink: 0;
          border: 1px solid #ede9fe;
        }
        .cart-img-placeholder {
          width: 72px;
          height: 72px;
          border-radius: 10px;
          background: linear-gradient(135deg, #f5f3ff, #ede9fe);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid #ede9fe;
        }
        .shimmer-line {
          border-radius: 6px;
          background: linear-gradient(90deg, #f0eefc 25%, #e4e0f8 50%, #f0eefc 75%);
          background-size: 200% 100%;
          animation: shimmerCart 1.4s ease infinite;
        }
      `}</style>

      {/* Backdrop */}
      {open && (
        <div
          ref={overlayRef}
          className="cart-overlay fixed inset-0 z-[998]"
          style={{
            background: "rgba(15, 15, 30, 0.45)",
            backdropFilter: "blur(2px)",
          }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
        className="fixed top-0 right-0 h-full z-[999] flex flex-col"
        style={{
          width: "min(420px, 100vw)",
          background: "#ffffff",
          boxShadow: "-8px 0 48px rgba(79,70,229,0.14)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #f0eeff",
            background: "linear-gradient(to right, #faf9ff, #ffffff)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                  stroke="#ffffff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="3"
                  y1="6"
                  x2="21"
                  y2="6"
                  stroke="#ffffff"
                  strokeWidth="1.7"
                />
                <path
                  d="M16 10a4 4 0 01-8 0"
                  stroke="#a5b4fc"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1a1a2e",
                  lineHeight: 1.2,
                }}
              >
                Your Cart
              </p>
              {!loading && (
                <p style={{ fontSize: 11.5, color: "#9f9fc0", marginTop: 1 }}>
                  {items.length} {items.length === 1 ? "item" : "items"}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close cart"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f5f3ff",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              color: "#0f3460",
              transition: "background 0.15s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ede9fe";
              e.currentTarget.style.transform = "rotate(90deg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f5f3ff";
              e.currentTarget.style.transform = "rotate(0deg)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 24px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Loading skeleton */}
          {loading && (
            <div style={{ paddingTop: 16 }}>
             {[1, 2, 3].map((i) => (
  <div key={`skeleton-${i}`} style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: '1px solid #f0eeff' }}>
    <div className="shimmer-line" style={{ width: 72, height: 72, borderRadius: 10, flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
      <div className="shimmer-line" style={{ height: 13, width: '75%' }} />
      <div className="shimmer-line" style={{ height: 11, width: '40%' }} />
      <div className="shimmer-line" style={{ height: 28, width: 90, marginTop: 6 }} />
    </div>
  </div>
))}
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                    stroke="#a5b4fc"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="3"
                    y1="6"
                    x2="21"
                    y2="6"
                    stroke="#a5b4fc"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M16 10a4 4 0 01-8 0"
                    stroke="#c4b5fd"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1a1a2e",
                  marginBottom: 8,
                }}
              >
                Your cart is empty
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "#9f9fc0",
                  lineHeight: 1.6,
                  maxWidth: 240,
                }}
              >
                Discover our collection of fine gemstones and add your
                favorites.
              </p>
              <Link
                href="/products"
                onClick={onClose}
                style={{
                  marginTop: 24,
                  display: "inline-block",
                  padding: "10px 24px",
                  background: "linear-gradient(135deg, #0f3460, #7c3aed)",
                  color: "#fff",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
                }}
              >
                Shop Now
              </Link>
            </div>
          )}

          {/* Items */}
          {!loading && items.length > 0 && (
            <div>
              {items.map((item,index) => {
                const isUpdating = updatingId === item._id;
                const imgSrc = item.product.images?.[0];
                return (
                  <div
                    key={item._id ?? `item-${index}`}
                    className="cart-item-row"
                    style={{
                      opacity: isUpdating ? 0.6 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {/* Image */}
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.product.name}
                        className="cart-img"
                      />
                    ) : (
                      <div className="cart-img-placeholder">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 32 32"
                          fill="none"
                        >
                          <polygon
                            points="16,3 29,12 16,29 3,12"
                            stroke="#c4b5fd"
                            strokeWidth="1.5"
                            fill="none"
                          />
                          <polygon
                            points="16,3 29,12 16,15 3,12"
                            stroke="#a5b4fc"
                            strokeWidth="1"
                            fill="none"
                            opacity="0.7"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#1a1a2e",
                          marginBottom: 3,
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.product.name}
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          color: "#7c3aed",
                          fontWeight: 600,
                          marginBottom: 10,
                        }}
                      >
                        ${(item.price * item.quantity).toFixed(2)}
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9f9fc0",
                            fontWeight: 400,
                            marginLeft: 4,
                          }}
                        >
                          (${item.price.toFixed(2)} ea)
                        </span>
                      </p>

                      {/* Qty controls */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <button
                          className="qty-btn"
                          onClick={() =>
                            updateQty(
                              item._id,
                              -1,
                              item.quantity,
                              item.product._id,
                            )
                          }
                          disabled={isUpdating}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span
                          style={{
                            minWidth: 24,
                            textAlign: "center",
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: "#1a1a2e",
                          }}
                        >
                          {isUpdating ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              style={{
                                animation: "spinLoader 0.8s linear infinite",
                                display: "inline-block",
                              }}
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="#c4b5fd"
                                strokeWidth="2.5"
                              />
                              <path
                                d="M12 2a10 10 0 0110 10"
                                stroke="#0f3460"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          ) : (
                            item.quantity
                          )}
                        </span>
                        <button
                          className="qty-btn"
                          onClick={() =>
                            updateQty(
                              item._id,
                              1,
                              item.quantity,
                              item.product._id,
                            )
                          }
                          disabled={isUpdating}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>

                        <button
                          className="remove-btn"
                          onClick={() => removeItem(item._id, item.product._id)}
                         disabled={!!updatingId}
                          aria-label="Remove item"
                          style={{ marginLeft: 4 }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <path
                              d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              padding: "20px 24px 28px",
              borderTop: "1px solid #f0eeff",
              background: "linear-gradient(to top, #faf9ff, #ffffff)",
            }}
          >
            {/* Order summary */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: "#7c7c9a" }}>Subtotal</span>
                <span
                  style={{ fontSize: 13, fontWeight: 500, color: "#1a1a2e" }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, color: "#7c7c9a" }}>Shipping</span>
                <span
                  style={{ fontSize: 12, color: "#059669", fontWeight: 500 }}
                >
                  Free ✓
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0 0",
                  borderTop: "1.5px solid #ede9fe",
                  marginTop: 10,
                }}
              >
                <span
                  style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}
                >
                  Total
                </span>
                <span
                  style={{ fontSize: 17, fontWeight: 800, color: "#0f3460" }}
                >
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <Link href="/checkout" onClick={onClose} className="checkout-btn">
              Proceed to Checkout →
            </Link>
            <Link href="/cart" onClick={onClose} className="view-cart-link">
              View Full Cart
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
