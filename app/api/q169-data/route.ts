import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = parseList(searchParams.get("campaign"));
  const districts = parseList(searchParams.get("district"));
  const states = parseList(searchParams.get("state"));
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd = searchParams.get("dateEnd") ?? "";

  const parameters: object[] = [];
  if (campaigns.length) parameters.push({
    id: "campaign",
    type: "string/=",
    value: campaigns,
    target: ["variable", ["template-tag", "Abmi_Campaign"]],
  });
  if (districts.length) parameters.push({
    id: "district",
    type: "string/=",
    value: districts,
    target: ["variable", ["template-tag", "user_district"]],
  });
  if (states.length) parameters.push({
    id: "state",
    type: "string/=",
    value: states,
    target: ["variable", ["template-tag", "state"]],
  });
  if (dateStart) parameters.push({
    id: "date_start",
    type: "date/range",
    value: dateStart,
    target: ["dimension", ["template-tag", "Last_Updated.start"]],
  });
  if (dateEnd) parameters.push({
    id: "date_end",
    type: "date/range",
    value: dateEnd,
    target: ["dimension", ["template-tag", "Last_Updated.end"]],
  });

  try {
    const res = await fetch(`${METABASE_URL}/api/card/589/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ cols: [], rows: [] });
    }

    const DISPLAY_NAMES: Record<string, string> = { Engaged_Users: "Engaged Users", leads: "Leads" };
    const data = await res.json();
    const cols = (data.data?.cols ?? []).map((c: { display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.display_name] ?? c.display_name,
      base_type: c.base_type,
    }));
    const rows: unknown[][] = data.data?.rows ?? [];

    return cachedJson({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
