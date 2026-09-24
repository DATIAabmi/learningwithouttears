"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download, Info, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { useRegisterCsvExport } from "@/components/ExportContext";
function fetchFieldOptions(field: "district" | "state" | "topic") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

// ─── Data types (used by table and chart) ─────────────────────────────────────

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
// Visual column order: District, Domain, State, Campaign, Topic, Topic Score.
// Raw data order (card 181): 0=District 1=Domain 2=Campaign 3=State 4=Topic 5=Topic Score
const COL_ORDER = [0, 1, 3, 2, 4, 5];

// ─── AVG Topic Score chart ────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 66) return "#88BF4D";
  if (score >= 36) return "#F9D45C";
  return "#EF8C8C";
}

// Computes avg topic score per topic from the filtered rows already in state —
// so the chart automatically reflects every filter change with no extra fetch.
function AvgTopicScoreChart({ rows, topicCol, scoreCol, loading }: {
  rows: Row[]; topicCol: number; scoreCol: number; loading: boolean;
}) {
  const byTopic: Record<string, { sum: number; count: number }> = {};
  for (const row of rows) {
    const topic = String(row[topicCol] ?? "");
    const score = Number(row[scoreCol]);
    if (!topic || isNaN(score)) continue;
    if (!byTopic[topic]) byTopic[topic] = { sum: 0, count: 0 };
    byTopic[topic].sum += score;
    byTopic[topic].count += 1;
  }

  const sorted = Object.entries(byTopic)
    .map(([topic, { sum, count }]) => [topic, sum / count] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  const max = sorted.length > 0 ? Math.max(...sorted.map((r) => r[1])) : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Avg Topic Score by Topic</p>
      <div className="flex flex-col gap-1.5">
        {sorted.map(([topic, score], i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 shrink-0" style={{ width: 240, textAlign: "left" }} title={topic}>
              {topic.length > 38 ? topic.slice(0, 38) + "…" : topic}
            </span>
            <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
                style={{ width: `${(score / max) * 100}%`, backgroundColor: scoreColor(score) }}
              />
            </div>
            <span className="text-xs tabular-nums font-semibold text-gray-700 shrink-0" style={{ width: 36 }}>
              {score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Definitions modal ────────────────────────────────────────────────────────

const DEFINITIONS = [
  { term: "Bombora Intent Signals", def: "Based on topics that districts are researching. Bombora detects intent when a district shows a pattern of increased content consumption compared to its baseline." },
  { term: "Topic Score", def: "The average score of a district's total engagement with a topic." },
  { term: "Score Ranges", def: "Low: 1–35 · Moderate: 36–65 · High: ≥66" },
];

function DefinitionsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onMouseDown={onClose} />
      <div
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 460, width: "calc(100% - 32px)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Dashboard Guide</span>
          <button type="button" onClick={onClose} style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111", flexShrink: 0, minWidth: 110, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Sort dropdown ─────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District", index: 0 },
  { label: "Domain", index: 1 },
  { label: "State", index: 3 },
  { label: "Campaign", index: 2 },
  { label: "Topic", index: 4 },
  { label: "Topic Score", index: 5 },
];

function SortDropdown({ sort, onSort }: { sort: SortState; onSort: (s: SortState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_COLUMNS.find((c) => c.index === sort.col);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-[13px] font-bold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-semibold text-[13px]">{current?.label ?? "Topic Score"}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          {SORT_COLUMNS.map((c) => {
            const active = sort.col === c.index;
            return (
              <button key={c.index}
                onClick={() => { onSort({ col: c.index, dir: active && sort.dir === "desc" ? "asc" : "desc" }); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
                {c.label}
                {active && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

// Raw: 0=District 1=Domain 2=Campaign 3=State 4=Topic 5=Topic Score
const TI_COLS = [
  { label: "#",           width: 32,  align: "center" as const, colIdx: -1 },
  { label: "District",    width: 280, align: "left"   as const, colIdx: 0  },
  { label: "Domain",      width: 200, align: "left"   as const, colIdx: 1  },
  { label: "State",       width: 52,  align: "center" as const, colIdx: 3  },
  { label: "Campaign",    width: 90,  align: "center" as const, colIdx: 2  },
  { label: "Topic",       width: 240, align: "left"   as const, colIdx: 4  },
  { label: "Topic Score", width: 110,  align: "center" as const, colIdx: 5  },
];
const TI_GRID = TI_COLS.map((c) => `${c.width}px`).join(" ");

function DataTable({ rows, sort }: { rows: Row[]; sort: SortState }) {
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No results</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="bg-white">
      {sorted.map((row, i) => (
        <div key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-xs"
             style={{ display: "grid", gridTemplateColumns: TI_GRID }}>
          <span className="px-2 py-1.5 text-center text-gray-400 font-medium">{i + 1}</span>
          {TI_COLS.slice(1).map((cd) => {
            const j = cd.colIdx;
            const cell = row[j];
            const text = cell === null || cell === undefined ? "" : String(cell);
            return (
              <span key={j} className="px-2 py-1.5 text-gray-800" style={{ textAlign: cd.align, overflowWrap: "anywhere" }}>
                {text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const TOPIC_SKELETON_COLS = [28, 110, 90, 36, 48, 130, 72];
const TOPIC_LOADING_MSGS = [
  "Fetching Bombora intent signals…",
  "Calculating topic scores…",
  "Loading district research data…",
  "Almost there…",
];

function SkeletonTable() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setMsgIdx((i) => (i + 1) % TOPIC_LOADING_MSGS.length), 2800);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden bg-white">
      <style>{`
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        .ti-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:1200px 100%;animation:shimmer 1.6s infinite linear}
      `}</style>
      <div className="flex items-center gap-2.5 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shrink-0" />
        <span className="text-xs text-gray-500">{TOPIC_LOADING_MSGS[msgIdx]}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200">
        {TOPIC_SKELETON_COLS.map((w, i) => (
          <div key={i} className="ti-shimmer rounded" style={{ width: w, height: 10, flexShrink: 0 }} />
        ))}
      </div>
      {Array.from({ length: 14 }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
          {TOPIC_SKELETON_COLS.map((w, i) => (
            <div key={i} className="ti-shimmer rounded"
              style={{ width: Math.round(w * (0.5 + Math.random() * 0.5)), height: 9, flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function TopicInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterDomain, setFilterDomain] = useState<string[]>([]);
  const [filterCampaign, setFilterCampaign] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterTopic, setFilterTopic] = useState<string[]>([]);

  const [cols, setCols] = useState<Col[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const rows = useMemo(
    () => allRows.filter((r) => {
      if (filterDomain.length && !filterDomain.includes(String(r[1] ?? ""))) return false;
      if (filterCampaign.length && !filterCampaign.includes(String(r[2] ?? ""))) return false;
      return true;
    }),
    [allRows, filterDomain, filterCampaign],
  );
  const makeSearch = (colIdx: number) => (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    const opts = [...new Set(allRows.map((r) => String(r[colIdx] ?? "")).filter(Boolean))].sort();
    return Promise.resolve((ql ? opts.filter((o) => o.toLowerCase().includes(ql)) : opts).slice(0, 200));
  };
  const searchDomains = makeSearch(1);
  const searchCampaigns = makeSearch(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });
  const [showDefs, setShowDefs] = useState(false);

  const titleBarRef = useRef<HTMLDivElement>(null);
  const [titleBarHeight, setTitleBarHeight] = useState(0);

  useLayoutEffect(() => {
    const el = titleBarRef.current;
    if (!el) return;
    const measure = () => { const h = el.offsetHeight; if (h > 0) setTitleBarHeight(h); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)       params.set("campaign",   campaign.join(","));
    if (dateStart)             params.set("dateStart",  dateStart);
    if (dateEnd)               params.set("dateEnd",    dateEnd);
    if (filterDistrict.length) params.set("district",   filterDistrict.join(","));
    if (filterState.length)    params.set("state",      filterState.join(","));
    if (filterTopic.length)    params.set("topic",      filterTopic.join(","));

    fetch(`/api/q181-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState, filterTopic]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterCampaign([]);
    setFilterState([]);
    setFilterTopic([]);
  }, [resetSignal]);

  // Export follows the on-screen column order (COL_ORDER): District, Domain,
  // State, Campaign, Topic, Topic Score — same reorder as the table itself.
  const exportCols = useMemo(
    () => (cols.length ? COL_ORDER.map((j) => cols[j]).filter(Boolean) : cols),
    [cols],
  );
  const exportRows = useMemo(
    () => rows.map((row) => COL_ORDER.map((j) => row[j])),
    [rows],
  );

  useRegisterCsvExport(() => exportToCsv("topic-insights", exportCols, exportRows));

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} search={fetchFieldOptions("district")} />
            <MultiSelectDropdown label="Domain"   value={filterDomain}   onChange={setFilterDomain}   search={searchDomains} />
            <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={fetchFieldOptions("state")} />
            <MultiSelectDropdown label="Campaign" value={filterCampaign} onChange={setFilterCampaign} search={searchCampaigns} />
            <MultiSelectDropdown label="Topic"    value={filterTopic}    onChange={setFilterTopic}    search={fetchFieldOptions("topic")} />
            <button
              type="button"
              onClick={() => setShowDefs(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg bg-white transition-colors shrink-0"
            >
              <Info size={13} />
              Dashboard Guide
            </button>
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {showDefs && <DefinitionsModal onClose={() => setShowDefs(false)} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", padding: "0 24px 24px" }}>
        <div style={{ minWidth: 1004, width: "100%" }}>

        {/* AVG Topic Score chart — driven by the same filtered rows as the table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden" style={{ height: 340 }}>
          <AvgTopicScoreChart
            rows={rows}
            topicCol={cols.findIndex((c) => c.display_name === "Topic")}
            scoreCol={cols.findIndex((c) => c.display_name === "Topic Score")}
            loading={loading}
          />
        </div>

        {/* Section title */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Topic Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button
              onClick={() => exportToCsv("topic-insights", exportCols, exportRows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export
            </button>
          )}
        </div>

        {loading && <SkeletonTable />}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <>
            <div className="sticky z-10 bg-white border-b border-l border-r border-gray-200 text-[13px] font-semibold text-gray-700"
                 style={{ top: titleBarHeight, display: "grid", gridTemplateColumns: TI_GRID }}>
              {TI_COLS.map((cd, i) => (
                <span key={i}
                  className={`px-2 py-2 inline-flex items-center gap-0.5 whitespace-nowrap select-none ${cd.colIdx >= 0 ? "cursor-pointer hover:opacity-70" : ""} ${cd.align === "center" ? "justify-center" : "justify-start"}`}
                  onClick={cd.colIdx >= 0 ? () => setSort({ col: cd.colIdx, dir: sort.col === cd.colIdx && sort.dir === "desc" ? "asc" : "desc" }) : undefined}>
                  {cd.label}
                  {cd.colIdx >= 0 && (sort.col === cd.colIdx
                    ? (sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />)
                    : <ArrowUpDown size={10} className="opacity-30 shrink-0" />)}
                </span>
              ))}
            </div>
            <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ overflow: "clip" }}>
              <DataTable rows={rows} sort={sort} />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <TopicInsightsContent />;
}
