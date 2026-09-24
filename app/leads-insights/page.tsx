"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download, Info, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import LeadsSummaryPanel from "@/components/LeadsSummaryPanel";
import { exportToCsv } from "@/lib/exportCsv";
import { useRegisterCsvExport } from "@/components/ExportContext";
function fetchFieldOptions(field: "district" | "state" | "job_function" | "content_name") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

// ─── Dashboard Guide modal ────────────────────────────────────────────────────

const DEFINITIONS = [
  { term: "Interactive", def: "All reporting elements on the page are interactive." },
  { term: "Filtering", def: "Filter the table using the dropdowns in the top left, or by clicking any chart bar to cross-filter." },
  { term: "Reset", def: "To reset filters, right-click on a filter table/chart and select Reset Action, or click Reset the Page at the top of the dashboard." },
  { term: "Sorting", def: "The table can be sorted by clicking on any column header." },
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
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 440, width: "calc(100% - 32px)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Dashboard Guide</span>
          <button type="button" onClick={onClose} style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: "#111", flexShrink: 0, minWidth: 80, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District",        index: 0 },
  { label: "Domain",          index: 1 },
  { label: "State",           index: 2 },
  { label: "Campaign",        index: 3 },
  { label: "Job Function",    index: 5 },
  { label: "Total Downloads", index: 6 },
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
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-[13px] font-bold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-semibold text-[13px]">{current?.label ?? "Total Downloads"}</span>
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

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
const FORCE_CENTER_COLS = new Set(["Campaign", "State"]);
const HEADER_LABELS: Record<string, string> = { "District Domain": "Domain" };
// Card 592 selects: District, Domain, State, Campaign, SBM, Job Function,
// Total Downloads (raw index 4 = SBM). SBM/Intel is intentionally excluded
// from COL_ORDER below to hide it from the table and export.
const COL_ORDER = [0, 1, 2, 3, 5, 6];

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

  return (
    <div className="bg-white">
      <table className="text-xs border-collapse" style={{ width: 1090, minWidth: 1090, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 40 }} />   {/* # */}
          <col style={{ width: 320 }} />  {/* District */}
          <col style={{ width: 200 }} />  {/* Domain */}
          <col style={{ width: 60 }} />   {/* State */}
          <col style={{ width: 90 }} />   {/* Campaign */}
          <col style={{ width: 260 }} />  {/* Job Function */}
          <col style={{ width: 120 }} />  {/* Total Downloads */}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-2 py-2 w-10 text-center text-[11px] font-semibold border-b border-gray-200" style={{ color: "#374151", top: headerTop }}>#</th>
            {COL_ORDER.map((j) => {
              const col = cols[j];
              if (!col) return null;
              const isNum = NUMBER_TYPES.has(col.base_type);
              const isCenter = isNum || FORCE_CENTER_COLS.has(col.display_name);
              const active = sort.col === j;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className="sticky z-10 bg-white px-4 py-2 text-[11px] font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 leading-tight border-b border-gray-200"
                  style={{ color: "#374151", textAlign: isCenter ? "center" : "left", top: headerTop }}>
                  <span className={`inline-flex items-center gap-0.5 ${isCenter ? "justify-center" : ""}`}>
                    {HEADER_LABELS[col.display_name] ?? col.display_name}
                    {active ? (sort.dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-1.5 text-center text-gray-400 text-xs w-10 shrink-0">{i + 1}</td>
              {COL_ORDER.map((j) => {
                const cell = row[j];
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                const colName = cols[j]?.display_name ?? "";
                const isCenter = isNum || FORCE_CENTER_COLS.has(colName);
                return (
                  <td key={j} className={`px-4 py-1.5 text-gray-800 ${isNum ? "tabular-nums" : ""}`}
                    style={{ textAlign: isCenter ? "center" : "left", overflowWrap: "anywhere" }}>
                    {cell === null || cell === undefined ? "" : String(cell)}
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

function LeadsInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();
  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [showDefs, setShowDefs] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterJobFunction, setFilterJobFunction] = useState<string[]>([]);
  const [filterContentName, setFilterContentName] = useState<string[]>([]);
  const [cols, setCols] = useState<Col[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const rows = useMemo(
    () => (filterDomain.length ? allRows.filter((r) => filterDomain.includes(String(r[1] ?? ""))) : allRows),
    [allRows, filterDomain],
  );
  const searchDomains = (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    const opts = [...new Set(allRows.map((r) => String(r[1] ?? "")).filter(Boolean))].sort();
    return Promise.resolve((ql ? opts.filter((o) => o.toLowerCase().includes(ql)) : opts).slice(0, 200));
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 6, dir: "desc" });

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
    if (campaign.length)          params.set("campaign",    campaign.join(","));
    if (dateStart)                params.set("dateStart",   dateStart);
    if (dateEnd)                  params.set("dateEnd",     dateEnd);
    if (filterDistrict.length)    params.set("district",    filterDistrict.join(","));
    if (filterState.length)       params.set("state",       filterState.join(","));
    if (filterJobFunction.length) params.set("jobFunction", filterJobFunction.join(","));
    filterContentName.forEach((v) => params.append("contentName", v));

    fetch(`/api/q174-data?${params.toString()}`)
      .then(async (r) => {
        const text = await r.text();
        if (!text.trim()) return { cols: [], rows: [] };
        return JSON.parse(text);
      })
      .then((d: { cols?: unknown[]; rows?: unknown[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setCols((d.cols ?? []) as Col[]);
        setAllRows((d.rows ?? []) as Row[]);
        setLoading(false);
      })
      .catch((err: Error) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState, filterJobFunction, filterContentName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterState([]);
    setFilterJobFunction([]);
    setFilterContentName([]);
  }, [resetSignal]);

  // Export follows the on-screen columns (COL_ORDER) so SBM/Intel, hidden
  // from the table, is also excluded from the CSV.
  const exportCols = useMemo(
    () => (cols.length ? COL_ORDER.map((j) => cols[j]).filter(Boolean) : cols),
    [cols],
  );
  const exportRows = useMemo(
    () => rows.map((row) => COL_ORDER.map((j) => row[j])),
    [rows],
  );

  useRegisterCsvExport(() => exportToCsv("leads-insights", exportCols, exportRows));

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectDropdown label="District"     value={filterDistrict}    onChange={setFilterDistrict}    search={fetchFieldOptions("district")} />
            <MultiSelectDropdown label="Domain"       value={filterDomain}      onChange={setFilterDomain}      search={searchDomains} />
            <MultiSelectDropdown label="State"        value={filterState}       onChange={setFilterState}       search={fetchFieldOptions("state")} minWidth={110} />
            <MultiSelectDropdown label="Job Function" value={filterJobFunction} onChange={setFilterJobFunction} search={fetchFieldOptions("job_function")} />
            <MultiSelectDropdown label="Content"      value={filterContentName} onChange={setFilterContentName} search={fetchFieldOptions("content_name")} />
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
        <div style={{ minWidth: 1090, width: "100%" }}>
        <LeadsSummaryPanel />
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Leads Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button onClick={() => exportToCsv("leads-insights", exportCols, exportRows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors">
              <Download size={13} /> Export
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ overflow: "clip" }}>
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} headerTop={titleBarHeight} />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <LeadsInsightsContent />
    </MetabaseProviderWrapper>
  );
}
