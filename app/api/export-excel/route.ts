import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDataset as getEngagedUsers } from "@/app/api/q405-data/route";
import { fetchSignals } from "@/app/api/ai-signals-data/route";
import { getDataset as getTopicInsights } from "@/app/api/q181-data/route";
import { fetchAll as getPersonaAll } from "@/app/api/q168-data/route";
import { fetchAll as getGeoAll } from "@/app/api/q169-data/route";
import { fetchForCampaign as getLeadsTable } from "@/app/api/q174-data/route";
import { getDataset as getSbm, STATIC_COLS as SBM_COLS } from "@/app/api/q425-data/route";
import { fetchRows as getContentEngagements, CONTENT_ENGAGEMENTS_COLS } from "@/app/api/q205-data/route";
import { fetchContentForCampaign } from "@/app/api/content-data/route";
import { fetchSummaryForCampaign } from "@/app/api/leads-summary/route";

export const maxDuration = 60;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

type DS = { cols: string[]; rows: unknown[][] };

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

// ── AI Signals column reorder ────────────────────────────────────────────────

const AI_SIGNALS_COL_ORDER = [
  "Organization", "Domain", "State", "Campaign", "Keywords",
  "Category", "Date", "Source", "Source Link", "Strength", "Signal Analysis", "Source Text",
];

function reorderAiSignalsCols(data: DS): DS {
  const colMap = new Map(data.cols.map((c, i) => [c, i]));
  const orderedCols = AI_SIGNALS_COL_ORDER.filter((c) => colMap.has(c));
  for (const c of data.cols) {
    if (!orderedCols.includes(c)) orderedCols.push(c);
  }
  const newIdxs = orderedCols.map((c) => colMap.get(c)!);
  const renamedCols = orderedCols.map((c) => (c === "Source Link" ? "Link" : c));
  return {
    cols: renamedCols,
    rows: data.rows.map((row) => newIdxs.map((i) => row[i])),
  };
}

// ── Post-fetch campaign filter safety net ────────────────────────────────────

const CAMPAIGN_COL_NAMES = new Set(["campaign", "camp", "camp.", "abmi_campaign", "abm_campaign"]);

function filterByCampaign(data: DS, campaignCodes: string[]): DS {
  if (!campaignCodes.length) return data;
  const campIdx = data.cols.findIndex((c) => CAMPAIGN_COL_NAMES.has(c.toLowerCase()));
  if (campIdx < 0) return data;
  const codes = campaignCodes.map((c) => c.toUpperCase());
  return {
    cols: data.cols,
    rows: data.rows.filter((r) => {
      const val = String(r[campIdx] ?? "").toUpperCase();
      return codes.some((c) => val.includes(c));
    }),
  };
}

// ── Wide master-view builder ─────────────────────────────────────────────────

function findDistCol(cols: string[], ...candidates: string[]): number {
  const targets = new Set(candidates.map((s) => s.toLowerCase()));
  return cols.findIndex((c) => targets.has(c.toLowerCase()));
}

function groupByDistrict(rows: unknown[][], distCol: number): Map<string, unknown[][]> {
  const m = new Map<string, unknown[][]>();
  if (distCol < 0) return m;
  for (const row of rows) {
    const k = norm(row[distCol]);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(row);
  }
  return m;
}

function selectCols(cols: string[], skipLower: Set<string>): { idxs: number[]; names: string[] } {
  const idxs: number[] = [];
  const names: string[] = [];
  for (let i = 0; i < cols.length; i++) {
    if (!skipLower.has(cols[i].toLowerCase())) {
      idxs.push(i);
      names.push(cols[i]);
    }
  }
  return { idxs, names };
}

function pick(row: unknown[], idxs: number[]): unknown[] {
  return idxs.map((i) => row[i] ?? "");
}

function blanks(n: number): unknown[] {
  return Array<unknown>(n).fill("");
}

const DIST_SHARED = new Set(["organization", "district", "domain", "state", "campaign", "camp", "camp."]);

