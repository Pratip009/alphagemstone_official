import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromCookie, JWTPayload } from '@/lib/jwt';
import { extractGuestId, generateGuestId, attachGuestCookie } from '@/lib/guest';

export type AuthenticatedRequest = NextRequest & {
  user: JWTPayload;
};

type RouteHandler = (
  req: AuthenticatedRequest,
  context: any
) => Promise<Response>;

export function withAuth(handler: RouteHandler) {
  return async (
    req: NextRequest,
    context: any
  ): Promise<Response> => {
    try {
      const token = extractTokenFromCookie(req);

      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Authentication required' },
          { status: 401 }
        );
      }

      const payload = verifyToken(token);
      (req as AuthenticatedRequest).user = payload;
      return handler(req as AuthenticatedRequest, context);
    } catch (err) {
      console.error('Auth verification failed:', err);
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }
  };
}

export function withAdmin(handler: RouteHandler) {
  return withAuth(
    async (
      req: AuthenticatedRequest,
      context: any
    ): Promise<Response> => {
      if (req.user.role !== 'admin') {
        return NextResponse.json(
          { success: false, message: 'Admin access required' },
          { status: 403 }
        );
      }
      return handler(req, context);
    }
  );
}

// ─── Cart/checkout identity ─────────────────────────────────────────────────
// Cart, checkout, and order-creation endpoints need *an* identity to key
// data on, but that identity may be a logged-in user OR an anonymous guest.
// withCartAuth never 401s: it resolves whichever identity is available and,
// for a first-time visitor with neither an auth cookie nor a guest cookie,
// mints a new guest id and attaches it to the response.
export type CartIdentity =
  | { userId: string; guestId?: undefined }
  | { userId?: undefined; guestId: string };

export type CartAuthenticatedRequest = NextRequest & {
  identity: CartIdentity;
  user?: JWTPayload;
};

type CartRouteHandler = (
  req: CartAuthenticatedRequest,
  context: any
) => Promise<Response>;

export function withCartAuth(handler: CartRouteHandler) {
  return async (req: NextRequest, context: any): Promise<Response> => {
    const cartReq = req as CartAuthenticatedRequest;
    let mintedGuestId: string | null = null;

    const token = extractTokenFromCookie(req);
    let resolvedFromToken = false;
    if (token) {
      try {
        const payload = verifyToken(token);
        cartReq.user = payload;
        cartReq.identity = { userId: payload.userId };
        resolvedFromToken = true;
      } catch (err) {
        // Expired/invalid token mid-checkout shouldn't strand a guest cart —
        // fall through to guest identity instead of 401ing the request.
        console.error('Cart auth: ignoring invalid token, falling back to guest:', err);
      }
    }

    if (!resolvedFromToken) {
      const existingGuestId = extractGuestId(req);
      if (existingGuestId) {
        cartReq.identity = { guestId: existingGuestId };
      } else {
        mintedGuestId = generateGuestId();
        cartReq.identity = { guestId: mintedGuestId };
      }
    }

    const res = await handler(cartReq, context);

    if (mintedGuestId && res instanceof NextResponse) {
      attachGuestCookie(res, mintedGuestId);
    }

    return res;
  };
}

export function withOptionalAuth(
  handler: (
    req: NextRequest & { user?: JWTPayload },
    context: any
  ) => Promise<Response>
) {
  return async (
    req: NextRequest,
    context: any
  ): Promise<Response> => {
    try {
      const token = extractTokenFromCookie(req);
      if (token) {
        const payload = verifyToken(token);
        (req as NextRequest & { user?: JWTPayload }).user = payload;
      }
    } catch (err) {
      console.error('Optional auth verification failed:', err);
    }

    return handler(req as NextRequest & { user?: JWTPayload }, context);
  };
}