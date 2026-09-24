import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Sign in with Google — server-side OpenID Connect, Authorization Code flow
 * with PKCE.
 *
 * Why this flow instead of the Google Identity Services JS button:
 *   - No third-party script on the page, so the existing CSP stays tight and
 *     nothing breaks when a browser blocks third-party cookies / FedCM.
 *   - The client secret and the token exchange never touch the browser.
 *   - It's a plain redirect, so it works in every browser, in-app webviews
 *     that support redirects, and with popup blockers on.
 *
 * Defence in depth on every login:
 *   state         — random, bound to a signed httpOnly cookie → blocks CSRF /
 *                   login-fixation on the callback
 *   PKCE (S256)   — an intercepted `code` is useless without the verifier
 *   nonce         — bound into the ID token → blocks token replay
 *   ID token      — signature verified against Google's JWKS, plus iss, aud,
 *                   exp, nonce and email_verified checks
 */

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS: [string, ...string[]] = ['https://accounts.google.com', 'accounts.google.com'];

export const GOOGLE_STATE_COOKIE = 'g_oauth_state';
export const GOOGLE_STATE_MAX_AGE_SEC = 10 * 60;

export type GoogleFlowMode = 'signin' | 'link';
/** Which page the flow started from, so errors land back on that page. */
export type GoogleFlowOrigin = 'login' | 'signup' | 'account';

export interface GoogleStatePayload {
  state: string;
  verifier: string;
  nonce: string;
  redirect: string;
  redirectUri: string;
  mode: GoogleFlowMode;
  from: GoogleFlowOrigin;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export class GoogleAuthError extends Error {
  /** Short, stable code that the UI maps to a human message. */
  constructor(public code: GoogleErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GoogleAuthError';
  }
}

export type GoogleErrorCode =
  | 'google_unavailable'
  | 'google_cancelled'
  | 'google_state'
  | 'google_failed'
  | 'google_unverified'
  | 'google_conflict'
  | 'google_in_use'
  | 'google_rate_limited'
  | 'google_link_requires_login';

// ─── Config ───────────────────────────────────────────────────────────────────

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleAuthError('google_unavailable', 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set');
  }
  return { clientId, clientSecret };
}

function getStateSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  // Derive a separate key so a state cookie can never be confused with a
  // session JWT (and vice versa), even though both come from JWT_SECRET.
  return crypto.createHmac('sha256', secret).update('google-oauth-state-v1').digest('hex');
}

/**
 * The redirect URI must match one registered in Google Cloud Console
 * *exactly*. Set GOOGLE_REDIRECT_URI explicitly in production; otherwise it
 * is derived from the request origin (handy for localhost and preview
 * deployments, as long as each origin is registered in the console).
 */
