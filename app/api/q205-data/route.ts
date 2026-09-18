import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_learning_without_tears_202608_ad_performance`";

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlInList(values: string[]): string {
  return `(${values.map(sqlStr).join(", ")})`;
}

// Returns true when the URL resolves (2xx or 3xx before following). Uses a
// 5-second timeout so broken/unreachable links don't stall the whole response.
async function linkReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    return r.ok || (r.status >= 300 && r.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = parseList(searchParams.get("campaign"));
  const channels  = parseList(searchParams.get("channel"));
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const where: string[] = ["1=1"];
  if (campaigns.length)     where.push(`Abmi_Campaign IN ${sqlInList(campaigns)}`);
  if (channels.length)      where.push(`Channel IN ${sqlInList(channels)}`);
  if (dateStart && dateEnd) where.push(`DATE(date) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);

  const sql = `
SELECT
  DASH_Image_URL  AS Image,
  asset_name      AS \`Asset Name\`,
  URL             AS \`Asset Link\`,
  Abmi_Campaign   AS Campaign,
  Channel,
  SUM(impressions) AS Impressions,
  SUM(clicks)      AS Clicks,
  CONCAT(ROUND(SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100, 2), '%') AS CTR
FROM ${TABLE}
WHERE ${where.join(" AND ")}
GROUP BY asset_name, URL, DASH_Image_URL, Abmi_Campaign, Channel
ORDER BY Impressions DESC`;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: "Metabase error" }, { status: 500 });

  const data = await res.json();
  const rawRows: unknown[][] = data.data?.rows ?? [];

  // Check each URL concurrently. Null out the URL for unreachable links so the
  // page renders the asset name as plain text rather than a broken hyperlink.
  const reachable = await Promise.all(
    rawRows.map((row) => {
      const url = row[2];
      if (typeof url !== "string" || !url.startsWith("http")) return Promise.resolve(false);
      return linkReachable(url);
    })
  );
  const rows = rawRows.map((row, i) => {
    if (!reachable[i]) { const r = [...row]; r[2] = null; return r; }
    return row;
  });

  // No CDN cache — campaign/channel filters change results per request.
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
