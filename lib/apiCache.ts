import { NextResponse } from "next/server";

// Shared cache policy for API routes that proxy Metabase/BigQuery queries.
// Vercel's Edge Network caches the JSON response per full URL (query string
// included) for `maxAge` seconds, then serves stale data for up to
// `staleWhileRevalidate` more seconds while refetching in the background —
// so repeat requests for the same filters are near-instant instead of
// round-tripping through Metabase -> BigQuery every time.
const MAX_AGE = 3600;                // 1 hour fresh CDN cache
const STALE_WHILE_REVALIDATE = 86400; // 24 hour stale fallback — always serve instantly, revalidate in background

export function cachedJson<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status,
    headers: {
      "Cache-Control": `public, s-maxage=${MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    },
  });
}
