// ─────────────────────────────────────────────────────────────────────────────
// Newsletter email template — Alpha Gemstone
//
// Same house language as the transactional mails in email-templates.ts (Georgia
// headlines, the gem-cut "facet rule" under the hero, quiet warm neutrals) but
// built for marketing sends:
//   • two header styles (onyx / ivory) and four accent stones
//   • optional banner, headline + sub-headline, personal greeting
//   • rich-text body with email-safe inline styles
//   • call-to-action button, promo-code ticket, featured-products grid
//   • per-recipient merge tags and an honest "why you got this" footer line
// Inline styles + tables only; no web fonts, no JS. 640px max, stacks on mobile.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_NAME = 'Alpha Gemstone';
const BRAND_TAGLINE = 'Fine Gemstones & Diamonds';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@alphagemstone.com';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://alphagemstone.com').replace(/\/$/, '');
const POSTAL_ADDRESS = process.env.NEWSLETTER_POSTAL_ADDRESS || '';
const WIDTH = 640;

const C = {
  page: '#F4F1EC',
  card: '#FFFFFF',
  ink: '#1A1714',
  body: '#4A4540',
  muted: '#8A847C',
  hairline: '#ECE6DC',
  onyx: '#0E0D0B',
  ivory: '#F0EADF',
  serif: "Georgia,'Times New Roman',Times,serif",
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  mono: "'Courier New',Courier,monospace",
};

type AccentKey = 'gold' | 'sapphire' | 'emerald' | 'ruby';

/** base = button fill / rule, btnText = text on that fill,
 *  onDark = accent text on the onyx header, onLight = accent text on white */
const ACCENTS: Record<AccentKey, { base: string; btnText: string; onDark: string; onLight: string; tint: string }> = {
  gold:     { base: '#C9A84C', btnText: '#1A1714', onDark: '#D9BC6A', onLight: '#8C6D22', tint: '#FBF6E8' },
  sapphire: { base: '#1B3A6B', btnText: '#FFFFFF', onDark: '#9DB8E3', onLight: '#1B3A6B', tint: '#EEF2F9' },
  emerald:  { base: '#1B4D3E', btnText: '#FFFFFF', onDark: '#8CCBB0', onLight: '#1B4D3E', tint: '#EDF5F1' },
  ruby:     { base: '#7A1F2B', btnText: '#FFFFFF', onDark: '#E59AA4', onLight: '#7A1F2B', tint: '#F8EEEF' },
};
const GEM_ORDER: AccentKey[] = ['gold', 'sapphire', 'emerald', 'ruby'];

// ─── Public types ─────────────────────────────────────────────────────────────

export interface NewsletterProduct {
  name: string;
  price: number;
  image: string;
  slug: string;
  productId?: string;
}

export interface NewsletterContent {
  title: string;
  subject: string;
  preheader?: string;
  subtitle?: string;
  message: string;
  image?: string;
  headerStyle?: 'onyx' | 'ivory';
  accent?: AccentKey;
  greeting?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  promoCode?: string;
  promoText?: string;
  productsHeading?: string;
  products?: NewsletterProduct[];
}

export interface NewsletterRecipient {
  email: string;
  name?: string;
  /** Decides the "why am I getting this" line in the footer */
  source?: 'website' | 'legacy' | 'user';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function firstNameOf(name?: string): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * {{first_name}}, {{name}}, {{email}} — case-insensitive, spaces allowed.
 * Missing names fall back to "there" so "Hi {{first_name}}," still reads well.
 */
export function applyMergeTags(text: string, r: NewsletterRecipient, escape = true): string {
  const first = firstNameOf(r.name) || 'there';
  const full = (r.name ?? '').trim() || 'there';
  const enc = (v: string) => (escape ? escapeHtml(v) : v);
  return text.replace(/\{\{\s*(first_name|firstname|name|email)\s*\}\}/gi, (_m, key: string) => {
    const k = key.toLowerCase();
    if (k === 'email') return enc(r.email);
    if (k === 'name') return enc(full);
    return enc(first);
  });
}

function absUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|mailto:|tel:|data:)/i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function productUrl(p: Pick<NewsletterProduct, 'slug' | 'productId'>): string {
  return `${SITE_URL}/products/${encodeURIComponent(p.slug || p.productId || '')}`;
}

