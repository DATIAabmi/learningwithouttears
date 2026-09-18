import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { CAMPAIGNS } from "@/lib/campaigns";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// Each card's Abmi_Campaign/Date template tags have their own distinct UUID
// (verified directly against Metabase) -- a generic parameter id like this
// route used before silently no-ops instead of erroring, so the campaign
// filter looked wired up but every per-campaign fetch actually returned the
// full unfiltered total. Selecting 2 campaigns then summed two full totals,
// doubling every number on the page. Date is a dimension-type field filter
// (not a plain variable), so its target must be ["dimension", ...] with a
// single "start~end" value, not two separate date_start/date_end params.
const CARD_TAGS: Record<number, { campaign: string; date: string }> = {
  600: { campaign: "42673811-578c-499b-a7fb-67482c6015bb", date: "dbe6f1b5-2fb5-475e-b7ed-03877fa37163" },
  601: { campaign: "af6ff2ef-7c3d-4d58-9367-2d4e0a36c816", date: "89865cc2-c75d-43ed-9d9b-3a55e264f3bb" },
  602: { campaign: "0440695a-a7db-4478-ba49-b4b6de7bf3d5", date: "70cf5f50-a5c2-4405-b3d2-df5b0ce98a7d" },
  603: { campaign: "845b765b-7f12-4d62-8834-12918445eaa8", date: "ad1166e3-6a2c-424e-aa1e-3b6445a3349e" },
  604: { campaign: "aab79af5-1a19-4e31-90d7-ce19a6f8ebb9", date: "2d93be9f-78e7-498a-8ccf-90e63accec6f" },
};

function buildParams(cardId: number, campaign: string, dateStart: string, dateEnd: string): object[] {
  const tags = CARD_TAGS[cardId];
  const params: object[] = [];
  if (campaign) params.push({ id: tags.campaign, type: "string/=", value: campaign, target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart && dateEnd) params.push({ id: tags.date, type: "date/range", value: `${dateStart}~${dateEnd}`, target: ["dimension", ["template-tag", "Date"]] });
  return params;
}

async function fetchCard(cardId: number, params: object[]) {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: params }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.rows ?? [];
  } catch {
    return null;
  }
}

function sum(values: (string | number | null | undefined)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

// Merge Card 203 rows [Channel, Impressions, Clicks, CTR] across campaigns.
// Sums Impressions and Clicks per channel, recomputes CTR from totals.
function mergeChannelBreakdown(rowSets: unknown[][][]): unknown[][] {
  const byChannel = new Map<string, { impressions: number; clicks: number; hasImp: boolean }>();
  for (const rows of rowSets) {
    for (const row of rows) {
      const channel = String(row[0]);
      const imp = row[1] != null ? Number(row[1]) : null;
      const clk = row[2] != null ? Number(row[2]) : 0;
      if (!byChannel.has(channel)) byChannel.set(channel, { impressions: 0, clicks: 0, hasImp: false });
      const t = byChannel.get(channel)!;
      if (imp != null && !isNaN(imp)) { t.impressions += imp; t.hasImp = true; }
      if (!isNaN(clk as number)) t.clicks += (clk as number);
    }
  }
  return [...byChannel.entries()]
    .map(([ch, { impressions, clicks, hasImp }]) => {
      const imp = hasImp ? impressions : null;
      const ctr = hasImp && impressions > 0 ? (clicks / impressions) * 100 : null;
      return [ch, imp, clicks, ctr];
    })
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
}

// Merge Card 204 rows [channel, Clicks, Click_Percentage] across campaigns.
// Sums clicks per channel, recomputes percentages from the new total.
function mergeChannelClicks(rowSets: unknown[][][]): unknown[][] {
  const totals = new Map<string, number>();
  for (const rows of rowSets) {
    for (const row of rows) {
      const channel = String(row[0]);
      const clicks = Number(row[1]) || 0;
      totals.set(channel, (totals.get(channel) ?? 0) + clicks);
    }
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([ch, clicks]) => [ch, clicks, total > 0 ? clicks / total : 0])
    .sort((a, b) => (b[1] as number) - (a[1] as number));
}

async function fetchContentForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const [rows200, rows201, rows202, rows203, rows204] = await Promise.all([
    fetchCard(600, buildParams(600, campaign, dateStart, dateEnd)),
    fetchCard(601, buildParams(601, campaign, dateStart, dateEnd)),
    fetchCard(602, buildParams(602, campaign, dateStart, dateEnd)),
    fetchCard(603, buildParams(603, campaign, dateStart, dateEnd)),
    fetchCard(604, buildParams(604, campaign, dateStart, dateEnd)),
  ]);

  return {
    impressions:      rows200?.[0]?.[0] ?? null,
    clicks:           rows201?.[0]?.[0] ?? null,
    ctr:              rows202?.[0]?.[0] ?? null,
    channelBreakdown: (rows203 ?? []) as unknown[][],
    channelClicks:    (rows204 ?? []) as unknown[][],
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  // Selecting every known campaign should mean "everything", same as no
  // filter at all -- some rows in the underlying table have no campaign tag
  // (legacy/untagged engagement data), so filtering with an explicit
  // Abmi_Campaign IN (...) list excludes them even when the list covers
  // every campaign that exists, silently undercounting vs. the true total.
  const isEveryKnownCampaign = campaigns.length >= CAMPAIGNS.length
    && CAMPAIGNS.every((c) => campaigns.includes(c));

  if (campaigns.length <= 1 || isEveryKnownCampaign) {
    const result = await fetchContentForCampaign(isEveryKnownCampaign ? "" : (campaigns[0] ?? ""), dateStart, dateEnd);
    return cachedJson(result);
  }

  const perCampaign = await Promise.all(campaigns.map((c) => fetchContentForCampaign(c, dateStart, dateEnd)));
  const totalImpressions = sum(perCampaign.map((r) => r.impressions));
  const totalClicks = sum(perCampaign.map((r) => r.clicks));
  // Recompute CTR from the summed totals rather than averaging each
  // campaign's already-formatted percentage — averaging percentages ignores
  // how much each campaign actually contributed (e.g. a low-volume campaign
  // with a high CTR would skew the average even though it barely affects
  // the true clicks/impressions ratio).
  const ctr = totalImpressions && totalClicks
    ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%`
    : null;
  return cachedJson({
    impressions:      totalImpressions,
    clicks:           totalClicks,
    ctr,
    channelBreakdown: mergeChannelBreakdown(perCampaign.map((r) => r.channelBreakdown)),
    channelClicks:    mergeChannelClicks(perCampaign.map((r) => r.channelClicks)),
  });
}
