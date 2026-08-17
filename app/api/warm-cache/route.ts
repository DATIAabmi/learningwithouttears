import { NextResponse } from "next/server";

export const maxDuration = 60;

// Called by Vercel cron every 4 minutes to keep q405-data in-memory cache warm.
// Uses VERCEL_URL (set automatically by Vercel) for internal routing.
export async function GET() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const DEFAULT = "C6%3A%20April%20-%20May%202026"; // URL-encoded DEFAULT_CAMPAIGN
    const results = await Promise.all([
      fetch(`${base}/api/funnel-data?campaign=${DEFAULT}`,   { cache: "no-store" }),
      fetch(`${base}/api/q363-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/q405-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/q425-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/leads-summary?campaign=${DEFAULT}`, { cache: "no-store" }),
      fetch(`${base}/api/q174-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/q181-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/q180-data`,                         { cache: "no-store" }),
      fetch(`${base}/api/content-data?campaign=${DEFAULT}`,  { cache: "no-store" }),
      fetch(`${base}/api/q168-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/q169-data?campaign=${DEFAULT}`,     { cache: "no-store" }),
      fetch(`${base}/api/ai-signals-data`,                   { cache: "no-store" }),
    ]);
    const names = ["funnel","q363","q405","q425","leads","q174","q181","q180","content","q168","q169","ai-signals"];
    return NextResponse.json(Object.fromEntries(names.map((n, i) => [n, { ok: results[i].ok }])));
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
