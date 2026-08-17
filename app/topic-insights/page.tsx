"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download, Info, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
function fetchFieldOptions(field: "district" | "state") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

const TOPICS = [
  "After-School Care Programs",
  "Back-up Child Care",
  "Bright Horizons Family Solutions Inc. (BFAM)",
  "Care for Kids",
  "Child Care",
  "Child Care Subsidy Programs",
  "Contract Renewal",
  "Early Childhood Education",
  "Request For Proposal (RFP)",
  "Social Learning",
  "Social and Emotional Learning",
  "Student Support Services",
  "Supervised Learning",
  "Third-Party Vendors",
];

// ─── Data types (used by table and chart) ─────────────────────────────────────

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
const LEFT_ALIGN_COLS = new Set(["District", "Domain", "District Domain", "Topic"]);
const FORCE_CENTER_COLS = new Set(["Campaign", "State"]);
const HEADER_LABELS: Record<string, string> = { "District Domain": "Domain" };
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
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Metric Descriptions</span>
          <button type="button" onClick={onClose} style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: "#111", flexShrink: 0, minWidth: 110, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
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
  { label: "State", index: 3 },
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
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-medium">{current?.label ?? "Topic Score"}</span>
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

function DataTable({ cols, rows, sort, onSort, headerTop = 0 }: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
  headerTop?: number;
}) {
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

  // col order: #, District, Domain, State, Campaign, Topic, Topic Score
  const COL_WIDTHS = ["3%", "22%", "14%", "5%", "5%", "38%", "13%"];

  return (
    <div className="bg-white">
      <table className="text-xs border-collapse w-full" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-2 py-2 text-center font-bold border-b border-gray-200" style={{ color: "#111827", top: headerTop }}>#</th>
            {COL_ORDER.map((j) => {
              const col = cols[j];
              if (!col) return null;
              const isLeft = LEFT_ALIGN_COLS.has(col.display_name) && !FORCE_CENTER_COLS.has(col.display_name);
              const active = sort.col === j;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  style={{ color: "#111827", textAlign: isLeft ? "left" : "center", top: headerTop }}
                  className="sticky z-10 bg-white px-2 py-2 font-bold leading-tight cursor-pointer select-none hover:opacity-70 border-b border-gray-200">
                  <span className={`inline-flex items-center gap-1 ${isLeft ? "justify-start" : "justify-center"}`}>
                    {HEADER_LABELS[col.display_name] ?? col.display_name}
                    {active ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-2 py-1.5 text-center text-gray-400">{i + 1}</td>
              {COL_ORDER.map((j) => {
                const cell = row[j];
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                const colName = cols[j]?.display_name ?? "";
                const isLeft = LEFT_ALIGN_COLS.has(colName) && !FORCE_CENTER_COLS.has(colName);
                const text = cell === null || cell === undefined ? "" : String(cell);
                return (
                  <td key={j}
                    style={{ textAlign: isLeft ? "left" : "center" }}
                    className={`px-2 py-1.5 ${isNum ? "tabular-nums" : ""} text-gray-800`}>
                    <div className="truncate" title={text}>{text}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterTopic, setFilterTopic] = useState<string[]>([]);

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
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
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState, filterTopic]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterState([]);
    setFilterTopic([]);
  }, [resetSignal]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} search={fetchFieldOptions("district")} />
            <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={fetchFieldOptions("state")} />
            <MultiSelectDropdown label="Topic"    value={filterTopic}    onChange={setFilterTopic}    options={TOPICS} />
            <button
              type="button"
              onClick={() => setShowDefs(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg bg-white transition-colors shrink-0"
            >
              <Info size={13} />
              Metric Descriptions
            </button>
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {showDefs && <DefinitionsModal onClose={() => setShowDefs(false)} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>

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
              onClick={() => exportToCsv("topic-insights", cols, rows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>

        {loading && <SkeletonTable />}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ clipPath: "inset(0 round 0 0 0.75rem 0.75rem)" }}>
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} headerTop={titleBarHeight} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <TopicInsightsContent />;
}
