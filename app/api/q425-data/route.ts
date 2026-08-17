import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

const STATIC_COLS = [
  { display_name: "District",      base_type: "type/Text" },
  { display_name: "Campaign",      base_type: "type/Text" },
  { display_name: "District Domain", base_type: "type/Text" },
  { display_name: "State",         base_type: "type/Text" },
  { display_name: "SBM Date",      base_type: "type/DateTime" },
  { display_name: "Keyword",       base_type: "type/Text" },
  { display_name: "SBM Context",   base_type: "type/Text" },
  { display_name: "SBM Link",      base_type: "type/Text" },
];

const SQL = `
SELECT
  topic_district        AS District,
  abmi_campaign         AS Campaign,
  email_domain          AS District_Domain,
  state                 AS State,
  e.SBM_Date            AS SBM_Date,
  e.curate_topic        AS Keyword,
  e.SBM_Context         AS SBM_Context,
  e.SBM_Link            AS SBM_Link
FROM \`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_learning_without_tears_202608_scoring\`,
UNNEST(engagement) AS e
WHERE e.SBM_Date IS NOT NULL
  AND e.SBM_Link IS NOT NULL
ORDER BY topic_district, e.SBM_Date DESC
`;

const CACHE_TTL_MS = 30 * 60 * 1000;
let memCache: { rows: unknown[][] } | null = null;
let memCacheAt = 0;
let inflightPromise: Promise<{ rows: unknown[][] }> | null = null;

async function fetchFullDataset() {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database: DB_ID, type: "native", native: { query: SQL } }),
    cache: "no-store",
  });

  if (!res.ok) return { rows: [] };
  const data = await res.json();
  const rows: unknown[][] = (data.data?.rows ?? []).map((r: unknown[]) =>
    r.map((v, i) => i === 2 ? v : v)
  );
  return { rows };
}

async function getDataset() {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;
  if (!inflightPromise) {
    inflightPromise = fetchFullDataset().then((result) => {
      memCache = result;
      memCacheAt = Date.now();
      inflightPromise = null;
      return result;
    }).catch((err) => {
      inflightPromise = null;
      throw err;
    });
  }
  return inflightPromise;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts  = parseList(searchParams.get("district"));
    const dateStart  = searchParams.get("dateStart") ?? "";
    const dateEnd    = searchParams.get("dateEnd")   ?? "";

    // col indices: 0=District 1=Campaign 2=District_Domain 3=State 4=SBM_Date 5=Keyword 6=SBM_Context 7=SBM_Link
    const { rows: allRows } = await getDataset();

    const matches = (values: string[], idx: number) => (row: unknown[]) =>
      values.length === 0 || values.some((v) => v.toLowerCase() === String(row[idx] ?? "").toLowerCase());

    const rows = allRows
      .filter(matches(campaigns, 1))
      .filter(matches(districts, 0))
      .filter((row) => {
        if (!dateStart && !dateEnd) return true;
        const raw = String(row[4] ?? "").slice(0, 10);
        if (dateStart && raw < dateStart) return false;
        if (dateEnd   && raw > dateEnd)   return false;
        return true;
      });

    return cachedJson({ cols: STATIC_COLS, rows });
  } catch {
    return NextResponse.json({ cols: STATIC_COLS, rows: [] });
  }
}
