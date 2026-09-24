/**
 * Returns `target` only if it is a same-site relative path, otherwise
 * `fallback`. Used for every `?redirect=` value the auth flows accept so
 * that a crafted link like /login?redirect=https://evil.example can't
 * bounce a freshly signed-in user to another site.
 *
 * Rejects: absolute URLs, protocol-relative URLs (//evil), backslash
 * tricks (/\evil, which some browsers normalise to //evil), control
 * characters, and anything that resolves off-origin.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/'): string {
  if (!target || typeof target !== 'string') return fallback;
  if (target.length > 2048) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\\]/.test(target)) return fallback;

  try {
    const base = 'https://internal.invalid';
    const url = new URL(target, base);
    if (url.origin !== base) return fallback;
    // Never send someone back into the auth pages after they've signed in.
    if (/^\/(login|signup)(\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
