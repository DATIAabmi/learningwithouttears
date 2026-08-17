import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// Card 180 has no parameters — result never changes between requests.
// Cache for 2 hours to avoid unnecessary Metabase round-trips.
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
let memCache: { rows: unknown[][] } | null = null;
let memCacheAt = 0;
let inflightPromise: Promise<{ rows: unknown[][] }> | null = null;

async function fetchRows() {
  const res = await fetch(`${METABASE_URL}/api/card/598/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: [] }),
    cache: "no-store",
  });
  if (!res.ok) return { rows: [] };
  const data = await res.json();
  return { rows: data.data?.rows ?? [] };
}

export async function GET() {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return cachedJson(memCache);
  if (!inflightPromise) {
    inflightPromise = fetchRows().then((result) => {
      memCache = result; memCacheAt = Date.now(); inflightPromise = null; return result;
    }).catch((err) => { inflightPromise = null; throw err; });
  }
  try {
    const result = await inflightPromise;
    return result.rows.length > 0 ? cachedJson(result) : NextResponse.json(result);
  } catch {
    return NextResponse.json({ rows: [] }, { status: 500 });
  }
}
