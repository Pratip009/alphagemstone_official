"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("page_view");
  }, [pathname]);

  useEffect(() => {
    trackEvent("session_start");

    const heartbeat = setInterval(() => {
      trackEvent("heartbeat");
    }, 30_000);

    return () => {
      clearInterval(heartbeat);
    };
  }, []);

  return null;
}