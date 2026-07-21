import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AnalyticsEvent from "@/models/AnalyticsEvent";
import AnalyticsSession from "@/models/AnalyticsSession";

interface AnalyticsPayload {
  sessionId: string;
  visitorId: string;

  eventType:
    | "page_view"
    | "click"
    | "session_start"
    | "session_end"
    | "heartbeat";

  page?: string;
  pageTitle?: string;

  element?: string;
  elementText?: string;

  productId?: string;
  productName?: string;

  metadata?: Record<string, unknown>;

  timestamp?: string;

  device?: {
    type?: string;
    browser?: string;
    os?: string;
    screenWidth?: number;
    screenHeight?: number;
  };

  referrer?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyticsPayload = await request.json();

    if (!body.sessionId || !body.visitorId || !body.eventType) {
      return NextResponse.json(
        { success: false, message: "sessionId, visitorId and eventType are required" },
        { status: 400 }
      );
    }

    await connectDB();
    const now = new Date();

    // Only persist an event row for things that matter — heartbeats
    // just keep the session alive and shouldn't bloat AnalyticsEvent.
    if (body.eventType !== "heartbeat") {
      await AnalyticsEvent.create({
        sessionId: body.sessionId,
        visitorId: body.visitorId,
        eventType: body.eventType,
        page: body.page,
        pageTitle: body.pageTitle,
        element: body.element,
        elementText: body.elementText,
        productId: body.productId,
        productName: body.productName,
        metadata: body.metadata || {},
        timestamp: body.timestamp ? new Date(body.timestamp) : now,
      });
    }

    // Session upsert stays the same for ALL event types (including heartbeat)
    const session = await AnalyticsSession.findOneAndUpdate(
      { sessionId: body.sessionId },
      {
        $set: {
          lastActivityAt: now,
          ...(body.page && { exitPage: body.page }),
        },
        $setOnInsert: {
          visitorId: body.visitorId,
          startedAt: now,
          entryPage: body.page,
          landingPage: body.page,
          device: body.device,
          referrer: body.referrer,
        },
        $inc: {
          eventCount: 1,
          ...(body.eventType === "page_view" ? { pageViews: 1 } : {}),
        },
      },
      { upsert: true, new: true }
    );

    if (session) {
      const duration = Math.max(
        0,
        Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      );
      await AnalyticsSession.updateOne(
        { sessionId: body.sessionId },
        { $set: { duration } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics tracking error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to track analytics event" },
      { status: 500 }
    );
  }
}