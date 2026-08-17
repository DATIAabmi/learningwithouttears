import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const CACHE_TTL_MS = 30 * 60 * 1000;
type FunnelResult = { impressions: unknown; engagements: unknown; ctr: unknown; engagedUsers: unknown; leads: unknown };
const memCache = new Map<string, { data: FunnelResult; ts: number }>();
const inflight = new Map<string, Promise<FunnelResult>>();

function buildParams(campaign: string, dateStart: string, dateEnd: string): object[] {
  const params: object[] = [];
  if (campaign) {
    params.push({
      id: "campaign",
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart && dateEnd) {
    params.push({
      id: "date",
      type: "date/range",
      value: `${dateStart}~${dateEnd}`,
      target: ["dimension", ["template-tag", "Date"]],
    });
  }
  return params;
}

// Cards 308 (Engaged Users) and 314 (Leads) filter on the actual per-event
// date nested inside the `engagement` array (via UNNEST), not a row-level
// column — Metabase's auto-generated field-filter SQL can't target that, so
// these two cards take plain date variables instead of the Date dimension.
function buildLeadsParams(campaign: string, dateStart: string, dateEnd: string): object[] {
  const params: object[] = [];
  if (campaign) {
    params.push({
      id: "campaign",
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart) {
    params.push({
      id: "start_date",
      type: "date/single",
      value: dateStart,
      target: ["variable", ["template-tag", "start_date"]],
    });
  }
  if (dateEnd) {
    params.push({
      id: "end_date",
      type: "date/single",
      value: dateEnd,
      target: ["variable", ["template-tag", "end_date"]],
    });
  }
  return params;
}

async function fetchScalar(cardId: number, params: object[]): Promise<string | number | null> {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: params }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.data?.rows ?? [];
    return rows[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

function sum(values: (string | number | null)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

// ctr scalars come back pre-formatted (e.g. "1.72%"), so strip non-numeric
// characters before averaging, then re-format to match that same shape.
function avgPct(values: (string | number | null)[]): string | null {
  const nums = values
    .map((v) => (typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) : Number(v)))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return `${avg.toFixed(2)}%`;
}

async function fetchFunnelForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const params = buildParams(campaign, dateStart, dateEnd);
  const engagementParams = buildLeadsParams(campaign, dateStart, dateEnd);
  const [impressions, engagements, ctr, engagedUsers, leads] =
    await Promise.all([
      fetchScalar(633, params),
      fetchScalar(634, params),
      fetchScalar(635, params),
      fetchScalar(631, engagementParams),
      fetchScalar(632, engagementParams),
    ]);
  return { impressions, engagements, ctr, engagedUsers, leads };
}

async function getResult(campaigns: string[], dateStart: string, dateEnd: string): Promise<FunnelResult> {
  const key = `${campaigns.join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = (async () => {
      let result: FunnelResult;
      if (campaigns.length <= 1) {
        result = await fetchFunnelForCampaign(campaigns[0] ?? "", dateStart, dateEnd);
      } else {
        const perCampaign = await Promise.all(campaigns.map((c) => fetchFunnelForCampaign(c, dateStart, dateEnd)));
        result = {
          impressions:  sum(perCampaign.map((r) => r.impressions)),
          engagements:  sum(perCampaign.map((r) => r.engagements)),
          ctr:          avgPct(perCampaign.map((r) => r.ctr)),
          engagedUsers: sum(perCampaign.map((r) => r.engagedUsers)),
          leads:        sum(perCampaign.map((r) => r.leads)),
        };
      }
      memCache.set(key, { data: result, ts: Date.now() });
      inflight.delete(key);
      return result;
    })();
    p.catch(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";
  const result = await getResult(campaigns, dateStart, dateEnd);
  // Don't cache null responses — Metabase may have returned an error or timed out.
  // Let the next request retry rather than serving stale nulls from CDN.
  const hasData = result.impressions !== null || result.engagements !== null;
  return hasData ? cachedJson(result) : NextResponse.json(result);
}
