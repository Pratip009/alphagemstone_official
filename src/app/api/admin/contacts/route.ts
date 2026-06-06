// src/app/api/admin/contacts/route.ts

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { withAdmin } from "@/middleware/auth.middleware";

const LIMIT = 20;

async function handler(req: NextRequest) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page   = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const filter = status && ["unread", "read", "replied"].includes(status)
    ? { status }
    : {};

  const [messages, total, unreadCount] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * LIMIT)
      .limit(LIMIT)
      .lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ status: "unread" }),
  ]);

  return NextResponse.json({
    success: true,          // ← was missing
    messages,
    total,
    unreadCount,            // ← was missing
    page,
    pages: Math.ceil(total / LIMIT),
  });
}

export const GET = withAdmin(handler);