export function resolveRedirectUri(requestOrigin: string): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${requestOrigin.replace(/\/$/, '')}/api/auth/google/callback`;
}

// ─── State cookie ─────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createFlowSecrets() {
  const verifier = base64url(crypto.randomBytes(48)); // 64 chars, within RFC 7636's 43–128
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return {
    state: base64url(crypto.randomBytes(32)),
    nonce: base64url(crypto.randomBytes(32)),
    verifier,
    challenge,
  };
}

export function signStateCookie(payload: GoogleStatePayload): string {
  return jwt.sign(payload, getStateSecret(), {
    algorithm: 'HS256',
    expiresIn: GOOGLE_STATE_MAX_AGE_SEC,
  });
}

export function readStateCookie(value: string | undefined): GoogleStatePayload {
  if (!value) throw new GoogleAuthError('google_state', 'Missing state cookie');
  try {
    const decoded = jwt.verify(value, getStateSecret(), { algorithms: ['HS256'] }) as GoogleStatePayload;
    if (!decoded.state || !decoded.verifier || !decoded.nonce || !decoded.redirectUri) {
      throw new Error('incomplete');
    }
    return decoded;
  } catch {
    throw new GoogleAuthError('google_state', 'Invalid or expired state cookie');
  }
}

export function statesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// ─── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthorizationUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
  loginHint?: string;
}): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    // Always show the account chooser — otherwise someone signed into
    // several Google accounts gets silently logged in with whichever is
    // "default", which is the #1 source of "wrong account" support tickets.
    prompt: 'select_account',
    access_type: 'online',
    include_granted_scopes: 'true',
  });
  if (opts.loginHint) params.set('login_hint', opts.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

// ─── Token exchange ───────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeCodeForIdToken(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<string> {
  const { clientId, clientSecret } = getClientCredentials();
  let res: Response;
  try {
    res = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code: opts.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: opts.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: opts.verifier,
      }).toString(),
    });
  } catch (err) {
    throw new GoogleAuthError('google_failed', `Token endpoint unreachable: ${(err as Error).message}`);
  }

  const data = (await res.json().catch(() => null)) as { id_token?: string; error?: string; error_description?: string } | null;
  if (!res.ok || !data?.id_token) {
    // Most common causes: redirect_uri mismatch, code reused (user hit
    // back/refresh on the callback), or the code expired.
    throw new GoogleAuthError(
      'google_failed',
      `Token exchange failed (${res.status}): ${data?.error ?? 'unknown'} ${data?.error_description ?? ''}`.trim()
    );
  }
  return data.id_token;
}

// ─── ID token verification (JWKS) ─────────────────────────────────────────────

type Jwk = crypto.JsonWebKey & { kid: string; alg?: string; use?: string };

let jwksCache: { keys: Map<string, crypto.KeyObject>; expiresAt: number } | null = null;
let jwksInflight: Promise<Map<string, crypto.KeyObject>> | null = null;

async function loadJwks(force = false): Promise<Map<string, crypto.KeyObject>> {
  if (!force && jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  if (jwksInflight) return jwksInflight;

  jwksInflight = (async () => {
    const res = await fetchWithTimeout(GOOGLE_JWKS_ENDPOINT, { method: 'GET' });
    if (!res.ok) throw new GoogleAuthError('google_failed', `JWKS fetch failed (${res.status})`);
    const body = (await res.json()) as { keys: Jwk[] };
    const keys = new Map<string, crypto.KeyObject>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    }
    // Respect Google's Cache-Control max-age (keys rotate roughly weekly);
    // default to one hour, clamp to [5 min, 24 h].
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
    const ttl = Math.min(Math.max(maxAge, 300), 86_400) * 1000;
    jwksCache = { keys, expiresAt: Date.now() + ttl };
    return keys;
  })();

  try {
    return await jwksInflight;
  } finally {
    jwksInflight = null;
  }
}

async function getSigningKey(kid: string): Promise<crypto.KeyObject> {
  let keys = await loadJwks();
  let key = keys.get(kid);
  if (!key) {
    // Key rotation: Google published a new key since we cached. Refetch once.
    keys = await loadJwks(true);
    key = keys.get(kid);
  }
  if (!key) throw new GoogleAuthError('google_failed', `Unknown signing key ${kid}`);
  return key;
}

export async function verifyGoogleIdToken(idToken: string, expectedNonce: string): Promise<GoogleProfile> {
  const { clientId } = getClientCredentials();

  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? decoded.header?.kid : undefined;
  if (!kid || decoded?.header.alg !== 'RS256') {
    throw new GoogleAuthError('google_failed', 'Malformed ID token header');
  }

  const key = await getSigningKey(kid);

  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(idToken, key, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
      clockTolerance: 60, // tolerate small server clock drift
    }) as jwt.JwtPayload;
  } catch (err) {
    throw new GoogleAuthError('google_failed', `ID token rejected: ${(err as Error).message}`);
  }

  if (typeof claims.nonce !== 'string' || !statesMatch(claims.nonce, expectedNonce)) {
    throw new GoogleAuthError('google_state', 'Nonce mismatch');
  }
  if (typeof claims.sub !== 'string' || !claims.sub) {
    throw new GoogleAuthError('google_failed', 'ID token has no subject');
  }
  if (typeof claims.email !== 'string' || !claims.email) {
    throw new GoogleAuthError('google_failed', 'ID token has no email (was the email scope granted?)');
  }

  // Google sends email_verified as a boolean, but historically some tokens
  // carried the string "true".
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

  const email = claims.email.trim().toLowerCase();
  const rawName =
    (typeof claims.name === 'string' && claims.name.trim()) ||
    [claims.given_name, claims.family_name].filter((p) => typeof p === 'string' && p.trim()).join(' ').trim() ||
    email.split('@')[0];

  return {
    sub: claims.sub,
    email,
    emailVerified,
    name: rawName.slice(0, 100),
    picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : undefined,
  };
}
