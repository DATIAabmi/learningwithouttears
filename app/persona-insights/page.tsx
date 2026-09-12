"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { useRegisterCsvExport } from "@/components/ExportContext";
// strict=1 scopes options to values that actually appear in this page's
// underlying data (card 588 requires District/Domain/State/Job Function/
// Campaign to all be populated together) — otherwise the dropdown offers
// values that exist in the raw table but never show up in the results.
function fetchFieldOptions(field: "district" | "state" | "job_function") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}&strict=1`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}



// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District", index: 0 },
  { label: "State", index: 2 },
  { label: "Job Function", index: 3 },
  { label: "Campaign", index: 4 },
  { label: "Engagements", index: 5 },
  { label: "Leads", index: 6 },
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors"
      >
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
                onClick={() => {
                  onSort({ col: c.index, dir: active && sort.dir === "desc" ? "asc" : "desc" });
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}
              >
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

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
// Raw column indices (card 168): 0=District 1=Domain 2=State 3=Job Function 4=Campaign 5=Engagements 6=Leads
// Visual column order shown to user
const COL_ORDER = [0, 1, 2, 4, 3, 6, 5];
// Columns that are always left-aligned, identified by raw card index (avoids display_name mismatch)
const LEFT_ALIGN_INDICES = new Set([0, 1, 3]); // District, Domain, Job Function
const COL_LABELS: Record<number, string> = { 1: "Domain", 3: "Job Function" };

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
      <table className="text-xs border-collapse w-full table-fixed">
        <colgroup>
          <col style={{ width: 36 }} />   {/* # */}
          <col style={{ width: 160 }} />  {/* District */}
          <col style={{ width: 120 }} />  {/* Domain */}
          <col style={{ width: 50 }} />   {/* State */}
          <col style={{ width: 80 }} />   {/* Campaign */}
          <col style={{ width: 170 }} />  {/* Job Function */}
          <col style={{ width: 72 }} />   {/* Leads */}
          <col style={{ width: 88 }} />   {/* Engagements */}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-2 py-2 text-center w-10 font-bold whitespace-nowrap border-b border-gray-200" style={{ color: "#111827", top: headerTop }}>#</th>
            {COL_ORDER.map((j) => {
              const col = cols[j];
              if (!col) return null;
              const isLeft = LEFT_ALIGN_INDICES.has(j);
              const active = sort.col === j;
              const label = COL_LABELS[j] ?? col.display_name;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className={`sticky z-10 bg-white px-2 py-2 font-bold whitespace-nowrap cursor-pointer select-none hover:opacity-70 leading-tight border-b border-gray-200 ${isLeft ? "text-left" : "text-center"}`}
                  style={{ color: "#111827", top: headerTop }}
                >
                  <span className={`inline-flex items-center gap-1 ${isLeft ? "justify-start" : "justify-center"}`}>
                    {label}
                    {active
                      ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      : <ArrowUpDown size={11} className="opacity-30" />}
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
                const isLeft = LEFT_ALIGN_INDICES.has(j);
                return (
                  <td key={j} className={`px-4 py-1.5 ${isLeft ? "text-left" : "text-center"} ${isNum ? "tabular-nums whitespace-nowrap" : ""} text-gray-800`}>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function PersonaInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterJobFunction, setFilterJobFunction] = useState<string[]>([]);

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });

  const [allRows, setAllRows] = useState<Row[]>([]);

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
    if (dateStart)              params.set("dateStart",   dateStart);
    if (dateEnd)                params.set("dateEnd",     dateEnd);
    // District and Job Function values routinely contain commas (e.g.
    // "DIRECTOR, ASSESSMENT", "JACKSON COUNTY PUBLIC SCHOOLS, NC"), so each
    // selection is appended as its own param instead of comma-joined —
    // joining would silently split those values apart on the server.
    filterDistrict.forEach((v) => params.append("district", v));
    filterState.forEach((v) => params.append("state", v));
    filterJobFunction.forEach((v) => params.append("jobFunction", v));

    fetch(`/api/q168-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [dateStart, dateEnd, filterDistrict, filterState, filterJobFunction]);

  // Card 168 has no template tags — filter campaign client-side.
  // Campaign column is at index 4 and stores short codes ("C6").
  useEffect(() => {
    const prefixes = campaign.map((c) => c.split(":")[0].trim());
    setRows(prefixes.length === 0 ? allRows : allRows.filter((row) => prefixes.includes(String(row[4] ?? ""))));
  }, [campaign, allRows]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterState([]);
    setFilterJobFunction([]);
  }, [resetSignal]);

  // Export columns/rows follow the on-screen column order (COL_ORDER) and use
  // the same friendly headers shown in the table:
  // District, Domain, State, Campaign, Job Function, Leads, Engagements.
  const exportCols = useMemo(
    () =>
      cols.length
        ? COL_ORDER.map((j) => cols[j])
            .map((c, idx) =>
              c ? { ...c, display_name: COL_LABELS[COL_ORDER[idx]] ?? c.display_name } : c,
            )
            .filter(Boolean)
        : cols,
    [cols],
  );
  const exportRows = useMemo(
    () => rows.map((row) => COL_ORDER.map((j) => row[j])),
    [rows],
  );

  useRegisterCsvExport(() => exportToCsv("persona-insights", exportCols, exportRows));

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MultiSelectDropdown label="District"     value={filterDistrict}    onChange={setFilterDistrict}    search={fetchFieldOptions("district")} />
            <MultiSelectDropdown label="Job Function" value={filterJobFunction} onChange={setFilterJobFunction} search={fetchFieldOptions("job_function")} />
            <MultiSelectDropdown label="State"        value={filterState}       onChange={setFilterState}       search={fetchFieldOptions("state")} />
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {/* Section title */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Engagements By Persona Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button
              onClick={() => exportToCsv("persona-insights", exportCols, exportRows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export CSV
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
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ clipPath: "inset(0 round 0 0 0.75rem 0.75rem)" }}>
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} headerTop={titleBarHeight} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <PersonaInsightsContent />;
}
