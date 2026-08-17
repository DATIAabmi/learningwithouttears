"use client";

import { useEffect } from "react";
import { DEFAULT_CAMPAIGN } from "@/lib/campaigns";

const c = encodeURIComponent(DEFAULT_CAMPAIGN);

// All data routes in priority order — fired in parallel so every tab is warm
// by the time the user navigates to it. Uses priority:"low" so the active
// page's own fetches always win.
const PREFETCH_ROUTES = [
  `/api/funnel-data?campaign=${c}`,
  `/api/q363-data?campaign=${c}`,
  `/api/q405-data?campaign=${c}`,
  `/api/q425-data?campaign=${c}`,
  `/api/leads-summary?campaign=${c}`,
  `/api/q174-data?campaign=${c}`,
  `/api/q181-data?campaign=${c}`,
  `/api/q180-data`,
  `/api/content-data?campaign=${c}`,
  `/api/q168-data?campaign=${c}`,
  `/api/q169-data?campaign=${c}`,
];

export default function BackgroundPrefetch() {
  useEffect(() => {
    // Fire all prefetches in parallel immediately — CDN responses are <50 ms
    // when warm, so there's no meaningful contention with the active page fetch.
    for (const route of PREFETCH_ROUTES) {
      fetch(route, { priority: "low" } as RequestInit).catch(() => {});
    }
  }, []);

  return null;
}