function formatPrice(n: number): string {
  if (!n || n <= 0) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Adds `base` in front of whatever inline style the tag already has
 *  (so editor styles like text-align survive and win). */
function mergeStyle(html: string, tag: string, base: string): string {
  const re = new RegExp(`<${tag}(\\s[^>]*?)?(\\/?)>`, 'gi');
  return html.replace(re, (_m, attrs: string | undefined, slash: string) => {
    let a = attrs ?? '';
    if (/\sstyle\s*=\s*"/i.test(a)) {
      a = a.replace(/\sstyle\s*=\s*"([^"]*)"/i, (_s, ex: string) => ` style="${base}${ex ? `;${ex}` : ''}"`);
    } else {
      a = `${a.replace(/\s+$/, '')} style="${base}"`;
    }
    return `<${tag}${a}${slash ? ' /' : ''}>`;
  });
}

/** Turns editor HTML into something every mail client renders the same way. */
export function styleRichText(html: string, accentKey: AccentKey): string {
  const a = ACCENTS[accentKey];
  let out = html;

  // TipTap wraps list-item text in <p>; unwrap single-paragraph items so lists
  // don't get paragraph spacing between every bullet.
  out = out.replace(/<li([^>]*)>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/gi, '<li$1>$2</li>');
  // Same for blockquotes.
  out = out.replace(/<blockquote([^>]*)>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/blockquote>/gi, '<blockquote$1>$2</blockquote>');

  // Relative links/images → absolute (mail clients have no base URL)
  out = out.replace(/\s(src|href)="([^"]*)"/gi, (_m, attr: string, url: string) => ` ${attr}="${absUrl(url)}"`);

  const rules: [string, string][] = [
    ['h1', `margin:8px 0 14px;font-family:${C.serif};font-size:28px;font-weight:400;color:${C.ink};line-height:1.25`],
    ['h2', `margin:8px 0 12px;font-family:${C.serif};font-size:22px;font-weight:400;color:${C.ink};line-height:1.3`],
    ['h3', `margin:8px 0 10px;font-family:${C.serif};font-size:18px;font-weight:700;color:${C.ink};line-height:1.35`],
    ['h4', `margin:8px 0 8px;font-family:${C.sans};font-size:14px;font-weight:700;color:${C.ink};line-height:1.4`],
    ['p', `margin:0 0 18px;font-family:${C.sans};font-size:16px;color:${C.body};line-height:1.7`],
    ['ul', `margin:0 0 20px;padding-left:22px;font-family:${C.sans};font-size:16px;color:${C.body};line-height:1.7`],
    ['ol', `margin:0 0 20px;padding-left:22px;font-family:${C.sans};font-size:16px;color:${C.body};line-height:1.7`],
    ['li', 'margin:0 0 8px;padding-left:4px'],
    ['blockquote', `margin:6px 0 24px;padding:4px 0 4px 20px;border-left:3px solid ${a.base};font-family:${C.serif};font-size:19px;font-style:italic;color:${C.ink};line-height:1.55`],
    ['hr', `border:0;border-top:1px solid ${C.hairline};margin:28px 0;height:0`],
    ['img', 'display:block;max-width:100%;height:auto;border:0;margin:6px auto 22px'],
    ['a', `color:${a.onLight};text-decoration:underline`],
    ['strong', `font-weight:700;color:${C.ink}`],
    ['mark', `background-color:${a.tint};color:${C.ink};padding:0 3px`],
    ['table', `width:100%;border-collapse:collapse;margin:0 0 22px;font-family:${C.sans};font-size:14px;color:${C.body}`],
    ['th', `border:1px solid ${C.hairline};padding:8px 10px;background-color:#FAF8F4;text-align:left;color:${C.ink}`],
    ['td', `border:1px solid ${C.hairline};padding:8px 10px;vertical-align:top`],
    ['code', `font-family:${C.mono};font-size:14px;background-color:#F5F2EC;padding:1px 4px`],
  ];
  for (const [tag, style] of rules) out = mergeStyle(out, tag, style);
  return out;
}

