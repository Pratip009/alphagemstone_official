import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { login } from "@/services/auth.service";
import { errorResponse } from "@/lib/api-response";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation";
import { z } from "zod";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
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

    const acctLimit = await rateLimit(req, {
      id: "login-acct",
      limit: 5,
      windowSec: 900,
      extraKey: email.toLowerCase(),
      scope: "key",
    });
    if (!acctLimit.success) return rateLimitResponse(acctLimit);

    const result = await login(email, password);

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

    return response;
  } catch (err) {
    console.error("[login]", err);
    return errorResponse("Invalid email or password", 401);
  }
}