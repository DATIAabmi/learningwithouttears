import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { CAMPAIGNS } from "@/lib/campaigns";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const CACHE_TTL_MS = 30 * 60 * 1000;
type SummaryResult = { totalDownloads: unknown; totalUniqueLeads: unknown; uniqueLeadDistrict: unknown; byContentType: unknown; byContentName: unknown; byState: unknown };
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

// Each card's Abmi_Campaign tag has its own distinct UUID (verified against
// Metabase) -- the generic "campaign" id this route used before silently
// no-ops instead of erroring, so selecting 2 campaigns summed two full
// unfiltered totals and doubled every number (same bug fixed previously in
// content-data/route.ts, found again here when C1+C2 became the default
// selection).
const CAMPAIGN_TAG_ID: Record<number, string> = {
  593: "4bd962bf-a3a7-4808-a0c0-46af111eb5da",
  594: "d4d1494d-c3d0-4b77-8a3e-c6a4bbcbbd35",
  595: "2d10cfe6-c9af-409d-b5bb-c58201a58020",
  596: "0a8fa3f6-d911-4599-82be-8e9ede9d9936",
  597: "30b39da2-2ff3-4eb8-93c7-920dcfbb65cd",
  725: "b1a1c001-0001-4001-8001-000000000001",
};

function buildParams(cardId: number, campaign: string, dateStart: string, dateEnd: string): object[] {
  const params: object[] = [];
  if (campaign) params.push({ id: CAMPAIGN_TAG_ID[cardId], type: "string/=", value: campaign, target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart && dateEnd) params.push({ id: "date", type: "date/range", value: `${dateStart}~${dateEnd}`, target: ["dimension", ["template-tag", "Last_Updated"]] });
  return params;
}

async function fetchSummaryForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const [r175, r176, r177, r178, r179, r180] = await Promise.all([
    fetchCard(593, buildParams(593, campaign, dateStart, dateEnd)),
    fetchCard(594, buildParams(594, campaign, dateStart, dateEnd)),
    fetchCard(595, buildParams(595, campaign, dateStart, dateEnd)),
    fetchCard(596, buildParams(596, campaign, dateStart, dateEnd)),
    fetchCard(597, buildParams(597, campaign, dateStart, dateEnd)),
    fetchCard(725, buildParams(725, campaign, dateStart, dateEnd)),
  ]);

  return {
    totalDownloads:     r175?.[0]?.[0] ?? null,
    totalUniqueLeads:   r176?.[0]?.[0] ?? null,
    uniqueLeadDistrict: r177?.[0]?.[0] ?? null,
    byContentType: (r178 ?? []) as [string, number][],
    byContentName: (r179 ?? []) as [string, number][],
    byState: (r180 ?? []) as [string, number][],
  };
}

async function getResult(campaigns: string[], dateStart: string, dateEnd: string): Promise<SummaryResult> {
  const key = `${campaigns.join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = (async () => {
      // Selecting every known campaign should mean "everything", same as no
      // filter -- some rows have no campaign tag at all, so an explicit
      // Abmi_Campaign IN (...) list covering every campaign still excludes
      // them and silently undercounts vs. the true total.
      const isEveryKnownCampaign = campaigns.length >= CAMPAIGNS.length
        && CAMPAIGNS.every((c) => campaigns.includes(c));

      let result: SummaryResult;
      if (campaigns.length <= 1 || isEveryKnownCampaign) {
        result = await fetchSummaryForCampaign(isEveryKnownCampaign ? "" : (campaigns[0] ?? ""), dateStart, dateEnd);
      } else {
        const perCampaign = await Promise.all(campaigns.map((c) => fetchSummaryForCampaign(c, dateStart, dateEnd)));
        result = {
          totalDownloads:     sum(perCampaign.map((r) => r.totalDownloads)),
          totalUniqueLeads:   sum(perCampaign.map((r) => r.totalUniqueLeads)),
          uniqueLeadDistrict: sum(perCampaign.map((r) => r.uniqueLeadDistrict)),
          byContentType: mergeLabeledCounts(perCampaign.map((r) => r.byContentType)),
          byContentName: mergeLabeledCounts(perCampaign.map((r) => r.byContentName)),
          byState: mergeLabeledCounts(perCampaign.map((r) => r.byState)),
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
