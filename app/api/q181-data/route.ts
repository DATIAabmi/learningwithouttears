import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { fmtDate } from "@/lib/fmtDate";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY      = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID        = 34;
const TABLE        = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_learning_without_tears_202608_scoring`";
const CACHE_TTL_MS = 30 * 60 * 1000;

// Column indices match page.tsx COL_ORDER expectations:
// 0=District 1=Domain 2=Campaign 3=State 4=Topic 5=Topic Score 6=Date
const DATE_COL_INDEX = 6;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function toCampaignNum(shortCode: string): number | null {
  const n = parseInt(shortCode.replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

type Dataset = { cols: { display_name: string; base_type: string }[]; rows: unknown[][] };
const memCache = new Map<string, { data: Dataset; ts: number }>();
const inflight = new Map<string, Promise<Dataset>>();

// Metabase caps a single /api/dataset call at 10,000 rows (instance settings
// unaggregated-query-row-limit / aggregated-query-row-limit) regardless of
// the "constraints" requested — this dataset regularly exceeds that, so we
// page through it with LIMIT/OFFSET until a page comes back short.
const PAGE_SIZE = 10000;
const MAX_PAGES = 10; // safety cap — 100,000 rows is far beyond any real dataset here

async function fetchPage(baseSql: string, offset: number): Promise<{ cols: unknown[]; rows: unknown[][] } | null> {
  const sql = `${baseSql}\nLIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql } }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { cols: data.data?.cols ?? [], rows: data.data?.rows ?? [] };
}

async function fetchDataset(campaignNums: number[], dateStart: string, dateEnd: string): Promise<Dataset> {
  const where: string[] = [
    "item.bombora_score IS NOT NULL",
    "item.topics IS NOT NULL",
    "LOWER(TRIM(item.topics)) != 'null'",
    "TRIM(item.topics) != ''",
    "item.SBM_state IS NOT NULL",
    "TRIM(item.SBM_state) != ''",
  ];

  if (campaignNums.length) {
    where.push(`sc.abm_campaign_num IN (${campaignNums.join(",")})`);
  }
  if (dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd)) {
    where.push(`DATE(sc.last_updated) BETWEEN '${dateStart}' AND '${dateEnd}'`);
  }

  const baseSql = `
SELECT
  item.SBM_district AS District,
  sc.email_domain AS Domain,
  CONCAT('C', CAST(sc.abm_campaign_num AS STRING)) AS Campaign,
  item.SBM_state AS State,
  item.topics AS Topic,
  MAX(item.bombora_score) AS Topic_Score,
  MAX(sc.date_max_for_intent_scoring) AS Date
FROM ${TABLE} AS sc
CROSS JOIN UNNEST(sc.engagement) AS item
WHERE
  ${where.join("\n  AND ")}
GROUP BY
  item.SBM_district,
  sc.email_domain,
  sc.abm_campaign_num,
  item.SBM_state,
  item.topics
ORDER BY Topic_Score DESC, item.SBM_district, sc.email_domain, item.topics`;

  let cols: { display_name: string; base_type: string }[] = [];
  const allRows: unknown[][] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(baseSql, page * PAGE_SIZE);
    if (!result) break;
    if (page === 0) {
      cols = (result.cols as { display_name: string; base_type: string }[]).map((c) => ({
        display_name: c.display_name === "Topic_Score" ? "Topic Score" : c.display_name,
        base_type: c.base_type,
      }));
    }
    allRows.push(...result.rows);
    if (result.rows.length < PAGE_SIZE) break;
  }

  const rows: unknown[][] = allRows.map((row) =>
    row.map((val, j) => (j === DATE_COL_INDEX ? fmtDate(val) : val))
  );
  return { cols, rows };
}

export async function getDataset(campaignNums: number[], dateStart: string, dateEnd: string): Promise<Dataset> {
  const key = `${[...campaignNums].sort().join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = fetchDataset(campaignNums, dateStart, dateEnd)
      .then((result) => { memCache.set(key, { data: result, ts: Date.now() }); inflight.delete(key); return result; })
      .catch((err) => { inflight.delete(key); throw err; });
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = parseList(searchParams.get("campaign"));
  const districts  = parseList(searchParams.get("district"));
  const states     = parseList(searchParams.get("state"));
  const topics     = parseList(searchParams.get("topic"));
  const dateStart  = searchParams.get("dateStart") ?? "";
  const dateEnd    = searchParams.get("dateEnd")   ?? "";

  const campaignNums = campaigns
    .map((c) => toCampaignNum(c.split(":")[0].trim()))
    .filter((n): n is number => n !== null);

  try {
    const { cols, rows: allRows } = await getDataset(campaignNums, dateStart, dateEnd);
    const districtCol = cols.findIndex((c) => c.display_name === "District");
    const stateCol    = cols.findIndex((c) => c.display_name === "State");
    const topicCol    = cols.findIndex((c) => c.display_name === "Topic");

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    const rows = allRows
      .filter(matches(districts, districtCol))
      .filter(matches(states, stateCol))
      .filter(matches(topics, topicCol));

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
