import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

async function fetchRowsForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const params: object[] = [];
  if (campaign)  params.push({ id: "campaign",   type: "string/=",  value: campaign,  target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart) params.push({ id: "date_start", type: "date/range", value: dateStart, target: ["variable", ["template-tag", "Date"]] });
  if (dateEnd)   params.push({ id: "date_end",   type: "date/range", value: dateEnd,   target: ["variable", ["template-tag", "Date"]] });

  const res = await fetch(`${METABASE_URL}/api/card/605/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: params }),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.rows ?? [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  if (campaigns.length <= 1) {
    const rows = await fetchRowsForCampaign(campaigns[0] ?? "", dateStart, dateEnd);
    if (rows === null) return NextResponse.json({ error: "Metabase error" }, { status: 500 });
    return cachedJson({ rows });
  }

  const perCampaign = await Promise.all(campaigns.map((c) => fetchRowsForCampaign(c, dateStart, dateEnd)));
  const rows = perCampaign.flatMap((r) => r ?? []);
  return cachedJson({ rows });
}
