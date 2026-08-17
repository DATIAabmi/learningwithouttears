"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, X, ArrowUp, ArrowDown, ArrowUpDown, Download, Info } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
function fetchFieldOptions(field: "district" | "domain" | "state") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

// ─── Definitions modal ────────────────────────────────────────────────────────

const DEFINITIONS = [
  { term: "SBM", def: "School Board Minutes. The SBM Link directs to the school board minutes document." },
  { term: "Topic", def: "Intent signals based on content consumption. See Topic Insights dashboard." },
  { term: "Engagements", def: "The number of clicks on your ads, email opens and lead downloads." },
  { term: "Intent Score", def: "A numerical value that indicates a lead/district's likelihood to be in market derived from district data and total engagement" },
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <div
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 440, width: "calc(100% - 32px)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Metric Descriptions</span>
          <button type="button" onClick={onClose} style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: "#111", flexShrink: 0, minWidth: 90, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District",      index: 0 },
  { label: "Domain",        index: 1 },
  { label: "State",         index: 2 },
  { label: "Campaign",      index: 3 },
  { label: "Topic",         index: 5 },
  { label: "Engagements",   index: 6 },
  { label: "Engaged Users", index: 7 },
  { label: "Leads",         index: 8 },
  { label: "Downloads",     index: 9 },
  { label: "Intent Score",  index: 10 },
  { label: "Score Trend",   index: 11 },
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
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-medium">{current?.label ?? "Engagements"}</span>
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

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const SKELETON_COLS = [32, 120, 56, 52, 80, 64, 72, 72, 52, 72, 72, 80];
const SKELETON_ROWS = 14;
const LOADING_MESSAGES = [
  "Fetching district engagement data…",
  "Aggregating intent signals…",
  "Calculating engagement scores…",
  "Loading School Board Minutes…",
  "Almost there…",
];

function SkeletonTable() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 2800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden">
      <style>{`
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        .shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:1200px 100%;animation:shimmer 1.6s infinite linear}
      `}</style>

      {/* Status bar */}
      <div className="flex items-center gap-2.5 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shrink-0" />
        <span className="text-xs text-gray-500 transition-all duration-500">{LOADING_MESSAGES[msgIdx]}</span>
      </div>

      {/* Fake header row */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white">
        {SKELETON_COLS.map((w, i) => (
          <div key={i} className="shimmer rounded" style={{ width: w, height: 10, flexShrink: 0 }} />
        ))}
      </div>

      {/* Fake data rows */}
      {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
          {SKELETON_COLS.map((w, i) => {
            const narrower = Math.round(w * (0.55 + Math.random() * 0.45));
            return (
              <div key={i} className="shimmer rounded" style={{ width: narrower, height: 9, flexShrink: 0 }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
// Columns 0 (District) and 1 (Domain) are left-aligned; all others center
const isLeftCol = (j: number) => j === 0 || j === 1;
const SCORE_TREND_COL = 11;

// Shorter/matches-reference labels so multi-word headers can wrap onto two
// lines instead of forcing extra column width.
const HEADER_LABELS: Record<string, string> = {
  State: "ST",
  Downloads: "Total Downloads",
  "Score Trend": "Intent Score Trend",
};

interface TrendColor { bg: string; text: string }

function trendColor(row: Row): TrendColor | null {
  const val = row[SCORE_TREND_COL];
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n) || n === 0) return null;
  return n < 0
    ? null
    : { bg: "rgba(34,197,94,0.14)", text: "#15803d" };
}

function DataTable({
  cols, rows, sort, onSort, onDistrictClick, headerTop = 0,
}: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
  onDistrictClick: (district: string) => void;
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

  return (
    <div className="bg-white">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-2 py-2 w-8 text-[11px] font-bold text-gray-900 border-b border-gray-200" style={{ textAlign: "center", top: headerTop }}>#</th>
            {cols.map((col, j) => {
              const active = sort.col === j;
              const left = isLeftCol(j);
              const label = HEADER_LABELS[col.display_name] ?? col.display_name;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className="sticky z-10 bg-white px-2 py-2 font-bold text-gray-900 cursor-pointer select-none hover:opacity-70 leading-tight border-b border-gray-200"
                  style={{ textAlign: left ? "left" : "center", top: headerTop }}>
                  <span className={`inline-flex items-center gap-0.5 ${left ? "justify-start" : "justify-center"}`}>
                    {label}
                    {active && (sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const trend = trendColor(row);
            return (
              <tr key={i} className="border-b border-gray-100" style={{ backgroundColor: trend?.bg, color: trend?.text }}>
                <td className="px-2 py-1 text-gray-400 text-[11px] font-medium" style={{ textAlign: "center" }}>{i + 1}</td>
                {row.map((cell, j) => {
                  const display = cell === null || cell === undefined ? "" : String(cell);
                  const left = isLeftCol(j);
                  return (
                    <td key={j} className={`px-2 py-1 ${trend ? "" : "text-gray-800"} ${left ? "text-left" : "text-center tabular-nums"}`}>
                      {j === 0 ? (
                        <button onClick={() => onDistrictClick(display)}
                          className="block w-full text-left hover:underline font-medium"
                          style={{ color: trend?.text ?? "#2563eb" }}>
                          {display}
                        </button>
                      ) : display}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EngagedUsersContent() {
  const router = useRouter();
  const { campaign, resetSignal } = useFilter();

  const [district, setDistrict] = useState<string[]>([]);
  const [domain, setDomain] = useState<string[]>([]);
  const [state, setState] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({ col: 6, dir: "desc" });

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    // Pass short codes only ("C6") — Metabase card uses STARTS_WITH filter
    const campaignCodes = campaign.map((c) => c.split(":")[0].trim());
    if (campaignCodes.length) params.set("campaign", campaignCodes.join(","));
    if (district.length)      params.set("district", district.join(","));
    if (domain.length)        params.set("domain",   domain.join(","));
    if (state.length)         params.set("state",    state.join(","));

    fetch(`/api/q405-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load data"); setLoading(false); });
  }, [campaign, district, domain, state]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setDistrict([]);
    setDomain([]);
    setState([]);
  }, [resetSignal]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MultiSelectDropdown label="Domain" value={domain}   onChange={setDomain}   search={fetchFieldOptions("domain")} />
            <MultiSelectDropdown label="District"         value={district} onChange={setDistrict} search={fetchFieldOptions("district")} />
            <MultiSelectDropdown label="State"            value={state}    onChange={setState}    search={fetchFieldOptions("state")} />
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

      <div style={{ flex: 1, minHeight: 0, overflowY: "scroll", overflowX: "hidden", padding: "0 24px 24px" }} className="eu-scroll">
        <style>{`.eu-scroll::-webkit-scrollbar{width:10px}.eu-scroll::-webkit-scrollbar-track{background:#e5e7eb;border-radius:5px}.eu-scroll::-webkit-scrollbar-thumb{background:#6b7280;border-radius:5px}.eu-scroll::-webkit-scrollbar-thumb:hover{background:#374151}`}</style>
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Engaged Users By District</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button onClick={() => exportToCsv("engaged-users-by-district", cols, rows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors">
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
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} headerTop={titleBarHeight}
              onDistrictClick={(d) => router.push(`/school-board-minutes?district=${encodeURIComponent(d)}`)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <EngagedUsersContent />;
}
