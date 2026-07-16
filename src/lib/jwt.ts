import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET!) as JWTPayload;
}

// NOTE: Auth is cookie-based only. The JWT lives exclusively in the
// httpOnly `auth_token` cookie set by the login/signup/verify-signup routes —
// it is never exposed to client-side JS (no localStorage, no Authorization
// header). See src/middleware/auth.middleware.ts for how it's read back out.
export function extractTokenFromCookie(req: { cookies: { get(name: string): { value: string } | undefined } }): string | null {
  return req.cookies.get('auth_token')?.value ?? null;
}