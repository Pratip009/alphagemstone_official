// src/app/api/admin/contacts/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { withAdmin } from "@/middleware/auth.middleware";

// Next.js 15: params must be awaited
async function patchHandler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const { id } = await context.params; // ← await params
  const { status } = await req.json();

  if (!["unread", "read", "replied"].includes(status)) {
    return NextResponse.json(
      { success: false, message: "Invalid status value." },
      { status: 400 }
    );
  }

  const msg = await ContactMessage.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).lean();

  if (!msg) {
    return NextResponse.json(
      { success: false, message: "Message not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, message: msg });
}

async function deleteHandler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const { id } = await context.params; // ← await params

  const msg = await ContactMessage.findByIdAndDelete(id).lean();

  if (!msg) {
    return NextResponse.json(
      { success: false, message: "Message not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, message: "Deleted successfully." });
}

export const PATCH  = withAdmin(patchHandler);
export const DELETE = withAdmin(deleteHandler);