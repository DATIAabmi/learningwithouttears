"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Download, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { useRegisterCsvExport } from "@/components/ExportContext";
import { fmtDate } from "@/lib/fmtDate";

type Signal = Record<string, unknown>;
type SortDir = "asc" | "desc";
interface SortState { col: string; dir: SortDir }

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// Full column grid — table scrolls horizontally
// # | District | Domain | State | Campaign | Keywords | Source Link | Date | Category | Source | Signal Analysis | Strength | Source Text
const COLS = [
  { key: "#",               width: 30,  sort: false, flex: false, center: false },
  { key: "District",        width: 120, sort: true,  flex: false, center: false },
  { key: "Domain",          width: 120, sort: true,  flex: false, center: false },
  { key: "State",           width: 40,  sort: true,  flex: false, center: true  },
  { key: "Campaign",        width: 65,  sort: true,  flex: false, center: true  },
  { key: "Keywords",        width: 160, sort: true,  flex: false, center: false },
  { key: "Source Link",     width: 90,  sort: false, flex: false, center: false },
  { key: "Date",            width: 75,  sort: true,  flex: false, center: false },
  { key: "Category",        width: 115, sort: true,  flex: false, center: false },
  { key: "Source",          width: 90,  sort: true,  flex: false, center: false },
  { key: "Signal Analysis", width: 220, sort: true,  flex: true,  center: false },
  { key: "Strength",        width: 70,  sort: true,  flex: false, center: true  },
  { key: "Source Text",     width: 260, sort: false, flex: true,  center: false },
];

const SORT_OPTIONS = COLS.filter((c) => c.sort);

// Signal Analysis expands to fill extra horizontal space; all others are fixed
const GRID = COLS.map((c) => c.flex ? `minmax(${c.width}px, 1fr)` : `${c.width}px`).join(" ");
const GAP  = "0 8px";
const MIN_W = COLS.reduce((s, c) => s + c.width, 0) + (COLS.length - 1) * 8 + 40;

