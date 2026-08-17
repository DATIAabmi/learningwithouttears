import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 30;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const CACHE_TTL_MS = 30 * 60 * 1000;
type Row = [string, number, number];
const memCache = new Map<string, { data: Row[]; ts: number }>();
const inflight = new Map<string, Promise<Row[]>>();

async function fetchRowsForCampaign(campaign: string, dateStart: string, dateEnd: string): Promise<Row[]> {
  const parameters: object[] = [];
  if (campaign) {
    parameters.push({
      id: "campaign",
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart && dateEnd) {
    parameters.push({
      id: "date",
      type: "date/range",
      value: `${dateStart}~${dateEnd}`,
      target: ["dimension", ["template-tag", "Date"]],
    });
  }

  const res = await fetch(`${METABASE_URL}/api/card/663/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.rows ?? [];
}

function mergeRows(rowSets: Row[][]): Row[] {
  const totals = new Map<string, number>();
  for (const rows of rowSets) {
    for (const [label, count] of rows) {
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([label, count]): Row => [label, count, total > 0 ? count / total : 0])
    .sort((a, b) => b[1] - a[1]);
}

async function getRows(campaigns: string[], dateStart: string, dateEnd: string): Promise<Row[]> {
  const key = `${campaigns.join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = (async () => {
      const rows = campaigns.length <= 1
        ? await fetchRowsForCampaign(campaigns[0] ?? "", dateStart, dateEnd)
        : mergeRows(await Promise.all(campaigns.map((c) => fetchRowsForCampaign(c, dateStart, dateEnd))));
      memCache.set(key, { data: rows, ts: Date.now() });
      inflight.delete(key);
      return rows;
    })();
    p.catch(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const dateStart = searchParams.get("dateStart") ?? "";
    const dateEnd   = searchParams.get("dateEnd")   ?? "";
    const rows = await getRows(campaigns, dateStart, dateEnd);
    return rows.length > 0 ? cachedJson({ rows }) : NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 200 });
  }
}
