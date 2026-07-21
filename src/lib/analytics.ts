const VISITOR_ID_KEY = "alpha_analytics_visitor_id";
const SESSION_ID_KEY = "alpha_analytics_session_id";

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

function getUtmParams() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
  };
}

export async function trackEvent(
  eventType: string,
  data: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    if (!visitorId || !sessionId) return;

    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        ...getUtmParams(),
        ...data,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch (error) {
    console.warn("Analytics event failed:", error);
  }
}

// ── Phase 2 helpers ──────────────────────────────────────────

export function trackProductView(product: {
  id: string;
  name: string;
  category?: string;
  price?: number;
}) {
  trackEvent("product_view", {
    productId: product.id,
    productName: product.name,
    productCategory: product.category,
    productPrice: product.price,
  });
}

export function trackSearch(query: string, resultsCount: number) {
  trackEvent("search", {
    searchQuery: query,
    searchResultsCount: resultsCount,
  });
}

export function trackFilter(filterType: string, filterValue: string) {
  trackEvent("filter_apply", { filterType, filterValue });
}

export function trackCTA(ctaId: string, elementText?: string) {
  trackEvent("cta_click", { ctaId, elementText });
}

export function trackClick(element: string, elementText?: string) {
  trackEvent("click", { element, elementText });
}