// ─── Building blocks ──────────────────────────────────────────────────────────

/** Signature divider: a gold hairline over a row of gem-coloured "teeth",
 *  starting from the campaign's accent stone. Teeth past 18 hide on mobile so
 *  the row never forces horizontal scrolling. */
function facetRule(accentKey: AccentKey, teeth = 34): string {
  const start = GEM_ORDER.indexOf(accentKey);
  const cells = Array.from({ length: teeth }).map((_, i) => {
    const color = ACCENTS[GEM_ORDER[(start + i) % GEM_ORDER.length]].base;
    const cls = i >= 18 ? ' class="nl-hide-m"' : '';
    return `<td${cls} style="padding:0;line-height:0;font-size:0;"><div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:11px solid ${color};">&nbsp;</div></td>`;
  }).join('');
  return `
  <tr><td style="background-color:${ACCENTS[accentKey].base};height:2px;font-size:2px;line-height:2px;">&nbsp;</td></tr>
  <tr>
    <td align="center" style="background-color:${C.card};padding:0;">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
    </td>
  </tr>`;
}

function button(label: string, href: string, accentKey: AccentKey): string {
  const a = ACCENTS[accentKey];
  return `
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${a.base}" style="background-color:${a.base};border-radius:2px;">
        <a href="${href}" target="_blank"
          style="display:inline-block;padding:16px 40px;font-family:${C.sans};font-size:13px;font-weight:700;color:${a.btnText};text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function hero(c: NewsletterContent, accentKey: AccentKey, linkHref: string, sendDate: Date): string {
  const dark = (c.headerStyle ?? 'onyx') === 'onyx';
  const a = ACCENTS[accentKey];
  const bg = dark ? C.onyx : C.ivory;
  const headColor = dark ? '#FFFFFF' : C.ink;
  const subColor = dark ? 'rgba(255,255,255,0.68)' : '#5E5850';
  const kickerColor = dark ? a.onDark : a.onLight;
  const issue = sendDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const banner = c.image
    ? `<tr>
        <td style="padding:0;background-color:${bg};">
          <a href="${linkHref}" target="_blank" style="display:block;text-decoration:none;">
            <img src="${absUrl(c.image)}" alt="${escapeHtml(c.title)}" width="${WIDTH}"
              style="display:block;width:100%;max-width:${WIDTH}px;height:auto;border:0;" />
          </a>
        </td>
      </tr>`
    : '';

  return `
  ${banner}
  <tr>
    <td class="nl-hero" align="center" style="background-color:${bg};padding:${c.image ? '38px 56px 40px' : '58px 56px 52px'};text-align:center;">
      <p style="margin:0 0 18px;font-family:${C.sans};font-size:11px;font-weight:700;color:${kickerColor};letter-spacing:0.24em;text-transform:uppercase;">${BRAND_NAME}&nbsp;&nbsp;&#9670;&nbsp;&nbsp;${issue}</p>
      <h1 class="nl-h1" style="margin:0;font-family:${C.serif};font-size:${c.image ? '32px' : '38px'};font-weight:400;color:${headColor};line-height:1.2;letter-spacing:-0.01em;">${escapeHtml(c.title)}</h1>
      ${c.subtitle ? `<p style="margin:16px auto 0;max-width:460px;font-family:${C.sans};font-size:16px;color:${subColor};line-height:1.6;">${escapeHtml(c.subtitle)}</p>` : ''}
    </td>
  </tr>
  ${facetRule(accentKey)}`;
}

function promoTicket(code: string, text: string, accentKey: AccentKey): string {
  const a = ACCENTS[accentKey];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;">
    <tr>
      <td align="center" style="background-color:${a.tint};border:1px dashed ${a.base};padding:28px 24px;text-align:center;">
        ${text ? `<p style="margin:0 0 14px;font-family:${C.serif};font-size:19px;color:${C.ink};line-height:1.45;">${escapeHtml(text)}</p>` : ''}
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid ${a.base};padding:12px 26px;">
              <span style="font-family:${C.mono};font-size:22px;font-weight:700;color:${a.onLight};letter-spacing:0.22em;">${escapeHtml(code)}</span>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-family:${C.sans};font-size:12px;color:${C.muted};">Enter this code at checkout</p>
      </td>
    </tr>
  </table>`;
}

