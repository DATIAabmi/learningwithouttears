import { NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;

async function queryDistinct(field: string, alias: string): Promise<string[]> {
  const table = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_learning_without_tears_202608_scoring`";
  const sql = `SELECT DISTINCT ${field} AS val FROM ${table} WHERE ${field} IS NOT NULL AND ${field} != "" ORDER BY val LIMIT 2000`;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "native",
      native: { query: sql },
      middleware: { "js-int-to-string?": true },
    }),
    next: { revalidate: 3600 },
  });

  const data = await res.json();
  return (data?.data?.rows ?? []).map((r: string[]) => r[0]).filter(Boolean);
}

export async function GET() {
  try {
    const [districts, domains, states] = await Promise.all([
      queryDistinct("topic_district", "district"),
      queryDistinct("email_domain", "domain"),
      queryDistinct("state", "state"),
    ]);

    return NextResponse.json({ districts, domains, states }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
