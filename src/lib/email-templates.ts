// ─────────────────────────────────────────────────────────────────────────────
// Email Templates — Alpha Imports
// Design: corporate, minimal, email-client safe (Gmail, Outlook, Apple Mail, Yahoo)
// No web fonts, no CSS classes, no JS — inline styles only.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_NAME = 'Alpha Imports';
const BRAND_TAGLINE = 'Fine Gemstones';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@alphagemstone.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com';
const YEAR = new Date().getFullYear();

// Shared layout wrapper — ensures consistent chrome across all templates
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND_NAME}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- Outer container -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
          style="width:560px;max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:8px;height:8px;background-color:#6366f1;margin-right:12px;vertical-align:middle;"></span>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#f8fafc;letter-spacing:0.03em;vertical-align:middle;">${BRAND_NAME}</span>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#94a3b8;letter-spacing:0.15em;text-transform:uppercase;display:block;margin-top:3px;padding-left:20px;">${BRAND_TAGLINE}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          ${content}
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e4e4e7;padding:20px 40px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
                © ${YEAR} ${BRAND_NAME} · ${BRAND_TAGLINE}<br />
                Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── OTP / Verification Email ─────────────────────────────────────────────────

export function otpEmailHtml(otp: string, purpose: 'signup' | 'reset_password'): string {
  const isSignup = purpose === 'signup';
  const heading = isSignup ? 'Verify your email address' : 'Reset your password';
  const intro = isSignup
    ? 'Thank you for registering with Alpha Imports. Use the code below to verify your email address and activate your account.'
    : 'We received a request to reset your password. Use the code below to proceed. If you did not make this request, you can safely ignore this email.';

  const body = `
  <tr>
    <td style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${heading}</h1>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">${intro}</p>
      <!-- OTP Box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td align="center" style="background-color:#f8fafc;border:1px solid #e4e4e7;padding:28px 24px;">
            <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:0.15em;text-transform:uppercase;">Verification Code</p>
            <p style="margin:0 0 10px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;color:#0f172a;letter-spacing:0.25em;">${otp}</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;">Expires in <strong style="color:#0f172a;">10 minutes</strong></p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;line-height:1.7;">
        For your security, never share this code with anyone. Alpha Imports will never ask for your code by phone or email.
      </p>
    </td>
  </tr>`;

  return emailWrapper(body);
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

export function welcomeEmailHtml(name: string): string {
  const firstName = name.split(' ')[0] || name;

  const body = `
  <tr>
    <td style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">Welcome to Alpha Imports</h1>
      <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">
        Dear ${firstName},
      </p>
      <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">
        Thank you for creating your account. Your registration is now complete, and you have full access to the Alpha Imports platform.
      </p>
      <!-- Divider -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr><td style="border-top:1px solid #e4e4e7;"></td></tr>
      </table>
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">What you can do now</p>
      <!-- Feature list -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:20px;vertical-align:top;padding-top:2px;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6366f1;">&#8212;</span>
                </td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;"><strong>Browse our gemstone catalogue</strong> — explore thousands of GIA-certified diamonds, sapphires, rubies, and emeralds.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:20px;vertical-align:top;padding-top:2px;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6366f1;">&#8212;</span>
                </td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;"><strong>Save your favourites</strong> — create wishlists and receive notifications on price changes and new arrivals.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:20px;vertical-align:top;padding-top:2px;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6366f1;">&#8212;</span>
                </td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;"><strong>Expert consultation</strong> — get guidance from our gemologists on sourcing and valuation.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="background-color:#0f172a;">
            <a href="${SITE_URL}/products" target="_blank"
              style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.05em;text-transform:uppercase;">
              Explore the Collection
            </a>
          </td>
        </tr>
      </table>
      <!-- Divider -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
        <tr><td style="border-top:1px solid #e4e4e7;"></td></tr>
      </table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;line-height:1.7;">
        If you have any questions or require assistance, our team is available at
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;text-decoration:none;">${SUPPORT_EMAIL}</a>.
        We typically respond within one business day.
      </p>
    </td>
  </tr>`;

  return emailWrapper(body);
}

// ─── Password Reset Confirmation ──────────────────────────────────────────────

export function passwordResetConfirmationEmailHtml(name: string): string {
  const firstName = name.split(' ')[0] || name;

  const body = `
  <tr>
    <td style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">Your password has been reset</h1>
      <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">Dear ${firstName},</p>
      <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">
        Your Alpha Imports account password has been successfully updated. You can now sign in with your new credentials.
      </p>
      <!-- Alert box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="background-color:#fefce8;border-left:3px solid #ca8a04;padding:14px 18px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#78350f;line-height:1.6;">
              If you did not make this change, contact us immediately at
              <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;text-decoration:none;">${SUPPORT_EMAIL}</a>
              and secure your account.
            </p>
          </td>
        </tr>
      </table>
      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background-color:#0f172a;">
            <a href="${SITE_URL}/login" target="_blank"
              style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.05em;text-transform:uppercase;">
              Sign In
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return emailWrapper(body);
}

// ─── Order Confirmation Email ─────────────────────────────────────────────────

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface OrderEmailData {
  orderId: string;
  customerName: string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  totalAmount: number;
  paymentMethod: 'paypal' | 'cod';
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function orderItemsRows(items: OrderEmailItem[]): string {
  return items.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;vertical-align:top;">
        ${item.name}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;text-align:center;vertical-align:top;">
        ${item.quantity}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;text-align:right;vertical-align:top;">
        ${formatCurrency(item.price * item.quantity)}
      </td>
    </tr>`).join('');
}