function productCell(p: NewsletterProduct, accentKey: AccentKey, widthPct: number): string {
  const a = ACCENTS[accentKey];
  const href = productUrl(p);
  const price = formatPrice(p.price);
  return `
  <td class="nl-col" width="${widthPct}%" valign="top" align="center" style="width:${widthPct}%;padding:0 10px 28px;vertical-align:top;text-align:center;">
    <a href="${href}" target="_blank" style="display:block;text-decoration:none;">
      ${p.image
        ? `<img src="${absUrl(p.image)}" alt="${escapeHtml(p.name)}" width="270" style="display:block;width:100%;max-width:270px;height:auto;border:1px solid ${C.hairline};margin:0 auto;" />`
        : `<div style="height:180px;background-color:#FAF8F4;border:1px solid ${C.hairline};">&nbsp;</div>`}
    </a>
    <p style="margin:14px 0 4px;font-family:${C.serif};font-size:16px;color:${C.ink};line-height:1.35;">
      <a href="${href}" target="_blank" style="color:${C.ink};text-decoration:none;">${escapeHtml(p.name)}</a>
    </p>
    ${price ? `<p style="margin:0 0 8px;font-family:${C.sans};font-size:14px;font-weight:700;color:${a.onLight};">${price}</p>` : ''}
    <a href="${href}" target="_blank" style="font-family:${C.sans};font-size:13px;color:${C.body};text-decoration:underline;">View this piece</a>
  </td>`;
}

function productGrid(products: NewsletterProduct[], heading: string, accentKey: AccentKey): string {
  if (!products.length) return '';
  const rows: string[] = [];
  if (products.length === 1) {
    rows.push(`<tr><td width="25%" class="nl-hide-m">&nbsp;</td>${productCell(products[0], accentKey, 50)}<td width="25%" class="nl-hide-m">&nbsp;</td></tr>`);
  } else {
    for (let i = 0; i < products.length; i += 2) {
      const pair = products.slice(i, i + 2);
      const cells = pair.map(p => productCell(p, accentKey, 50)).join('');
      rows.push(pair.length === 2
        ? `<tr>${cells}</tr>`
        // odd one out: centre it under the pair above
        : `<tr><td width="25%" class="nl-hide-m">&nbsp;</td>${cells}<td width="25%" class="nl-hide-m">&nbsp;</td></tr>`);
    }
  }
  return `
  <tr>
    <td class="nl-pad" style="padding:8px 46px 12px;border-top:1px solid ${C.hairline};">
      <h2 style="margin:36px 0 26px;font-family:${C.serif};font-size:24px;font-weight:400;color:${C.ink};text-align:center;line-height:1.3;">${escapeHtml(heading || 'Hand-picked for you')}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>
    </td>
  </tr>`;
}

