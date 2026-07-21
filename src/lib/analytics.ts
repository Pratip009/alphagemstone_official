const VISITOR_ID_KEY = "alpha_analytics_visitor_id";
const SESSION_ID_KEY = "alpha_analytics_session_id";

const SESSION_DURATION = 30 * 60 * 1000;

function generateId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function getVisitorId() {
  if (typeof window === "undefined") return null;

  let visitorId = localStorage.getItem(VISITOR_ID_KEY);

  if (!visitorId) {
    visitorId = generateId("visitor");
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }

  return visitorId;
}

export function getSessionId() {
  if (typeof window === "undefined") return null;

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = generateId("session");
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}

function getDeviceType() {
  if (typeof window === "undefined") return "unknown";

  const width = window.innerWidth;

  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";

  return "desktop";
}

export async function trackEvent(
  eventType:
    | "page_view"
    | "click"
    | "session_start"
    | "session_end"
    | "heartbeat",
  data: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();

    if (!visitorId || !sessionId) return;

    await fetch("/api/analytics/track", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        visitorId,
        sessionId,

        eventType,

        page: window.location.pathname,

        pageTitle: document.title,

        referrer: document.referrer,

        device: {
          type: getDeviceType(),
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        },

        ...data,

        timestamp: new Date().toISOString(),
      }),

      keepalive: true,
    });
  } catch (error) {
    // Analytics should never break the actual website
    console.warn("Analytics event failed:", error);
  }
}