export function orderConfirmationEmailHtml(data: OrderEmailData): string {
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const shortOrderId = data.orderId.slice(-8).toUpperCase();
  const paymentLabel = data.paymentMethod === 'paypal' ? 'PayPal' : 'Cash on Delivery';

  const addr = data.shippingAddress;
  const addressLines = [
    addr.addressLine1,
    addr.addressLine2,
    `${addr.city}, ${addr.state} ${addr.postalCode}`,
    addr.country,
  ].filter(Boolean).join('<br />');

  const body = `
  <tr>
    <td style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f172a;">Order Confirmed</h1>
      <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">
        Thank you, ${firstName}. We have received your order and it is being processed.
      </p>

      <!-- Order ID badge -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="background-color:#f8fafc;border:1px solid #e4e4e7;padding:12px 20px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Order Reference</span>
            <span style="font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;color:#0f172a;display:block;margin-top:2px;letter-spacing:0.05em;">#${shortOrderId}</span>
          </td>
        </tr>
      </table>

      <!-- Items table -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;border-bottom:2px solid #0f172a;">Item</td>
          <td style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;border-bottom:2px solid #0f172a;text-align:center;">Qty</td>
          <td style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;border-bottom:2px solid #0f172a;text-align:right;">Amount</td>
        </tr>
        ${orderItemsRows(data.items)}
      </table>

      <!-- Totals -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Subtotal</td>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;text-align:right;">${formatCurrency(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Shipping</td>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;text-align:right;">${data.shippingCost === 0 ? 'Free' : formatCurrency(data.shippingCost)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">Tax</td>
          <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;text-align:right;">${formatCurrency(data.tax)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0f172a;border-top:2px solid #0f172a;">Total</td>
          <td style="padding:10px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0f172a;text-align:right;border-top:2px solid #0f172a;">${formatCurrency(data.totalAmount)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;">Payment Method</td>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#374151;text-align:right;">${paymentLabel}</td>
        </tr>
      </table>

      <!-- Shipping address -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="background-color:#f8fafc;border:1px solid #e4e4e7;padding:16px 20px;">
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Shipping To</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;line-height:1.7;">${addressLines}</p>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:#0f172a;">
            <a href="${SITE_URL}/orders" target="_blank"
              style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.05em;text-transform:uppercase;">
              View Your Order
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;line-height:1.7;">
        Questions about your order? Contact us at
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;text-decoration:none;">${SUPPORT_EMAIL}</a>.
      </p>
    </td>
  </tr>`;

  return emailWrapper(body);
}

// ─── Order Shipped Email ───────────────────────────────────────────────────────

export interface OrderShippedEmailData {
  orderId: string;
  customerName: string;
  trackingNumber: string;
  trackingUrl?: string;
  shippingCarrier?: string;
  estimatedDelivery?: string;
}

export function orderShippedEmailHtml(data: OrderShippedEmailData): string {
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const shortOrderId = data.orderId.slice(-8).toUpperCase();
  const trackingLink = data.trackingUrl || `${SITE_URL}/orders`;

  const body = `
  <tr>
    <td style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f172a;">Your Order Has Shipped</h1>
      <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.7;">
        Good news, ${firstName}. Your order <strong style="color:#0f172a;">#${shortOrderId}</strong> is on its way.
      </p>

      <!-- Tracking box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="background-color:#f8fafc;border:1px solid #e4e4e7;border-left:3px solid #0f172a;padding:20px 24px;">
            ${data.shippingCarrier ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Carrier</p>
            <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${data.shippingCarrier}</p>` : ''}
            <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Tracking Number</p>
            <p style="margin:0 ${data.estimatedDelivery ? '0 16px' : ''};font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:700;color:#0f172a;letter-spacing:0.05em;">${data.trackingNumber}</p>
            ${data.estimatedDelivery ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Estimated Delivery</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">${data.estimatedDelivery}</p>` : ''}
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td style="background-color:#0f172a;">
            <a href="${trackingLink}" target="_blank"
              style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.05em;text-transform:uppercase;">
              Track Your Package
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;line-height:1.7;">
        If you have any questions, reach us at
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;text-decoration:none;">${SUPPORT_EMAIL}</a>.
      </p>
    </td>
  </tr>`;

  return emailWrapper(body);
}