function reasonLine(source: NewsletterRecipient['source']): string {
  switch (source) {
    case 'user':
      return `You're receiving this because you have an account at ${SITE_URL.replace(/^https?:\/\//, '')}.`;
    case 'legacy':
      return `You're receiving this because you've shopped with ${BRAND_NAME} before.`;
    default:
      return `You're receiving this because you subscribed to the ${BRAND_NAME} newsletter.`;
  }
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderNewsletterEmail(
  content: NewsletterContent,
  recipient: NewsletterRecipient,
  opts: { unsubscribeUrl: string; sendDate?: Date }
): string {
  const accentKey: AccentKey = content.accent && ACCENTS[content.accent] ? content.accent : 'gold';
  const sendDate = opts.sendDate ?? new Date();
  const ctaHref = absUrl(content.ctaUrl?.trim() || '/products');
  const first = firstNameOf(recipient.name);

  // Merge tags in plain-text fields are escaped by escapeHtml() later, so
  // substitute raw values here; in the rich body we substitute escaped values.
  const c: NewsletterContent = {
    ...content,
    title: applyMergeTags(content.title, recipient, false),
    subtitle: content.subtitle ? applyMergeTags(content.subtitle, recipient, false) : '',
    preheader: content.preheader ? applyMergeTags(content.preheader, recipient, false) : '',
  };
  const body = styleRichText(applyMergeTags(content.message, recipient, true), accentKey);

  const greeting = content.greeting
    ? `<p style="margin:0 0 20px;font-family:${C.serif};font-size:20px;color:${C.ink};line-height:1.4;">${first ? `Dear ${escapeHtml(first)},` : 'Hello,'}</p>`
    : '';

  const cta = content.ctaText?.trim()
    ? `<div style="padding:14px 0 6px;">${button(content.ctaText.trim(), ctaHref, accentKey)}</div>`
    : '';

  const promo = content.promoCode?.trim()
    ? `<div style="padding-top:22px;">${promoTicket(content.promoCode.trim().toUpperCase(), content.promoText?.trim() ?? '', accentKey)}</div>`
    : '';

  const preheader = c.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};opacity:0;">${escapeHtml(c.preheader)}${'&nbsp;&zwnj;'.repeat(60)}</div>`
    : '';

  const a = ACCENTS[accentKey];

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(content.subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width:${WIDTH + 20}px){
      .nl-outer{width:100%!important;}
      .nl-pad{padding-left:22px!important;padding-right:22px!important;}
      .nl-hero{padding:40px 24px 36px!important;}
      .nl-h1{font-size:28px!important;}
      .nl-col{display:block!important;width:100%!important;padding:0 0 28px!important;}
      .nl-hide-m{display:none!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${C.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-break:break-word;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};min-width:320px;">
    <tr>
      <td align="center" style="padding:28px 12px 48px;">
        <table role="presentation" class="nl-outer" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${WIDTH}px;max-width:${WIDTH}px;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <a href="${SITE_URL}" target="_blank" style="text-decoration:none;">
                <span style="font-family:${C.serif};font-size:22px;color:${C.ink};letter-spacing:0.06em;">${BRAND_NAME}</span><br />
                <span style="font-family:${C.sans};font-size:10px;color:${C.muted};letter-spacing:0.28em;text-transform:uppercase;">${BRAND_TAGLINE}</span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="width:100%;background-color:${C.card};border:1px solid ${C.hairline};border-radius:3px;overflow:hidden;">
                ${hero(c, accentKey, ctaHref, sendDate)}

                <!-- Body -->
                <tr>
                  <td class="nl-pad" style="padding:44px 56px 40px;">
                    ${greeting}
                    <div>${body}</div>
                    ${cta}
                    ${promo}
                  </td>
                </tr>

                ${productGrid(content.products ?? [], content.productsHeading ?? '', accentKey)}

                <!-- Sign-off -->
                <tr>
                  <td align="center" class="nl-pad" style="padding:6px 56px 40px;text-align:center;">
                    <div style="display:inline-block;width:8px;height:8px;background-color:${a.base};transform:rotate(45deg);">&nbsp;</div>
                    <p style="margin:16px 0 0;font-family:${C.serif};font-size:16px;font-style:italic;color:${C.body};">With warm regards, the ${BRAND_NAME} team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" class="nl-pad" style="padding:28px 40px 0;font-family:${C.sans};font-size:12px;color:${C.muted};line-height:1.8;text-align:center;">
              <a href="${SITE_URL}/products" target="_blank" style="color:${C.body};text-decoration:none;">Shop</a>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <a href="${SITE_URL}/info" target="_blank" style="color:${C.body};text-decoration:none;">About us</a>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.body};text-decoration:none;">Contact</a>
              <br /><br />
              ${reasonLine(recipient.source)}<br />
              Don't want these emails? <a href="${opts.unsubscribeUrl}" target="_blank" style="color:${C.body};text-decoration:underline;">Unsubscribe</a>
              ${POSTAL_ADDRESS ? `<br />${escapeHtml(POSTAL_ADDRESS)}` : ''}
              <br />&copy; ${sendDate.getFullYear()} ${BRAND_NAME}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
