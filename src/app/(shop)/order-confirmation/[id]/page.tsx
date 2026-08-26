"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Package, Loader2 } from "lucide-react";

// Reached right after a guest completes checkout (see checkout/page.tsx's
// onPayPalApprove). Unlike /orders (account order history), this page works
// without being logged in — the API scopes the lookup to the requester's
// guest_id cookie, so a guest can only ever see the order they just placed.
interface ConfirmedOrder {
  _id: string;
  items: Array<{ name: string; quantity: number; price: number; image?: string }>;
  totalAmount: number;
  shippingAddress: { fullName: string; city: string; state: string; country: string };
  status: string;
  guestEmail?: string;
}

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/orders/${id}`)
      .then((d) => setOrder(d.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Order not found"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Loader2 className="animate-spin" size={28} color="#6366f1" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", padding: 20 }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          {error || "We couldn't find that order."}
        </p>
        <Link href="/" style={{ color: "#6366f1", fontSize: 13, fontWeight: 600 }}>
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px 60px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <CheckCircle2 size={44} color="#16a34a" style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
          Order confirmed
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Order #{order._id.slice(-8).toUpperCase()} — a confirmation email is
          on its way.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        {order.items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: i < order.items.length - 1 ? "1px solid #f1f5f9" : "none",
              fontSize: 13,
            }}
          >
            <span style={{ color: "#334155" }}>
              {item.name} × {item.quantity}
            </span>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid #e2e8f0",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>Total</span>
          <span>${order.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          fontSize: 13,
          color: "#475569",
        }}
      >
        <p style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
          Shipping to
        </p>
        <p>{order.shippingAddress.fullName}</p>
        <p>
          {order.shippingAddress.city}, {order.shippingAddress.state},{" "}
          {order.shippingAddress.country}
        </p>
      </div>

      {/* Opt-in account creation, offered only after the sale is already
          won — this is deliberately NOT a gate. */}
      {!user && (
        <div
          style={{
            background: "#eef2ff",
            border: "1px solid #c7d2fe",
            borderRadius: 16,
            padding: 20,
            textAlign: "center",
          }}
        >
          <Package size={22} color="#6366f1" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
            Want to track this order and see it again later?
          </p>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Create an account with the email you just used — no need to
            re-enter your details.
          </p>
          <button
            onClick={() => router.push(`/signup?email=${encodeURIComponent(order.guestEmail ?? "")}`)}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Create Account
          </button>
        </div>
      )}
    </div>
  );
}
