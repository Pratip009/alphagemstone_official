const PAYPAL_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description}`);
  return data.access_token;
}

// ─── Create PayPal Order ──────────────────────────────────────────────────────
export async function createPayPalOrder(totalAmount: number, currency = 'USD') {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: totalAmount.toFixed(2),
          },
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal create order failed: ${JSON.stringify(data)}`);
  return data; // { id, status, links }
}

// ─── Capture PayPal Order ─────────────────────────────────────────────────────
export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal capture failed: ${JSON.stringify(data)}`);
  return data; // { id, status, purchase_units }
}

// ─── Verify PayPal Order ──────────────────────────────────────────────────────
export async function verifyPayPalOrder(paypalOrderId: string) {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal verify failed`);
  return data;
}
