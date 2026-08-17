import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const CAMPAIGN_COL = 2;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Topic_Score: "Topic Score",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Cache keyed by date range — campaign/district/state/topic are all local filters.
// Most requests have no date filter so they share a single cached entry.
type Dataset = { cols: { display_name: string; base_type: string }[]; rows: unknown[][] };
const memCache = new Map<string, { data: Dataset; ts: number }>();
const inflight = new Map<string, Promise<Dataset>>();

async function fetchDataset(dateStart: string, dateEnd: string): Promise<Dataset> {
  const parameters: object[] = [];
  if (dateStart && dateEnd) parameters.push({ id: "date", type: "date/range", value: `${dateStart}~${dateEnd}`, target: ["dimension", ["template-tag", "Last_Updated"]] });

  const res = await fetch(`${METABASE_URL}/api/card/599/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) return { cols: [], rows: [] };

  const data = await res.json();
  const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
    display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
    base_type: c.base_type,
  }));
  const rows: unknown[][] = (data.data?.rows ?? []).map((row: unknown[]) =>
    row.map((val, j) => j === CAMPAIGN_COL && typeof val === "string" ? val.split(":")[0].trim() : val)
  );
  return { cols, rows };
}

async function getDataset(dateStart: string, dateEnd: string): Promise<Dataset> {
  const key = `${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = fetchDataset(dateStart, dateEnd).then((result) => {
      memCache.set(key, { data: result, ts: Date.now() });
      inflight.delete(key);
      return result;
    }).catch((err) => { inflight.delete(key); throw err; });
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = parseList(searchParams.get("campaign"));
  const districts = parseList(searchParams.get("district"));
  const states    = parseList(searchParams.get("state"));
  const topics    = parseList(searchParams.get("topic"));
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  try {
    const { cols, rows: allRows } = await getDataset(dateStart, dateEnd);
    const districtCol = cols.findIndex((c) => c.display_name === "District");
    const stateCol    = cols.findIndex((c) => c.display_name === "State");
    const topicCol    = cols.findIndex((c) => c.display_name === "Topic");
    const campaignShortCodes = campaigns.map((c) => c.split(":")[0].trim());

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    const rows = allRows
      .filter(matches(campaignShortCodes, CAMPAIGN_COL))
      .filter(matches(districts, districtCol))
      .filter(matches(states, stateCol))
      .filter(matches(topics, topicCol));

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
