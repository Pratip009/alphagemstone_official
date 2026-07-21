import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AnalyticsEvent from "@/models/AnalyticsEvent";
import AnalyticsSession from "@/models/AnalyticsSession";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "7d";

    const now = new Date();

    let startDate = new Date();

    if (range === "24h") {
      startDate.setHours(now.getHours() - 24);
    }

    if (range === "7d") {
      startDate.setDate(now.getDate() - 7);
    }

    if (range === "30d") {
      startDate.setDate(now.getDate() - 30);
    }

    if (range === "90d") {
      startDate.setDate(now.getDate() - 90);
    }

    // ------------------------------------------------
    // BASIC TOTALS
    // ------------------------------------------------

    const [
      totalVisitors,
      totalPageViews,
      totalSessions,
      totalEvents,
    ] = await Promise.all([
      AnalyticsEvent.distinct("visitorId", {
        timestamp: { $gte: startDate },
      }),

      AnalyticsEvent.countDocuments({
        eventType: "page_view",
        timestamp: { $gte: startDate },
      }),

      AnalyticsSession.countDocuments({
        startedAt: { $gte: startDate },
      }),

      AnalyticsEvent.countDocuments({
        timestamp: { $gte: startDate },
      }),
    ]);

    // ------------------------------------------------
    // AVERAGE SESSION DURATION
    // ------------------------------------------------

    const sessionDurationResult =
      await AnalyticsSession.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate },
          },
        },

        {
          $group: {
            _id: null,

            averageDuration: {
              $avg: "$duration",
            },
          },
        },
      ]);

    const averageSessionDuration =
      sessionDurationResult[0]?.averageDuration || 0;

    // ------------------------------------------------
    // ACTIVE USERS
    // Active in last 5 minutes
    // ------------------------------------------------

    const fiveMinutesAgo = new Date(
      now.getTime() - 5 * 60 * 1000
    );

    const activeUsers = await AnalyticsSession.countDocuments({
      lastActivityAt: {
        $gte: fiveMinutesAgo,
      },
    });

    // ------------------------------------------------
    // DAILY VISITORS
    // ------------------------------------------------

    const dailyVisitors = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: "page_view",
          timestamp: { $gte: startDate },
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
            },
          },

          visitors: {
            $addToSet: "$visitorId",
          },

          pageViews: {
            $sum: 1,
          },
        },
      },

      {
        $project: {
          _id: 0,

          date: "$_id",

          visitors: {
            $size: "$visitors",
          },

          pageViews: 1,
        },
      },

      {
        $sort: {
          date: 1,
        },
      },
    ]);

    // ------------------------------------------------
    // TOP PAGES
    // ------------------------------------------------

    const topPages = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: "page_view",
          timestamp: { $gte: startDate },
        },
      },

      {
        $group: {
          _id: "$page",

          views: {
            $sum: 1,
          },

          visitors: {
            $addToSet: "$visitorId",
          },
        },
      },

      {
        $project: {
          _id: 0,

          page: "$_id",

          views: 1,

          visitors: {
            $size: "$visitors",
          },
        },
      },

      {
        $sort: {
          views: -1,
        },
      },

      {
        $limit: 10,
      },
    ]);

    // ------------------------------------------------
    // DEVICE BREAKDOWN
    // ------------------------------------------------

    const deviceBreakdown = await AnalyticsSession.aggregate([
      {
        $match: {
          startedAt: { $gte: startDate },
        },
      },

      {
        $group: {
          _id: "$device.type",

          count: {
            $sum: 1,
          },
        },
      },

      {
        $project: {
          _id: 0,

          device: "$_id",

          count: 1,
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    // ------------------------------------------------
    // TOP EVENTS
    // ------------------------------------------------

    const topEvents = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: {
            $ne: "heartbeat",
          },

          timestamp: {
            $gte: startDate,
          },
        },
      },

      {
        $group: {
          _id: "$eventType",

          count: {
            $sum: 1,
          },
        },
      },

      {
        $project: {
          _id: 0,

          event: "$_id",

          count: 1,
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    return NextResponse.json({
      success: true,

      data: {
        summary: {
          totalVisitors: totalVisitors.length,

          totalPageViews,

          totalSessions,

          totalEvents,

          averageSessionDuration: Math.round(
            averageSessionDuration
          ),

          activeUsers,
        },

        dailyVisitors,

        topPages,

        deviceBreakdown,

        topEvents,
      },
    });
  } catch (error) {
    console.error(
      "Analytics overview error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Failed to load analytics overview",
      },
      {
        status: 500,
      }
    );
  }
}