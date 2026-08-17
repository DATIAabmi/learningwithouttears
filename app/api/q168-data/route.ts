import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateStart    = searchParams.get("dateStart") ?? "";
  const dateEnd      = searchParams.get("dateEnd") ?? "";
  const districts    = parseList(searchParams.get("district"));
  const states       = parseList(searchParams.get("state"));
  const jobFunctions = parseList(searchParams.get("jobFunction"));

  const parameters: object[] = [];

  if (dateStart && dateEnd) parameters.push({
    id: "date",
    type: "date/range",
    value: `${dateStart}~${dateEnd}`,
    target: ["dimension", ["template-tag", "Last_Updated"]],
  });
  // District/state/job function are filtered below (post-query) so multiple
  // values can be selected — the underlying SQL variables only support one.

  const res = await fetch(`${METABASE_URL}/api/card/588/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const normalizeColName = (name: string, displayName: string): string => {
    const key = name.toLowerCase();
    if (key === "job_function") return "Job Function";
    if (key.includes("district") && key.includes("domain")) return "Domain";
    if (displayName.toLowerCase().includes("district") && displayName.toLowerCase().includes("domain")) return "Domain";
    return displayName;
  };
  const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
    display_name: normalizeColName(c.name, c.display_name),
    base_type: c.base_type,
  }));
  let rows: unknown[][] = data.data?.rows ?? [];

  const districtCol = cols.findIndex((c: { display_name: string }) => c.display_name === "District");
  const stateCol = cols.findIndex((c: { display_name: string }) => c.display_name === "State");
  const jobFunctionCol = cols.findIndex((c: { display_name: string }) => c.display_name === "Job Function");

  const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
    values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

  rows = rows
    .filter(matches(districts, districtCol))
    .filter(matches(states, stateCol))
    .filter(matches(jobFunctions, jobFunctionCol));

  return cachedJson({ cols, rows });
}
