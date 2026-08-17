"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";

const KEYWORDS = ["after school", "child care", "head start", "enrichment"];

function fetchFieldOptions(field: "district" | "state" | "domain") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

// Column order from card 425: 0=District 1=Campaign 2=District Domain 3=ST 4=SBM Date 5=Keyword 6=SBM Context 7=SBM Link
const SORT_COLUMNS = [
  { label: "District",  index: 0 },
  { label: "Campaign",  index: 1 },
  { label: "State",     index: 3 },
  { label: "SBM Date",  index: 4 },
  { label: "Keyword",   index: 5 },
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
        <span className="text-blue-600 font-medium">{current?.label ?? "SBM Date"}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] py-1">
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

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];

// Visual column order: District, Domain, State, Campaign, then the rest as-is.
// Raw data order (card 425): 0=District 1=Campaign 2=District Domain 3=ST
// 4=SBM Date 5=Keyword 6=SBM Context 7=SBM Link
const COL_ORDER = [0, 2, 3, 1, 4, 5, 6, 7];
const HEADER_LABELS: Record<string, string> = { "District Domain": "Domain" };

function DataTable({ cols, rows, sort, onSort, headerTop = 0 }: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
  headerTop?: number;
}) {
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm bg-white">No results</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="bg-white">
      <table className="text-xs border-collapse w-full table-fixed">
        <colgroup>
          <col style={{ width: 36 }} />   {/* # */}
          <col style={{ width: 140 }} />  {/* District */}
          <col style={{ width: 120 }} />  {/* Domain */}
          <col style={{ width: 44 }} />   {/* State */}
          <col style={{ width: 52 }} />   {/* Campaign */}
          <col style={{ width: 88 }} />   {/* SBM Date */}
          <col style={{ width: 110 }} />  {/* Keyword */}
          <col />                         {/* SBM Context — takes remaining space */}
          <col style={{ width: 56 }} />   {/* SBM Link */}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-2 py-2 text-right font-bold whitespace-nowrap border-b border-gray-200" style={{ color: "#111827", top: headerTop }}>#</th>
            {COL_ORDER.map((j) => {
              const col = cols[j];
              if (!col) return null;
              const active = sort.col === j;
              const sortable = SORT_COLUMNS.some((s) => s.index === j);
              const label = HEADER_LABELS[col.display_name] ?? col.display_name;
              return (
                <th key={j}
                  onClick={() => sortable && onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className={`sticky z-10 bg-white px-2 py-2 font-bold border-b border-gray-200 ${sortable ? "cursor-pointer select-none hover:opacity-70" : ""}`}
                  style={{ color: "#111827", textAlign: j === 1 ? "center" : "left", top: headerTop }}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortable && (active
                      ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      : <ArrowUpDown size={11} className="opacity-30" />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-1.5 text-right text-gray-400 text-xs whitespace-nowrap">{i + 1}</td>
              {COL_ORDER.map((j) => {
                const cell = row[j];
                const val = cell === null || cell === undefined ? "" : String(cell);
                // SBM Link (index 7) — clickable link
                if (j === 7 && val) {
                  return (
                    <td key={j} className="px-2 py-1.5 text-center whitespace-nowrap">
                      <a href={val} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium">
                        View <ExternalLink size={11} />
                      </a>
                    </td>
                  );
                }
                // SBM Context (index 6) — allow wrapping for long text
                if (j === 6) {
                  return (
                    <td key={j} className="px-2 py-1.5 text-left text-gray-800">
                      <span className="line-clamp-3 block text-xs leading-relaxed break-words">{val}</span>
                    </td>
                  );
                }
                // Campaign (index 1) — show short code only e.g. "C6"
                // SBM Date (index 4) — strip ISO timestamp, show date only
                const display = j === 1 ? val.split(":")[0].trim()
                  : j === 4 ? val.replace(/T.*$/, "")
                  : val;
                // District(0): wrap at word boundaries; Domain(2): break-all for URLs;
                // Keyword(5): truncate with ellipsis; others: nowrap
                const cellClass = j === 0 ? "break-words"
                  : j === 2 ? "break-all"
                  : j === 5 ? "truncate"
                  : "whitespace-nowrap";
                return (
                  <td key={j} className={`px-2 py-1.5 text-gray-800 text-xs ${cellClass}`}
                    style={{ textAlign: j === 1 ? "center" : "left" }}>{display}</td>
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

const SBM_SKELETON_COLS = [28, 80, 100, 36, 88, 80, 200, 48];
const SBM_LOADING_MESSAGES = [
  "Fetching school board minutes…",
  "Searching meeting records…",
  "Indexing district keywords…",
  "Almost there…",
];

function SkeletonTable() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setMsgIdx((i) => (i + 1) % SBM_LOADING_MESSAGES.length), 2800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden bg-white">
      <style>{`
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        .sbm-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:1200px 100%;animation:shimmer 1.6s infinite linear}
      `}</style>
      <div className="flex items-center gap-2.5 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shrink-0" />
        <span className="text-xs text-gray-500">{SBM_LOADING_MESSAGES[msgIdx]}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200">
        {SBM_SKELETON_COLS.map((w, i) => (
          <div key={i} className="sbm-shimmer rounded" style={{ width: w, height: 10, flexShrink: 0 }} />
        ))}
      </div>
      {Array.from({ length: 12 }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100">
          {SBM_SKELETON_COLS.map((w, i) => (
            <div key={i} className="sbm-shimmer rounded"
              style={{ width: Math.round(w * (0.5 + Math.random() * 0.5)), height: 9, flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function SchoolBoardContent() {
  const searchParams = useSearchParams();
  const urlDistrict = searchParams.get("district");
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>(urlDistrict ? [urlDistrict] : []);
  const [filterDomain, setFilterDomain] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterKeyword, setFilterKeyword] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({ col: 4, dir: "desc" }); // default: SBM Date desc

  const [allCols, setAllCols] = useState<Col[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // Sync URL district param on navigation
  useEffect(() => {
    if (urlDistrict) setFilterDistrict([urlDistrict]);
  }, [urlDistrict]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)       params.set("campaign", campaign.join(","));
    if (filterDistrict.length) params.set("district", filterDistrict.join(","));
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd)   params.set("dateEnd", dateEnd);

    fetch(`/api/q425-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setAllCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, filterDistrict, dateStart, dateEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterState([]);
    setFilterKeyword([]);
  }, [resetSignal]);

  // Client-side filter: 0=District 1=Campaign 2=District Domain 3=ST 4=SBM Date 5=Keyword 6=SBM Context 7=SBM Link
  const filteredRows = allRows.filter((row) => {
    if (filterDomain.length  && !filterDomain.map((v) => v.toLowerCase()).includes(String(row[2] ?? "").toLowerCase()))  return false;
    if (filterState.length   && !filterState.map((v) => v.toLowerCase()).includes(String(row[3] ?? "").toLowerCase()))   return false;
    if (filterKeyword.length && !filterKeyword.map((v) => v.toLowerCase()).includes(String(row[5] ?? "").toLowerCase())) return false;
    return true;
  });

  return (
    <MetabaseProviderWrapper>
      <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                    display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
        <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
          <DashboardHeader />

          {/* Filter + sort bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} search={fetchFieldOptions("district")} />
              <MultiSelectDropdown label="Domain"   value={filterDomain}   onChange={setFilterDomain}   search={fetchFieldOptions("domain")} />
              <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={fetchFieldOptions("state")} />
              <MultiSelectDropdown label="Keyword"  value={filterKeyword}  onChange={setFilterKeyword}  options={KEYWORDS} />
            </div>
            <SortDropdown sort={sort} onSort={setSort} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
          {/* Section title */}
          <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm tracking-wide uppercase">School Board Minutes</span>
              {!loading && filteredRows.length > 0 && (
                <span className="text-gray-400 text-xs">{filteredRows.length.toLocaleString()} records</span>
              )}
            </div>
            {filteredRows.length > 0 && (
              <button
                onClick={() => exportToCsv("school-board-minutes", allCols, filteredRows)}
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
              <DataTable cols={allCols} rows={filteredRows} sort={sort} onSort={setSort} headerTop={titleBarHeight} />
            </div>
          )}
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}

export default function SchoolBoardMinutesPage() {
  return (
    <Suspense>
      <SchoolBoardContent />
    </Suspense>
  );
}
