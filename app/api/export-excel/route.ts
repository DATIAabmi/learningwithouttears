import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY      = process.env.METABASE_ADMIN_API_KEY!;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Metabase helpers ────────────────────────────────────────────────────────

async function queryCard(cardId: number, parameters: object[] = []) {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });
  if (!res.ok) return { cols: [], rows: [] };
  const data = await res.json();
  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
}

async function queryCardJson(cardId: number, parameters: object[] = []) {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });
  if (!res.ok) return { cols: [], rows: [] };
  const data: Record<string, unknown>[] = await res.json();
  if (!data.length) return { cols: [], rows: [] };
  const cols = Object.keys(data[0]);
  const rows = data.map((r) => cols.map((c) => r[c]));
  return { cols, rows };
}

// ── Parameter builders ───────────────────────────────────────────────────────

function campaignParam(campaigns: string[]) {
  if (!campaigns.length) return [];
  return [{ id: "campaign", type: "string/=", value: campaigns, target: ["variable", ["template-tag", "Abmi_Campaign"]] }];
}

function campaignAndDate(campaigns: string[], dateStart: string, dateEnd: string) {
  const p: object[] = campaignParam(campaigns);
  if (dateStart && dateEnd) p.push({
    id: "date",
    type: "date/range",
    value: `${dateStart}~${dateEnd}`,
    target: ["dimension", ["template-tag", "Date"]],
  });
  return p;
}

// ── Section builder ──────────────────────────────────────────────────────────

type Section = { title: string; cols: string[]; rows: unknown[][] };

function buildRows(sections: Section[]): unknown[][] {
  const out: unknown[][] = [];
  for (const s of sections) {
    if (!s.rows.length) continue;
    out.push([]);                    // blank separator
    out.push([s.title]);             // section title
    out.push(s.cols);                // column headers
    for (const row of s.rows) out.push(row);
  }
  // trim leading blank row
  if (out.length && (out[0] as unknown[]).length === 0) out.shift();
  return out;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp        = req.nextUrl.searchParams;
  const campaigns = parseList(sp.get("campaign"));
  const dateStart = sp.get("dateStart") ?? "";
  const dateEnd   = sp.get("dateEnd")   ?? "";

  const p   = campaignAndDate(campaigns, dateStart, dateEnd);
  const cp  = campaignParam(campaigns);

  // Fetch all table data in parallel
  const [
    engagedUsers,
    sbm,
    persona,
    geo,
    leadsTable,
    leadsContent,
    topicTable,
    contentEngaged,
    channelBreakdown,
    aiSignals,
  ] = await Promise.all([
    queryCard(636, p),
    queryCard(637, cp),
    queryCard(588, p),
    queryCard(589, p),
    queryCard(592, p),
    queryCard(597, p),
    queryCard(599, p),
    queryCard(605, p),
    queryCard(603, p),
    queryCardJson(432),
  ]);

  const sections: Section[] = [
    { title: "ENGAGED USERS BY DISTRICT",   ...engagedUsers },
    { title: "SCHOOL BOARD MINUTES",         ...sbm          },
    { title: "PERSONA INSIGHTS",             ...persona      },
    { title: "GEO INSIGHTS",                 ...geo          },
    { title: "LEADS BY DISTRICT",            ...leadsTable   },
    { title: "LEADS BY CONTENT NAME",        ...leadsContent },
    { title: "TOPIC INSIGHTS",               ...topicTable   },
    { title: "CONTENT ENGAGEMENTS",          ...contentEngaged },
    { title: "CHANNEL BREAKDOWN",            ...channelBreakdown },
    { title: "AI OPPORTUNITY SIGNALS",       ...aiSignals    },
  ];

  const allRows = buildRows(sections);

  // Style: section header rows get bold + background via sheet styles
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths — reasonable defaults
  ws["!cols"] = Array.from({ length: 20 }, () => ({ wch: 24 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dashboard Export");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  const now    = new Date();
  const stamp  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const client = campaigns.length === 1 ? campaigns[0].replace(/[^a-z0-9]/gi, "-") : "all-campaigns";
  const filename = `datia-k12-${client}-${stamp}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
