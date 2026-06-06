import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { z } from "zod";

const schema = z.object({
  name:    z.string().min(2, "Name must be at least 2 characters"),
  email:   z.string().email("Invalid email address"),
  phone:   z.string().optional(),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    await dbConnect();
    await ContactMessage.create(parsed.data);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}