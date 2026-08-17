import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const DISPLAY_NAMES: Record<string, string> = {
  Job_Function:    "Job Function",
  Total_Downloads: "Total Downloads",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function fetchForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const parameters: object[] = [];

  if (campaign) parameters.push({
    id: "c045eb3b-8728-447b-a1de-9172b6c283f7",
    type: "string/=",
    value: campaign,
    target: ["variable", ["template-tag", "Abmi_Campaign"]],
  });
  if (dateStart && dateEnd) parameters.push({
    id: "date",
    type: "date/range",
    value: `${dateStart}~${dateEnd}`,
    target: ["dimension", ["template-tag", "Last_Updated"]],
  });

  const res = await fetch(`${METABASE_URL}/api/card/592/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  const baseCols: { display_name: string; base_type: string }[] = (data.data?.cols ?? []).map(
    (c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    })
  );
  const baseRows: unknown[][] = data.data?.rows ?? [];

  // Inject Campaign column at index 2 (after District, Domain) — this card has
  // no real per-row campaign dimension, so the requested value is echoed back.
  const campaignCol = { display_name: "Campaign", base_type: "type/Text" };
  const campaignVal = campaign ? campaign.split(":")[0].trim() : "All";
  const cols = [baseCols[0], baseCols[1], campaignCol, ...baseCols.slice(2)];
  const rows = baseRows.map((row) => [row[0], row[1], campaignVal, ...row.slice(2)]);

  return { cols, rows };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns   = parseList(searchParams.get("campaign"));
    const districts   = parseList(searchParams.get("district"));
    const states      = parseList(searchParams.get("state"));
    const jobFunctions = parseList(searchParams.get("jobFunction"));
    const dateStart   = searchParams.get("dateStart")   ?? "";
    const dateEnd     = searchParams.get("dateEnd")     ?? "";

    const results = campaigns.length > 0
      ? await Promise.all(campaigns.map((c) => fetchForCampaign(c, dateStart, dateEnd)))
      : [await fetchForCampaign("", dateStart, dateEnd)];

    const first = results.find((r) => r !== null);
    if (!first) {
      return NextResponse.json({ cols: [], rows: [], error: "Metabase error" });
    }
    const cols = first.cols;
    let rows = results.flatMap((r) => r?.rows ?? []);

    // District/State/Job Function are real per-row columns here, so multiple
    // selections can be applied locally after fetching.
    const districtCol = cols.findIndex((c) => c.display_name === "District");
    const stateCol = cols.findIndex((c) => c.display_name === "State");
    const jobFunctionCol = cols.findIndex((c) => c.display_name === "Job Function");

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    rows = rows
      .filter(matches(districts, districtCol))
      .filter(matches(states, stateCol))
      .filter(matches(jobFunctions, jobFunctionCol));

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
