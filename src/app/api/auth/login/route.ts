import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { login } from "@/services/auth.service";
import { errorResponse } from "@/lib/api-response";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { extractGuestId, clearGuestCookie } from "@/lib/guest";
import { mergeGuestCartIntoUser } from "@/services/cart.service";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // IP-based: 10 attempts / 5 min stops scripted brute force without
    // punishing someone who just mistypes their password a couple times.
    const ipLimit = await rateLimit(req, {
      id: "login-ip",
      limit: 10,
      windowSec: 300,
    });
    if (!ipLimit.success) return rateLimitResponse(ipLimit);

    await connectDB();
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email, password } = parsed.data;

    // Per-account: 5 attempts / 15 min on this specific email, so a
    // distributed attack (many IPs, one target account) is still capped.
    const acctLimit = await rateLimit(req, {
      id: "login-acct",
      limit: 5,
      windowSec: 900,
      extraKey: email.toLowerCase(),
      scope: "key",
    });
    if (!acctLimit.success) return rateLimitResponse(acctLimit);

    const result = await login(email, password);

    // Only `user` goes in the JSON body. The token is set below as an
    // httpOnly cookie — putting it in the body too would hand any XSS
    // the same plaintext token that httpOnly is meant to keep out of JS.
    const response = NextResponse.json(
      { success: true, data: { user: result.user } },
      { status: 200 },
    );

    response.cookies.set("auth_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    response.cookies.set("has_session", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    // If they were shopping as a guest before logging in, fold that cart
    // into their account cart rather than losing it — see cart.service's
    // mergeGuestCartIntoUser docblock. Never let a merge failure block login.
    const guestId = extractGuestId(req);
    if (guestId) {
      try {
        await mergeGuestCartIntoUser(guestId, result.user.id);
      } catch (mergeErr) {
        console.error("[login] guest cart merge failed:", mergeErr);
      }
      clearGuestCookie(response);
    }

    return response;
  } catch (err) {
    console.error("[login]", err);
    // ✅ fixed: generic message to prevent email enumeration
    return errorResponse("Invalid email or password", 401);
  }
}
