"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, trackCTA, trackClick } from "@/lib/analytics";

const HEARTBEAT_INTERVAL = 60_000; // 60s instead of 30s
const IDLE_TIMEOUT = 5 * 60_000;   // stop sending if idle > 5 min

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const lastActiveRef = useRef<number>(Date.now());

  // page views on route change
  useEffect(() => {
    trackEvent("page_view");
  }, [pathname]);

  // delegated click / CTA tracking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest(
        "[data-track-cta], [data-track-click]"
      ) as HTMLElement | null;
      if (!target) return;

      if (target.hasAttribute("data-track-cta")) {
        trackCTA(
          target.getAttribute("data-track-cta") || "unknown",
          target.textContent?.trim().slice(0, 100)
        );
      } else {
        trackClick(
          target.getAttribute("data-track-click") || target.tagName.toLowerCase(),
          target.textContent?.trim().slice(0, 100)
        );
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // track user activity (for idle detection)
  useEffect(() => {
    const markActive = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("scroll", markActive);
    window.addEventListener("click", markActive);

    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("scroll", markActive);
      window.removeEventListener("click", markActive);
    };
  }, []);

  // session start + heartbeat
  useEffect(() => {
    trackEvent("session_start");

    const heartbeat = setInterval(() => {
      // skip entirely if tab isn't visible
      if (document.visibilityState !== "visible") return;

      // skip if user has been idle too long
      const idleFor = Date.now() - lastActiveRef.current;
      if (idleFor > IDLE_TIMEOUT) return;

      trackEvent("heartbeat");
    }, HEARTBEAT_INTERVAL);

    // send session_end when the tab actually closes/hides for good
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        trackEvent("session_end");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}