function buildWideMasterView(euData: DS, aiData: DS, topicData: DS, personaData: DS, leadsData: DS): unknown[][] {
  const euDistCol = findDistCol(euData.cols, "district");
  const aiDistCol = findDistCol(aiData.cols, "organization", "district");
  const tiDistCol = findDistCol(topicData.cols, "district");
  const ldDistCol = findDistCol(leadsData.cols, "district", "organization");

  const aiMap = groupByDistrict(aiData.rows, aiDistCol);
  const tiMap = groupByDistrict(topicData.rows, tiDistCol);
  const ldMap = groupByDistrict(leadsData.rows, ldDistCol);

  const ai = selectCols(aiData.cols, DIST_SHARED);
  const ti = selectCols(topicData.cols, new Set(["district", "domain", "campaign", "state"]));
  const ld = selectCols(leadsData.cols, new Set(["district", "organization"]));
  const pe = { idxs: personaData.cols.map((_, i) => i), names: personaData.cols };

  const SEP = "";

  const hdr1: unknown[] = [
    "ENGAGED USERS BY DISTRICT", ...blanks(Math.max(0, euData.cols.length - 1)), SEP,
    "ACCOUNT INTELLIGENCE",      ...blanks(Math.max(0, ai.names.length - 1)),    SEP,
    "TOPIC INSIGHTS",            ...blanks(Math.max(0, ti.names.length - 1)),    SEP,
    "PERSONA INSIGHTS",          ...blanks(Math.max(0, pe.names.length - 1)),    SEP,
    "LEAD INSIGHTS",             ...blanks(Math.max(0, ld.names.length - 1)),
  ];

  const hdr2: unknown[] = [
    ...euData.cols, SEP,
    ...ai.names,    SEP,
    ...ti.names,    SEP,
    ...pe.names,    SEP,
    ...ld.names,
  ];

  const out: unknown[][] = [hdr1, hdr2];

  let peIdx = 0;

  for (const euRow of euData.rows) {
    if (euDistCol < 0) continue;
    const key     = norm(euRow[euDistCol]);
    const signals = aiMap.get(key) ?? [];
    const topics  = tiMap.get(key) ?? [];
    const leads   = ldMap.get(key) ?? [];

    const tiData = topics[0] ? pick(topics[0], ti.idxs) : blanks(ti.names.length);
    const ldData = leads[0]  ? pick(leads[0],  ld.idxs) : blanks(ld.names.length);

    const n = Math.max(signals.length, 1);

    for (let s = 0; s < n; s++) {
      const sig    = signals[s];
      const aiData = sig ? pick(sig, ai.idxs) : blanks(ai.names.length);

      const pRow  = personaData.rows[peIdx];
      const pData = pRow ? pick(pRow, pe.idxs) : blanks(pe.names.length);
      if (pRow) peIdx++;

      out.push([
        ...(euRow as unknown[]), SEP,
        ...aiData, SEP,
        ...(s === 0 ? tiData : blanks(ti.names.length)), SEP,
        ...pData, SEP,
        ...(s === 0 ? ldData : blanks(ld.names.length)),
      ]);
    }
  }

  const leadBlanks = blanks(ld.names.length);
  const tiBlanks   = blanks(ti.names.length);
  const aiBlanks   = blanks(ai.names.length);
  const euBlanks   = blanks(euData.cols.length);
  while (peIdx < personaData.rows.length) {
    const pData = pick(personaData.rows[peIdx++], pe.idxs);
    out.push([...euBlanks, SEP, ...aiBlanks, SEP, ...tiBlanks, SEP, ...pData, SEP, ...leadBlanks]);
  }

  return out;
}

// ── Supplemental stacked-section builder ─────────────────────────────────────

type Section = { title: string; cols: string[]; rows: unknown[][] };

function buildStackedRows(sections: Section[]): unknown[][] {
  const out: unknown[][] = [];
  for (const s of sections) {
    if (!s.rows.length) continue;
    out.push([]);
    out.push([s.title]);
    out.push(s.cols);
    for (const row of s.rows) out.push(row);
  }
  if (out.length && (out[0] as unknown[]).length === 0) out.shift();
  return out;
}

// ── Column widths for wide master view ───────────────────────────────────────

