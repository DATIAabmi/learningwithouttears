import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Camp:        "Campaign",
  Down:        "Downloads",
  EngagedUser: "Engaged Users",
  UniqueLeads: "Leads",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// In-memory cache for the full dataset — avoids hitting Metabase/BigQuery on
// every filter change since all filtering is done server-side anyway.
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let memCache: { cols: { display_name: string; base_type: string }[]; rows: unknown[][] } | null = null;
let memCacheAt = 0;
// Track whether a fetch is in progress so concurrent requests share one call
let inflightPromise: Promise<{ cols: { display_name: string; base_type: string }[]; rows: unknown[][] }> | null = null;

async function fetchFullDataset() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  let res: Response;
  try {
    res = await fetch(`${METABASE_URL}/api/card/636/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: [] }),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return { cols: [], rows: [] };

  const data = await res.json();
  const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
    display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
    base_type: c.base_type,
  }));
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
}

async function getDataset() {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;
  if (!inflightPromise) {
    inflightPromise = fetchFullDataset().then((result) => {
      memCache = result;
      memCacheAt = Date.now();
      inflightPromise = null;
      return result;
    }).catch((err) => {
      inflightPromise = null;
      throw err;
    });
  }
  return inflightPromise;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts = parseList(searchParams.get("district"));
    const domains   = parseList(searchParams.get("domain"));
    const states    = parseList(searchParams.get("state"));

    const { cols, rows: allRows } = await getDataset();
    let rows: unknown[][] = allRows;

    const districtCol  = cols.findIndex((c) => c.display_name === "District");
    const domainCol    = cols.findIndex((c) => c.display_name === "Domain");
    const stateCol     = cols.findIndex((c) => c.display_name === "State");
    const campaignCol  = cols.findIndex((c) => c.display_name === "Campaign");
    const campaignShortCodes = campaigns.map((c) => c.split(":")[0].trim());

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    rows = rows
      .filter(matches(campaignShortCodes, campaignCol))
      .filter(matches(districts, districtCol))
      .filter(matches(domains, domainCol))
      .filter(matches(states, stateCol));

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
