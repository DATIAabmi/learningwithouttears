import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_learning_without_tears_202608_scoring`";

const FIELD_MAP: Record<string, string> = {
  district: "topic_district",
  domain: "email_domain",
  state: "state",
  job_function: "job_title",
};

// Persona Insights (card 588) only ever shows a row when District, Domain,
// State, Job Function, and Campaign are ALL populated together — so its
// filter dropdowns must be scoped to the same completeness requirement,
// otherwise they offer values (e.g. a district missing a job title on every
// row) that can never actually appear in the table. Other pages using this
// endpoint are backed by different cards with different requirements, so
// this only applies when the caller opts in.
const PERSONA_COMPLETENESS = `
  AND topic_district IS NOT NULL AND topic_district != ''
  AND email_domain IS NOT NULL AND email_domain != ''
  AND state IS NOT NULL AND state != '' AND state != 'cState'
  AND job_title IS NOT NULL AND job_title != ''
  AND abm_campaign IS NOT NULL AND abm_campaign != ''
`;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const field = searchParams.get("field") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const strict = searchParams.get("strict") === "1";

  const col = FIELD_MAP[field];
  if (!col) return NextResponse.json({ values: [] });

  const extraWhere = strict ? PERSONA_COMPLETENESS : "";

  // A real search term gets a much higher cap so "select all shown" in the
  // UI doesn't silently miss matches past the limit — an empty query (just
  // browsing on open) stays capped low since that list is only a preview.
  const limit = q ? 1000 : 50;
  const sql = q
    ? `SELECT DISTINCT ${col} FROM ${TABLE} WHERE LOWER(${col}) LIKE LOWER("%${q.replace(/"/g, "")}%") AND ${col} IS NOT NULL AND ${col} != ""${extraWhere} ORDER BY ${col} LIMIT ${limit}`
    : `SELECT DISTINCT ${col} FROM ${TABLE} WHERE ${col} IS NOT NULL AND ${col} != ""${extraWhere} ORDER BY ${col} LIMIT ${limit}`;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "native",
      native: { query: sql },
      middleware: { "js-int-to-string?": true },
    }),
  });

  const data = await res.json();
  const values: string[] = (data?.data?.rows ?? []).map((r: string[]) => r[0]).filter(Boolean);
  return cachedJson({ values });
}
