import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const CACHE_TTL_MS = 30 * 60 * 1000;
type SummaryResult = { totalDownloads: unknown; totalUniqueLeads: unknown; uniqueLeadDistrict: unknown; byContentType: unknown; byContentName: unknown };
const memCache = new Map<string, { data: SummaryResult; ts: number }>();
const inflight = new Map<string, Promise<SummaryResult>>();

async function fetchCard(cardId: number, params: object[]) {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: params }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.rows ?? null;
}

function sum(values: (string | number | null | undefined)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function mergeLabeledCounts(rowSets: [string, number][][]): [string, number][] {
  const totals = new Map<string, number>();
  for (const rows of rowSets) {
    for (const [label, count] of rows) {
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

async function fetchSummaryForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const params: object[] = [];
  if (campaign) params.push({ id: "campaign", type: "string/=", value: campaign, target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart && dateEnd) params.push({ id: "date", type: "date/range", value: `${dateStart}~${dateEnd}`, target: ["dimension", ["template-tag", "Last_Updated"]] });

  const [r175, r176, r177, r178, r179] = await Promise.all([
    fetchCard(593, params),
    fetchCard(594, params),
    fetchCard(595, params),
    fetchCard(596, params),
    fetchCard(597, params),
  ]);

  return {
    totalDownloads:     r175?.[0]?.[0] ?? null,
    totalUniqueLeads:   r176?.[0]?.[0] ?? null,
    uniqueLeadDistrict: r177?.[0]?.[0] ?? null,
    byContentType: (r178 ?? []) as [string, number][],
    byContentName: (r179 ?? []) as [string, number][],
  };
}

async function getResult(campaigns: string[], dateStart: string, dateEnd: string): Promise<SummaryResult> {
  const key = `${campaigns.join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = (async () => {
      let result: SummaryResult;
      if (campaigns.length <= 1) {
        result = await fetchSummaryForCampaign(campaigns[0] ?? "", dateStart, dateEnd);
      } else {
        const perCampaign = await Promise.all(campaigns.map((c) => fetchSummaryForCampaign(c, dateStart, dateEnd)));
        result = {
          totalDownloads:     sum(perCampaign.map((r) => r.totalDownloads)),
          totalUniqueLeads:   sum(perCampaign.map((r) => r.totalUniqueLeads)),
          uniqueLeadDistrict: sum(perCampaign.map((r) => r.uniqueLeadDistrict)),
          byContentType: mergeLabeledCounts(perCampaign.map((r) => r.byContentType)),
          byContentName: mergeLabeledCounts(perCampaign.map((r) => r.byContentName)),
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
  const dateEnd = searchParams.get("dateEnd") ?? "";
  return cachedJson(await getResult(campaigns, dateStart, dateEnd));
}