// ── Sort dropdown ─────────────────────────────────────────────────────────────
function SortDropdown({ sort, onSort }: { sort: SortState; onSort: (s: SortState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <span className="text-blue-600 font-medium text-xs">{sort.col}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          {SORT_OPTIONS.map((c) => {
            const active = sort.col === c.key;
            return (
              <button key={c.key}
                onClick={() => { onSort({ col: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" }); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
                {c.key}
                {active && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Map column header key → the row field it sorts by
function getRowValue(row: Signal, colKey: string): unknown {
  switch (colKey) {
    case "District":        return row["Organization"];
    case "Domain":          return (row["Domain"] as string) || extractDomain(row["Source Link"] as string);
    case "State":           return row["State"];
    case "Campaign":        return row["Campaign #"];
    case "Keywords":        return row["Keywords"];
    case "Date":            return row["Date"];
    case "Category":        return row["Category"];
    case "Source":          return row["Source"];
    case "Signal Analysis": return row["Signal Analysis"];
    case "Strength":        return row["Strength"];
    default:                return null;
  }
}

export default function AIOpportunityFeed() {
  const { resetSignal } = useFilter();
  const [rows, setRows]       = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [sort, setSort]       = useState<SortState>({ col: "Date", dir: "desc" });
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterSource,   setFilterSource]   = useState<string[]>([]);
  const [searchText,     setSearchText]     = useState("");

  // Clear this page's local filters when the global "Reset Filters" is clicked.
  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterCategory([]);
    setFilterSource([]);
    setSearchText("");
  }, [resetSignal]);

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

  useEffect(() => {
    setLoading(true);
    fetch("/api/ai-signals-data?v=2")
      .then((r) => r.json())
      .then((d: { rows?: Signal[]; columns?: string[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message ?? "Failed to load"); setLoading(false); });
  }, []);

  const categoryOptions = [...new Set(rows.map((r) => String(r["Category"] ?? "")).filter(Boolean))].sort();
  const sourceOptions   = [...new Set(rows.map((r) => String(r["Source"]   ?? "")).filter(Boolean))].sort();

  const q = searchText.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filterCategory.length && !filterCategory.includes((r["Category"] as string) ?? "")) return false;
    if (filterSource.length   && !filterSource.includes((r["Source"] as string) ?? ""))     return false;
    if (q) {
      const haystack = [
        r["Keywords"], r["Organization"], r["State"], r["Campaign #"],
        r["Source"], r["Category"],
        extractDomain(r["Source Link"] as string),
      ].map((v) => String(v ?? "").toLowerCase()).join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getRowValue(a, sort.col);
    const bv = getRowValue(b, sort.col);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const csvCols = [
    "Organization", "Domain", "State", "Campaign #", "Keywords",
    "Source Link", "Date", "Category", "Source", "Signal Analysis", "Strength", "Source Text",
  ].map((k) => ({ display_name: k, base_type: "type/Text" }));
  const csvRows = sorted.map((r) => csvCols.map((c) => r[c.display_name]));

  useRegisterCsvExport(() => exportToCsv("account-intelligence", csvCols as never, csvRows as never));

  return (
    <div style={{ position: "fixed", top: 0, left: "14rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      {/* Filters */}
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search district, state…"
                className="text-xs text-gray-700 bg-transparent border-none outline-none w-44 placeholder-gray-400"
              />
              {searchText && (
                <button onClick={() => setSearchText("")} className="text-gray-300 hover:text-gray-500 ml-0.5 text-xs leading-none">✕</button>
              )}
            </div>
            <MultiSelectDropdown label="Category" value={filterCategory} onChange={setFilterCategory} options={categoryOptions} />
            <MultiSelectDropdown label="Source"   value={filterSource}   onChange={setFilterSource}   options={sourceOptions} />
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>
      </div>

      {/* Horizontally scrollable content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <div style={{ minWidth: MIN_W, width: "100%" }}>
          {/* Title bar */}
          <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm tracking-wide uppercase">Account Intelligence</span>
              {!loading && <span className="text-gray-400 text-xs">{sorted.length.toLocaleString()} signals</span>}
            </div>
            {!loading && sorted.length > 0 && (
              <button
                onClick={() => exportToCsv("account-intelligence", csvCols as never, csvRows as never)}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
              >
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
              <Loader2 size={18} className="animate-spin" /> Loading AI signals…
            </div>
          )}
          {!loading && error && (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
          )}
          {!loading && !error && (
            <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm bg-white">
              {/* Column headers */}
              <div
                className="sticky z-10 bg-white border-b border-gray-200 grid text-xs font-semibold"
                style={{ top: titleBarHeight, color: "#111827", gridTemplateColumns: GRID, gap: GAP, padding: "10px 20px" }}
              >
                {COLS.map((c) => (
                  <span
                    key={c.key}
                    onClick={c.sort ? () => setSort({ col: c.key, dir: sort.col === c.key && sort.dir === "desc" ? "asc" : "desc" }) : undefined}
                    className={`${c.sort ? "cursor-pointer hover:opacity-70 " : ""}inline-flex items-center gap-0.5${c.center ? " justify-center" : ""}`}
                  >
                    {c.key}
                    {c.sort && sort.col === c.key && (
                      sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />
                    )}
                  </span>
                ))}
              </div>

              {sorted.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No signals match filters</div>
              ) : (
                sorted.map((row, i) => {
                  const link   = row["Source Link"] as string | null;
                  const domain = (row["Domain"] as string) || extractDomain(link);

                  return (
                    <div
                      key={i}
                      className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors items-start"
                      style={{ gridTemplateColumns: GRID, gap: GAP, padding: "11px 20px" }}
                    >
                      {/* # */}
                      <div className="text-xs text-gray-400 tabular-nums pt-0.5">{i + 1}</div>

                      {/* District (Organization in DB) */}
                      <div className="text-xs text-gray-700 leading-snug pt-0.5 break-words">
                        {(row["Organization"] as string) || "—"}
                      </div>

                      {/* Domain */}
                      <div className="text-xs text-gray-600 leading-snug pt-0.5 truncate">
                        {domain || "—"}
                      </div>

                      {/* State */}
                      <div className="text-xs text-gray-600 pt-0.5 text-center">
                        {(row["State"] as string) || "—"}
                      </div>

                      {/* Campaign */}
                      <div className="text-xs text-gray-600 pt-0.5 text-center">
                        {(row["Campaign #"] as string) || "—"}
                      </div>

                      {/* Keywords */}
                      <div className="text-xs text-gray-800 leading-snug pt-0.5 break-words">
                        {(row["Keywords"] as string) || "—"}
                      </div>

                      {/* Source Link */}
                      <div className="text-xs pt-0.5">
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 transition-colors"
                            title={link}>
                            <span className="truncate max-w-[72px] inline-block">{domain}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        ) : "—"}
                      </div>

                      {/* Date */}
                      <div className="text-xs text-gray-500 tabular-nums pt-0.5">
                        {fmtDate(row["Date"])}
                      </div>

                      {/* Category */}
                      <div className="text-xs text-gray-700 leading-snug pt-0.5 break-words">
                        {(row["Category"] as string) || "—"}
                      </div>

                      {/* Source */}
                      <div className="text-xs text-gray-600 leading-snug pt-0.5 truncate">
                        {(row["Source"] as string) || "—"}
                      </div>

                      {/* Signal Analysis */}
                      <div className="text-xs text-gray-800 leading-relaxed pt-0.5 break-words">
                        {(row["Signal Analysis"] as string) || "—"}
                      </div>

                      {/* Strength */}
                      <div className="text-xs text-gray-600 tabular-nums pt-0.5 text-center">
                        {row["Strength"] !== null && row["Strength"] !== undefined && row["Strength"] !== "" ? String(row["Strength"]) : "—"}
                      </div>

                      {/* Source Text */}
                      <div className="text-xs text-gray-800 pt-0.5 break-words leading-snug">
                        {(row["Source Text"] as string) || "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
