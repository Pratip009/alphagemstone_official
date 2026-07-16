// ─────────────────────────────────────────────────────────────────────────────
// Email Templates — Alpha Imports
// Design: full-width, modern editorial, email-client safe
// No web fonts, no CSS classes, no JS — inline styles only.
// Max-width: 640px, full-bleed header/hero, generous whitespace.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_NAME = 'Alpha Imports';
const BRAND_TAGLINE = 'Fine Gemstones & Diamonds';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@alphagemstone.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com';
const YEAR = new Date().getFullYear();

// ─── Design tokens (inline-style constants) ───────────────────────────────────
const T = {
  bg:         '#F9F7F4',   // warm off-white page bg
  card:       '#FFFFFF',
  headerBg:   '#0C0A09',   // near-black
  accentGold: '#C9A84C',   // warm gold — gemstone brand
  accentDark: '#1A1410',
  textPrimary:'#1A1410',
  textMuted:  '#6B6560',
  textLight:  '#9E9994',
  border:     '#E8E3DC',   // warm gray border
  divider:    '#F0EBE3',
  successBg:  '#F0FAF4',
  successBdr: '#22C55E',
  warnBg:     '#FFFBEB',
  warnBdr:    '#F59E0B',
  fontStack:  'Georgia,"Times New Roman",Times,serif',
  sansStack:  '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
  monoStack:  '"Courier New",Courier,monospace',
};
export interface OrderDeliveredEmailData {
  orderId: string;
  customerName: string;
  trackingNumber?: string;
  deliveredAt?: string;
}
export interface AdminNewOrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  itemCount: number;
  paymentMethod: string;
}
export function adminNewOrderEmailHtml(data: AdminNewOrderEmailData): string {
  const shortOrderId = data.orderId.slice(-8).toUpperCase();

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${T.divider};font-family:${T.sansStack};font-size:13px;color:${T.textMuted};">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${T.divider};font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};font-weight:700;text-align:right;">${value}</td>
    </tr>`;

  const body = `
  <tr>
    <td style="background-color:${T.headerBg};padding:32px 48px 28px;">
      <p style="margin:0 0 12px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">New order</p>
      <h1 style="margin:0;font-family:${T.fontStack};font-size:26px;font-weight:400;color:#FFFFFF;">Order #${shortOrderId} — payment received</h1>
    </td>
  </tr>
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <tr>
    <td class="email-pad" style="padding:36px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Customer', `${data.customerName} (${data.customerEmail})`)}
        ${row('Items', String(data.itemCount))}
        ${row('Payment method', data.paymentMethod.toUpperCase())}
        ${row('Total', `$${data.totalAmount.toFixed(2)}`)}
      </table>
      <div style="margin-top:28px;">
        ${ctaButton('Open in Admin', `${SITE_URL}/admin/orders`)}
      </div>
    </td>
  </tr>`;

  return emailWrapper(body, `New order #${shortOrderId} — $${data.totalAmount.toFixed(2)}`);
}
export function orderDeliveredEmailHtml(data: OrderDeliveredEmailData): string {
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const shortOrderId = data.orderId.slice(-8).toUpperCase();

  const body = `
  <!-- Hero -->
  <tr>
    <td style="background-color:${T.headerBg};padding:40px 48px 36px;">
      <p style="margin:0 0 16px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">Delivered</p>
      <h1 style="margin:0 0 10px;font-family:${T.fontStack};font-size:32px;font-weight:400;color:#FFFFFF;line-height:1.2;">It's arrived, ${firstName}.</h1>
      <p style="margin:0;font-family:${T.sansStack};font-size:14px;color:rgba(255,255,255,0.5);">Order <strong style="color:rgba(255,255,255,0.7);">#${shortOrderId}</strong> has been delivered.</p>
    </td>
  </tr>
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <tr>
    <td class="email-pad" style="padding:44px 48px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
        <tr>
          <td style="background-color:${T.successBg};border:1px solid ${T.successBdr};padding:24px 28px;">
            <p style="margin:0;font-family:${T.sansStack};font-size:14px;color:${T.textPrimary};line-height:1.6;">
              Your package ${data.trackingNumber ? `(tracking <strong>${data.trackingNumber}</strong>) ` : ''}was marked delivered${data.deliveredAt ? ` on ${data.deliveredAt}` : ''}. We hope you love it.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 28px;font-family:${T.sansStack};font-size:14px;color:${T.textMuted};line-height:1.6;">
        If anything looks off or the package didn't actually arrive, just reply to this email or reach us at ${SUPPORT_EMAIL} and we'll sort it out right away.
      </p>
      ${ctaButton('View Order', `${SITE_URL}/orders`)}
    </td>
  </tr>`;

  return emailWrapper(body, `Order #${shortOrderId} has been delivered`);
}
// ─── Shared wrapper ───────────────────────────────────────────────────────────
function emailWrapper(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <title>${BRAND_NAME}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width:640px){
      .email-outer{width:100%!important;}
      .email-card{width:100%!important;border-radius:0!important;}
      .email-pad{padding:32px 24px!important;}
      .email-hero-pad{padding:48px 24px!important;}
      .hide-mobile{display:none!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-break:break-word;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${T.bg};">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${T.bg};min-width:320px;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table role="presentation" class="email-outer" width="640" cellpadding="0" cellspacing="0" border="0"
          style="width:640px;max-width:640px;">

          <!-- Logo bar -->
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="font-family:${T.sansStack};font-size:11px;font-weight:700;color:${T.textMuted};letter-spacing:0.18em;text-transform:uppercase;">${BRAND_NAME}</span>
                    <span style="font-family:${T.sansStack};font-size:10px;color:${T.textLight};letter-spacing:0.1em;text-transform:uppercase;margin-left:10px;">✦ ${BRAND_TAGLINE}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td>
              <table role="presentation" class="email-card" width="640" cellpadding="0" cellspacing="0" border="0"
                style="width:640px;background-color:${T.card};border:1px solid ${T.border};border-radius:4px;overflow:hidden;">
                ${content}

                <!-- Footer -->
                <tr>
                  <td style="padding:28px 48px;border-top:1px solid ${T.divider};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:${T.sansStack};font-size:11px;color:${T.textLight};line-height:1.8;text-align:center;">
                          <strong style="color:${T.textMuted};font-weight:600;letter-spacing:0.05em;">${BRAND_NAME}</strong> &nbsp;·&nbsp; ${BRAND_TAGLINE}<br />
                          Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${T.accentGold};text-decoration:none;">${SUPPORT_EMAIL}</a>
                          &nbsp;·&nbsp;
                          <a href="${SITE_URL}" style="color:${T.textLight};text-decoration:none;">alphagemstone.com</a><br />
                          <span style="display:inline-block;margin-top:10px;">© ${YEAR} ${BRAND_NAME}. All rights reserved.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Reusable: gold accent CTA button ─────────────────────────────────────────
function ctaButton(label: string, href: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background-color:${T.accentGold};border-radius:2px;">
        <a href="${href}" target="_blank"
          style="display:inline-block;padding:14px 36px;font-family:${T.sansStack};font-size:12px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Reusable: section heading ────────────────────────────────────────────────
function sectionHeading(text: string): string {
  return `<p style="margin:0 0 4px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:${T.textLight};letter-spacing:0.18em;text-transform:uppercase;">${text}</p>`;
}


// ─── OTP / Verification Email ─────────────────────────────────────────────────

export function otpEmailHtml(otp: string, purpose: 'signup' | 'reset_password'): string {
  const isSignup = purpose === 'signup';
  const heading = isSignup ? 'Verify your email' : 'Reset your password';
  const intro = isSignup
    ? 'Enter the code below to complete your registration and activate your Alpha Imports account.'
    : 'Use this code to reset your password. If you did not request this, you can safely ignore this email.';
  const preheader = isSignup
    ? `Your verification code is ${otp} — expires in 10 minutes`
    : `Your password reset code is ${otp} — expires in 10 minutes`;

  const body = `
  <!-- Dark header strip -->
  <tr>
    <td style="background-color:${T.headerBg};padding:40px 48px 36px;">
      <p style="margin:0 0 16px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">${isSignup ? 'Account verification' : 'Password reset'}</p>
      <h1 style="margin:0;font-family:${T.fontStack};font-size:32px;font-weight:400;color:#FFFFFF;letter-spacing:-0.01em;line-height:1.2;">${heading}</h1>
    </td>
  </tr>
  <!-- Gold rule -->
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <!-- Body -->
  <tr>
    <td class="email-pad" style="padding:44px 48px 40px;">
      <p style="margin:0 0 36px;font-family:${T.sansStack};font-size:15px;color:${T.textMuted};line-height:1.7;">${intro}</p>

      <!-- OTP box -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;width:100%;">
        <tr>
          <td align="center" style="background-color:#FAFAF8;border:1px solid ${T.border};border-top:3px solid ${T.accentGold};padding:32px 24px;">
            ${sectionHeading('Your one-time code')}
            <p style="margin:12px 0 8px;font-family:${T.monoStack};font-size:44px;font-weight:700;color:${T.textPrimary};letter-spacing:0.35em;line-height:1;">${otp}</p>
            <p style="margin:0;font-family:${T.sansStack};font-size:12px;color:${T.textLight};">Expires in <strong style="color:${T.textMuted};">10 minutes</strong></p>
          </td>
        </tr>
      </table>

      <!-- Security note -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td style="background-color:${T.warnBg};border-left:3px solid ${T.warnBdr};padding:14px 16px;">
            <p style="margin:0;font-family:${T.sansStack};font-size:12px;color:#78350F;line-height:1.6;">Never share this code. Alpha Imports will never ask for it by phone or email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return emailWrapper(body, preheader);
}


// ─── Welcome Email ────────────────────────────────────────────────────────────

export function welcomeEmailHtml(name: string): string {
  const firstName = name.split(' ')[0] || name;

  const features = [
    { icon: '◈', label: 'GIA-certified gemstones', desc: 'Browse thousands of certified diamonds, sapphires, rubies, and emeralds.' },
    { icon: '◈', label: 'Expert consultation', desc: 'Get guidance from our gemologists on sourcing and valuation.' },
    { icon: '◈', label: 'Secure checkout', desc: 'PayPal-protected payments with full order tracking.' },
  ];

  const featureRows = features.map(f => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid ${T.divider};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:1px;">
              <span style="font-family:${T.sansStack};font-size:14px;color:${T.accentGold};">${f.icon}</span>
            </td>
            <td>
              <p style="margin:0 0 3px;font-family:${T.sansStack};font-size:13px;font-weight:700;color:${T.textPrimary};">${f.label}</p>
              <p style="margin:0;font-family:${T.sansStack};font-size:13px;color:${T.textMuted};line-height:1.6;">${f.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');

  const body = `
  <!-- Hero header -->
  <tr>
    <td style="background-color:${T.headerBg};padding:52px 48px 44px;">
      <p style="margin:0 0 20px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">Welcome</p>
      <h1 style="margin:0 0 12px;font-family:${T.fontStack};font-size:36px;font-weight:400;color:#FFFFFF;letter-spacing:-0.01em;line-height:1.15;">Welcome to<br /><em style="color:${T.accentGold};font-style:italic;">Alpha Imports</em></h1>
      <p style="margin:0;font-family:${T.sansStack};font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">Fine gemstones, delivered worldwide.</p>
    </td>
  </tr>
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <!-- Greeting -->
  <tr>
    <td class="email-pad" style="padding:44px 48px 0;">
      <p style="margin:0 0 16px;font-family:${T.fontStack};font-size:20px;color:${T.textPrimary};line-height:1.5;">Dear ${firstName},</p>
      <p style="margin:0 0 36px;font-family:${T.sansStack};font-size:15px;color:${T.textMuted};line-height:1.7;">
        Your account is now active. You have full access to the Alpha Imports platform — explore our curated collection of fine gemstones and diamonds sourced from around the world.
      </p>
    </td>
  </tr>

  <!-- Features -->
  <tr>
    <td class="email-pad" style="padding:0 48px 40px;">
      ${sectionHeading('What you can do')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
        ${featureRows}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td class="email-pad" style="padding:0 48px 44px;">
      ${ctaButton('Explore the Collection', `${SITE_URL}/products`)}
    </td>
  </tr>`;

  return emailWrapper(body, `Your Alpha Imports account is ready — start exploring our collection`);
}


// ─── Password Reset Confirmation ──────────────────────────────────────────────

export function passwordResetConfirmationEmailHtml(name: string): string {
  const firstName = name.split(' ')[0] || name;

  const body = `
  <tr>
    <td style="background-color:${T.headerBg};padding:40px 48px 36px;">
      <p style="margin:0 0 16px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">Security notice</p>
      <h1 style="margin:0;font-family:${T.fontStack};font-size:30px;font-weight:400;color:#FFFFFF;line-height:1.2;">Password updated</h1>
    </td>
  </tr>
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <tr>
    <td class="email-pad" style="padding:44px 48px 40px;">
      <p style="margin:0 0 20px;font-family:${T.fontStack};font-size:19px;color:${T.textPrimary};">Dear ${firstName},</p>
      <p style="margin:0 0 32px;font-family:${T.sansStack};font-size:15px;color:${T.textMuted};line-height:1.7;">
        Your Alpha Imports account password has been successfully updated. You can now sign in with your new credentials.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:36px;">
        <tr>
          <td style="background-color:${T.warnBg};border-left:3px solid ${T.warnBdr};padding:16px 20px;">
            <p style="margin:0;font-family:${T.sansStack};font-size:13px;color:#78350F;line-height:1.6;">
              <strong>Didn't make this change?</strong> Contact us immediately at
              <a href="mailto:${SUPPORT_EMAIL}" style="color:${T.accentGold};text-decoration:none;">${SUPPORT_EMAIL}</a> and we'll help you secure your account.
            </p>
          </td>
        </tr>
      </table>

      ${ctaButton('Sign In', `${SITE_URL}/login`)}
    </td>
  </tr>`;

  return emailWrapper(body, 'Your password has been successfully updated');
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
      <td style="padding:14px 0;border-bottom:1px solid ${T.divider};font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};line-height:1.5;vertical-align:top;">
        <strong style="display:block;font-weight:600;">${item.name}</strong>
        <span style="color:${T.textMuted};font-size:12px;">Qty: ${item.quantity}</span>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid ${T.divider};font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};text-align:right;vertical-align:top;white-space:nowrap;">
        ${formatCurrency(item.price * item.quantity)}
      </td>
    </tr>`).join('');
}

export function orderConfirmationEmailHtml(data: OrderEmailData): string {
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const shortOrderId = data.orderId.slice(-8).toUpperCase();
  const paymentLabel = data.paymentMethod === 'paypal' ? 'PayPal' : 'Cash on Delivery';
  const addr = data.shippingAddress;
  const addressLines = [addr.addressLine1, addr.addressLine2, `${addr.city}, ${addr.state} ${addr.postalCode}`, addr.country].filter(Boolean).join('<br />');

  const body = `
  <!-- Hero -->
  <tr>
    <td style="background-color:${T.headerBg};padding:40px 48px 36px;">
      <p style="margin:0 0 16px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">Order confirmed</p>
      <h1 style="margin:0 0 10px;font-family:${T.fontStack};font-size:32px;font-weight:400;color:#FFFFFF;line-height:1.2;">Thank you, ${firstName}.</h1>
      <p style="margin:0;font-family:${T.sansStack};font-size:14px;color:rgba(255,255,255,0.5);">We've received your order and it's being processed.</p>
    </td>
  </tr>
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <!-- Order ID -->
  <tr>
    <td style="padding:36px 48px 0;" class="email-pad">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background-color:#FAFAF8;border:1px solid ${T.border};padding:16px 24px;">
            ${sectionHeading('Order reference')}
            <p style="margin:6px 0 0;font-family:${T.monoStack};font-size:18px;font-weight:700;color:${T.textPrimary};letter-spacing:0.08em;">#${shortOrderId}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Items -->
  <tr>
    <td class="email-pad" style="padding:32px 48px 0;">
      ${sectionHeading('Items ordered')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;border-top:2px solid ${T.textPrimary};">
        ${orderItemsRows(data.items)}
      </table>
    </td>
  </tr>

  <!-- Totals -->
  <tr>
    <td class="email-pad" style="padding:0 48px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:8px 0;font-family:${T.sansStack};font-size:13px;color:${T.textMuted};">Subtotal</td>
          <td style="padding:8px 0;font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};text-align:right;">${formatCurrency(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-family:${T.sansStack};font-size:13px;color:${T.textMuted};">Shipping</td>
          <td style="padding:8px 0;font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};text-align:right;">${data.shippingCost === 0 ? 'Free' : formatCurrency(data.shippingCost)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-family:${T.sansStack};font-size:13px;color:${T.textMuted};">Tax</td>
          <td style="padding:8px 0;font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};text-align:right;">${formatCurrency(data.tax)}</td>
        </tr>
        <tr>
          <td style="padding:14px 0 4px;font-family:${T.sansStack};font-size:15px;font-weight:700;color:${T.textPrimary};border-top:2px solid ${T.textPrimary};">Total</td>
          <td style="padding:14px 0 4px;font-family:${T.sansStack};font-size:15px;font-weight:700;color:${T.textPrimary};text-align:right;border-top:2px solid ${T.textPrimary};">${formatCurrency(data.totalAmount)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-family:${T.sansStack};font-size:12px;color:${T.textLight};">Payment via</td>
          <td style="padding:4px 0 0;font-family:${T.sansStack};font-size:12px;color:${T.textMuted};text-align:right;">${paymentLabel}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Shipping address -->
  <tr>
    <td class="email-pad" style="padding:0 48px 44px;">
      ${sectionHeading('Shipping to')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;width:100%;">
        <tr>
          <td style="background-color:#FAFAF8;border:1px solid ${T.border};padding:18px 20px;font-family:${T.sansStack};font-size:13px;color:${T.textPrimary};line-height:1.8;">
            <strong>${addr.fullName}</strong><br />${addressLines}
          </td>
        </tr>
      </table>
      <div style="margin-top:28px;">
        ${ctaButton('View Your Order', `${SITE_URL}/orders`)}
      </div>
    </td>
  </tr>`;

  return emailWrapper(body, `Order #${shortOrderId} confirmed — we're processing it now`);
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
  <!-- Hero -->
  <tr>
    <td style="background-color:${T.headerBg};padding:40px 48px 36px;">
      <p style="margin:0 0 16px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">Your order has shipped</p>
      <h1 style="margin:0 0 10px;font-family:${T.fontStack};font-size:32px;font-weight:400;color:#FFFFFF;line-height:1.2;">It's on its way, ${firstName}.</h1>
      <p style="margin:0;font-family:${T.sansStack};font-size:14px;color:rgba(255,255,255,0.5);">Order <strong style="color:rgba(255,255,255,0.7);">#${shortOrderId}</strong> has left our warehouse.</p>
    </td>
  </tr>
  <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>

  <tr>
    <td class="email-pad" style="padding:44px 48px 40px;">
      <!-- Tracking card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
        <tr>
          <td style="background-color:#FAFAF8;border:1px solid ${T.border};border-top:3px solid ${T.accentGold};padding:28px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${data.shippingCarrier ? `<tr>
                <td style="padding-bottom:20px;">
                  ${sectionHeading('Carrier')}
                  <p style="margin:6px 0 0;font-family:${T.sansStack};font-size:16px;font-weight:700;color:${T.textPrimary};">${data.shippingCarrier}</p>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding-bottom:${data.estimatedDelivery ? '20px' : '0'};">
                  ${sectionHeading('Tracking number')}
                  <p style="margin:6px 0 0;font-family:${T.monoStack};font-size:20px;font-weight:700;color:${T.textPrimary};letter-spacing:0.06em;">${data.trackingNumber}</p>
                </td>
              </tr>
              ${data.estimatedDelivery ? `<tr>
                <td>
                  ${sectionHeading('Estimated delivery')}
                  <p style="margin:6px 0 0;font-family:${T.sansStack};font-size:15px;color:${T.textPrimary};">${data.estimatedDelivery}</p>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      ${ctaButton('Track Your Package', trackingLink)}
    </td>
  </tr>`;

  return emailWrapper(body, `Your order #${shortOrderId} has shipped — track it now`);
}


// ─── Newsletter Campaign Email ────────────────────────────────────────────────

export interface NewsletterEmailData {
  title: string;
  subject: string;
  message: string;
  image?: string;
  unsubscribeUrl: string;
}

export function newsletterEmailHtml(data: NewsletterEmailData): string {
  // Hero: use provided image as full-bleed banner, or fall back to dark header
  const heroSection = data.image
    ? `<tr>
        <td style="padding:0;">
          <a href="${SITE_URL}/products" target="_blank" style="display:block;text-decoration:none;">
            <img src="${data.image}" alt="${data.title}" width="640"
              style="display:block;width:100%;max-width:640px;height:auto;border:0;" />
          </a>
        </td>
       </tr>
       <tr>
         <td style="background-color:${T.headerBg};padding:36px 48px 32px;">
           <p style="margin:0 0 10px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">${BRAND_NAME} · Newsletter</p>
           <h1 style="margin:0;font-family:${T.fontStack};font-size:30px;font-weight:400;color:#FFFFFF;line-height:1.25;">${data.title}</h1>
         </td>
       </tr>
       <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>`
    : `<tr>
        <td style="background-color:${T.headerBg};padding:52px 48px 44px;">
          <p style="margin:0 0 16px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.2em;text-transform:uppercase;">${BRAND_NAME} · Newsletter</p>
          <h1 style="margin:0;font-family:${T.fontStack};font-size:36px;font-weight:400;color:#FFFFFF;letter-spacing:-0.01em;line-height:1.2;">${data.title}</h1>
        </td>
       </tr>
       <tr><td style="background-color:${T.accentGold};height:3px;font-size:3px;line-height:3px;">&nbsp;</td></tr>`;

  // Inline-safe rich text transforms
  const messageContent = data.message
    .replace(/<h1([^>]*)>/g, `<h1$1 style="margin:0 0 12px;font-family:${T.fontStack};font-size:26px;font-weight:400;color:${T.textPrimary};line-height:1.3;">`)
    .replace(/<h2([^>]*)>/g, `<h2$1 style="margin:0 0 10px;font-family:${T.fontStack};font-size:20px;font-weight:400;color:${T.textPrimary};line-height:1.35;">`)
    .replace(/<h3([^>]*)>/g, `<h3$1 style="margin:0 0 8px;font-family:${T.sansStack};font-size:14px;font-weight:700;color:${T.textPrimary};text-transform:uppercase;letter-spacing:0.08em;">`)
    .replace(/<p(?!\w)([^>]*)>/g, `<p$1 style="margin:0 0 20px;font-family:${T.sansStack};font-size:15px;color:${T.textMuted};line-height:1.75;">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 20px;padding-left:0;list-style:none;font-family:${T.sansStack};font-size:15px;color:${T.textMuted};line-height:1.75;">`)
    .replace(/<li>/g, `<li style="padding:6px 0 6px 20px;border-bottom:1px solid ${T.divider};position:relative;">`)
    .replace(/<ol>/g, `<ol style="margin:0 0 20px;padding-left:20px;font-family:${T.sansStack};font-size:15px;color:${T.textMuted};line-height:1.75;">`)
    .replace(/<a /g, `<a style="color:${T.accentGold};text-decoration:underline;" `)
    .replace(/<strong>/g, `<strong style="font-weight:700;color:${T.textPrimary};">`);

  const body = `
  ${heroSection}

  <!-- Content -->
  <tr>
    <td class="email-pad" style="padding:44px 48px 36px;">
      <div>${messageContent}</div>

      <!-- Divider -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 32px;">
        <tr>
          <td style="border-top:1px solid ${T.divider};"></td>
          <td style="width:40px;text-align:center;padding:0 12px;">
            <span style="font-family:${T.sansStack};font-size:12px;color:${T.accentGold};">✦</span>
          </td>
          <td style="border-top:1px solid ${T.divider};"></td>
        </tr>
      </table>

      <!-- CTA block -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
        <tr>
          <td style="background-color:#FAFAF8;border:1px solid ${T.border};padding:28px 32px;">
            <p style="margin:0 0 6px;font-family:${T.sansStack};font-size:10px;font-weight:700;color:${T.textLight};letter-spacing:0.18em;text-transform:uppercase;">Explore now</p>
            <p style="margin:0 0 20px;font-family:${T.fontStack};font-size:18px;color:${T.textPrimary};line-height:1.4;">Discover our latest collection of certified gemstones.</p>
            ${ctaButton('Shop the Collection', `${SITE_URL}/products`)}
          </td>
        </tr>
      </table>

      <!-- Unsubscribe -->
      <p style="margin:0;font-family:${T.sansStack};font-size:11px;color:${T.textLight};line-height:1.8;text-align:center;">
        You are receiving this because you subscribed to ${BRAND_NAME} newsletters.<br />
        <a href="${data.unsubscribeUrl}" style="color:${T.textLight};text-decoration:underline;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${SITE_URL}" style="color:${T.textLight};text-decoration:underline;">Visit our store</a>
      </p>
    </td>
  </tr>`;

  return emailWrapper(body, data.subject);
}
// ─── Coupon Email ─────────────────────────────────────────────────────────────

// ─── Coupon Email ─────────────────────────────────────────────────────────────

interface CouponEmailData {
  email: string;
  code: string;
  expiresAt: Date;
  discountPercent: number;
  minPurchase: number;
}

export function couponEmailHtml(data: CouponEmailData): string {
  const expiryStr = new Date(data.expiresAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const discountPercent = data.discountPercent;
  const minPurchase     = data.minPurchase;
  const code            = data.code;
  const siteUrl         = SITE_URL;
  const supportEmail    = SUPPORT_EMAIL;

  const body =
    '<tr>' +
    '<td style="background-color:' + T.headerBg + ';padding:32px 48px 28px;">' +
    '<p style="margin:0;font-family:' + T.sansStack + ';font-size:10px;font-weight:700;color:' + T.accentGold + ';letter-spacing:0.22em;text-transform:uppercase;">Alpha Imports</p>' +
    '<h1 style="margin:10px 0 0;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#F9F7F4;line-height:1.25;">Your ' + discountPercent + '% Off Coupon</h1>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td class="email-pad" style="padding:44px 48px 36px;background-color:' + T.card + ';">' +
    '<p style="margin:0 0 24px;font-family:' + T.sansStack + ';font-size:14px;color:' + T.textMuted + ';line-height:1.7;">' +
    "Thank you for joining the Alpha Imports community. Here's your exclusive discount code — use it on your next order." +
    '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">' +
    '<tr>' +
    '<td style="background-color:#0F3460;border-radius:4px;padding:24px 32px;text-align:center;">' +
    '<p style="margin:0 0 6px;font-family:' + T.sansStack + ';font-size:10px;font-weight:700;color:#8099B5;letter-spacing:0.2em;text-transform:uppercase;">Your Coupon Code</p>' +
    '<p style="margin:0;font-family:' + T.monoStack + ';font-size:30px;font-weight:700;color:#C9A96E;letter-spacing:0.18em;">' + code + '</p>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">' +
    '<tr>' +
    '<td style="background-color:' + T.warnBg + ';border-left:3px solid ' + T.warnBdr + ';padding:16px 20px;">' +
    '<p style="margin:0 0 8px;font-family:' + T.sansStack + ';font-size:11px;font-weight:700;color:' + T.textPrimary + ';letter-spacing:0.1em;text-transform:uppercase;">Terms &amp; Conditions</p>' +
    '<ul style="margin:0;padding-left:18px;font-family:' + T.sansStack + ';font-size:12px;color:' + T.textMuted + ';line-height:1.9;">' +
    '<li>' + discountPercent + '% off your order subtotal</li>' +
    '<li>Minimum purchase of $' + minPurchase + ' required (before shipping)</li>' +
    '<li>Valid for one use only</li>' +
    '<li>Expires on <strong>' + expiryStr + '</strong></li>' +
    '</ul>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px;">' +
    '<tr>' +
    '<td style="background-color:#0F3460;border-radius:2px;">' +
    '<a href="' + siteUrl + '/products" style="display:inline-block;padding:14px 36px;font-family:' + T.sansStack + ';font-size:12px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">Shop Now</a>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '<p style="margin:0;font-family:' + T.sansStack + ';font-size:11px;color:' + T.textLight + ';text-align:center;line-height:1.8;">' +
    'Questions? Reply to this email or contact us at ' +
    '<a href="mailto:' + supportEmail + '" style="color:' + T.accentGold + ';text-decoration:none;">' + supportEmail + '</a>' +
    '</p>' +
    '</td>' +
    '</tr>';

  return emailWrapper(body, 'Your ' + discountPercent + '% off code: ' + code);
}