function masterViewColWidths(euCols: string[], aiNames: string[], tiNames: string[], peNames: string[], ldNames: string[]): { wch: number }[] {
  const WIDE = 36;
  const MED  = 22;
  const SM   = 10;
  const XS   = 3;

  function widthFor(name: string): number {
    const n = name.toLowerCase();
    if (n === "district" || n === "organization") return WIDE;
    if (n.includes("analysis") || n.includes("source text") || n.includes("signal")) return WIDE;
    if (n.includes("domain") || n.includes("keywords") || n.includes("topic")) return MED;
    if (n.includes("date") || n.includes("campaign") || n.includes("function") || n.includes("source")) return MED;
    if (n.includes("link") || n.includes("url")) return MED;
    return SM;
  }

  const cols: { wch: number }[] = [];
  for (const c of euCols) cols.push({ wch: widthFor(c) });
  cols.push({ wch: XS });
  for (const c of aiNames) cols.push({ wch: widthFor(c) });
  cols.push({ wch: XS });
  for (const c of tiNames) cols.push({ wch: widthFor(c) });
  cols.push({ wch: XS });
  for (const c of peNames) cols.push({ wch: widthFor(c) });
  cols.push({ wch: XS });
  for (const c of ldNames) cols.push({ wch: widthFor(c) });
  return cols;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sp        = req.nextUrl.searchParams;
    const campaigns = parseList(sp.get("campaign"));
    const dateStart = sp.get("dateStart") ?? "";
    const dateEnd   = sp.get("dateEnd")   ?? "";

    const campaignCodes = campaigns.map((c) => c.split(":")[0].trim());
    const campaignNums = campaignCodes
      .map((c) => parseInt(c.replace(/\D/g, ""), 10))
      .filter((n): n is number => !isNaN(n));

    const [
      euRaw,
      sbmRaw,
      personaRaw,
      geoRaw,
      leadsTableRaw,
      leadsSummaryRaw,
      topicRaw,
      contentEngagedRaw,
      channelRaw,
      aiSignalsRaw,
    ] = await Promise.all([
      getEngagedUsers(),
      getSbm(),
      getPersonaAll(),
      getGeoAll(),
      getLeadsTable("", dateStart, dateEnd, ""),
      fetchSummaryForCampaign("", dateStart, dateEnd),
      getTopicInsights(campaignNums, dateStart, dateEnd),
      getContentEngagements([], [], dateStart, dateEnd),
      fetchContentForCampaign("", dateStart, dateEnd),
      fetchSignals(),
    ]);

    const toDS = (cols: { display_name: string }[], rows: unknown[][]): DS => ({
      cols: cols.map((c) => c.display_name),
      rows,
    });

    const euDS      = toDS(euRaw.cols, euRaw.rows);
    const sbmDS: DS = { cols: SBM_COLS.map((c) => c.display_name), rows: sbmRaw.rows };
    const personaDS = toDS(personaRaw.cols, personaRaw.rows);
    const geoDS     = toDS(geoRaw.cols, geoRaw.rows);
    const leadsDS   = toDS(leadsTableRaw?.cols ?? [], leadsTableRaw?.rows ?? []);
    const topicDS   = toDS(topicRaw.cols, topicRaw.rows);
    const aiDS: DS  = {
      cols: aiSignalsRaw.columns,
      rows: aiSignalsRaw.rows.map((r) => aiSignalsRaw.columns.map((c) => r[c])),
    };
    const contentEngagedDS: DS = { cols: CONTENT_ENGAGEMENTS_COLS, rows: contentEngagedRaw.rows };
    const channelBreakdownDS: DS = {
      cols: ["Channel", "Impressions", "Clicks", "CTR"],
      rows: (channelRaw.channelBreakdown as unknown[][]).map((r) => [
        r[0], r[1], r[2], typeof r[3] === "number" ? `${r[3].toFixed(2)}%` : r[3],
      ]),
    };
    const leadsByContentNameDS: DS = {
      cols: ["Content Name", "Leads"],
      rows: leadsSummaryRaw.byContentName as unknown[][],
    };

    const f = (d: DS) => filterByCampaign(d, campaignCodes);

    const euFiltered      = f(euDS);
    const aiOrdered       = reorderAiSignalsCols(f(aiDS));
    const topicFiltered   = f(topicDS);
    const personaFiltered = f(personaDS);
    const leadsFiltered   = f(leadsDS);

    // ── Sheet 1: Wide master view ─────────────────────────────────────────────
    const masterRows = buildWideMasterView(euFiltered, aiOrdered, topicFiltered, personaFiltered, leadsFiltered);
    const ws1 = XLSX.utils.aoa_to_sheet(masterRows);

    const aiNames = aiOrdered.cols.filter((c) => !DIST_SHARED.has(c.toLowerCase()));
    const tiNames = topicFiltered.cols.filter((c) => !new Set(["district", "domain", "campaign", "state"]).has(c.toLowerCase()));
    const ldNames = leadsFiltered.cols.filter((c) => !new Set(["district", "organization"]).has(c.toLowerCase()));
    ws1["!cols"] = masterViewColWidths(euFiltered.cols, aiNames, tiNames, personaFiltered.cols, ldNames);

    // ── Sheet 2: Supplemental stacked sections ────────────────────────────────
    const suppSections: Section[] = [
      { title: "SCHOOL BOARD MINUTES",  ...f(sbmDS) },
      { title: "GEO INSIGHTS",          ...f(geoDS) },
      { title: "LEADS BY CONTENT NAME", ...leadsByContentNameDS },
      { title: "CONTENT ENGAGEMENTS",   ...f(contentEngagedDS) },
      { title: "CHANNEL BREAKDOWN",     ...channelBreakdownDS },
    ];
    const suppRows = buildStackedRows(suppSections);
    const ws2 = XLSX.utils.aoa_to_sheet(suppRows.length ? suppRows : [["No supplemental data"]]);
    ws2["!cols"] = Array.from({ length: 20 }, () => ({ wch: 24 }));

    // ── Workbook ───────────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Master View");
    XLSX.utils.book_append_sheet(wb, ws2, "Supplemental");

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const now    = new Date();
    const stamp  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
