"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import UsStateChoropleth from "@/components/UsStateChoropleth";
import { exportToCsv } from "@/lib/exportCsv";
function fetchFieldOptions(field: "district" | "state") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}



// ─── Engagements by Geography ──────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }
type Col = { display_name: string; base_type: string };
type GeoRow = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
const GEO_LEFT_ALIGN_COLS = new Set<string>();

function GeographyTable({
  campaign, dateStart, dateEnd, filterDistrict, filterState, selectedState, setSelectedState,
}: {
  campaign: string[]; dateStart: string; dateEnd: string;
  filterDistrict: string[]; filterState: string[];
  selectedState: string | null; setSelectedState: (s: string | null) => void;
}) {
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 2, dir: "desc" });

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)       params.set("campaign", campaign.join(","));
    if (dateStart)             params.set("dateStart", dateStart);
    if (dateEnd)               params.set("dateEnd", dateEnd);
    if (filterDistrict.length) params.set("district", filterDistrict.join(","));
    // State is filtered client-side — dataset is ~50 rows so no round-trip needed.

    fetch(`/api/q169-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setCols(d.cols ?? []); setRows(d.rows ?? []); setLoading(false); })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict]);

  const stateCol = cols.findIndex((c) => c.display_name === "State");

  // Client-side state filter — Metabase aggregates one row per state so this
  // is instant and also keeps the map in sync with the selected filter.
  const filteredRows = filterState.length > 0 && stateCol >= 0
    ? rows.filter((row) => filterState.some((s) => s.toLowerCase() === String(row[stateCol] ?? "").toLowerCase()))
    : rows;

  const sorted = [...filteredRows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const engagedUsersCol = cols.findIndex((c) => c.display_name === "Engaged Users");
  const valueByState: Record<string, number> = {};
  if (stateCol >= 0 && engagedUsersCol >= 0) {
    for (const row of filteredRows) {
      const state = String(row[stateCol] ?? "");
      const value = Number(row[engagedUsersCol]) || 0;
      if (state) valueByState[state] = value;
    }
  }

  const totals = cols.map((col, j) => {
    if (j === stateCol) return "Grand total";
    if (!NUMBER_TYPES.has(col.base_type)) return "";
    return filteredRows.reduce((sum, row) => sum + (Number(row[j]) || 0), 0);
  });

  const displayName = (name: string) => (name === "Leads" ? "Unique Leads" : name);

  return (
    <div>
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
        <span className="font-bold text-sm tracking-wide uppercase">Engagements By Geography</span>
        {filteredRows.length > 0 && (
          <button
            onClick={() => exportToCsv("engagements-by-geography", cols, filteredRows)}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center justify-center h-48 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center justify-center h-48 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
      )}
      {!loading && !error && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden shadow-sm bg-white">
          {filteredRows.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-white">No results</div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 p-4">
              <div className="lg:w-1/2 shrink-0 flex items-start">
                <UsStateChoropleth
                  valueByState={valueByState}
                  selectedState={selectedState ?? undefined}
                  onStateClick={(abbr) => setSelectedState((s) => s === abbr ? null : abbr)}
                />
              </div>
              <div className="lg:w-1/2 min-w-0 overflow-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-center w-10 font-semibold whitespace-nowrap" style={{ color: "#111827" }}>#</th>
                      {cols.map((col, j) => {
                        const isLeft = GEO_LEFT_ALIGN_COLS.has(col.display_name);
                        const active = sort.col === j;
                        return (
                          <th key={j}
                            onClick={() => setSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                            className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 ${isLeft ? "text-left" : "text-center"}`}
                            style={{ color: "#111827" }}
                          >
                            <span className={`inline-flex items-center gap-1 ${isLeft ? "justify-start" : "justify-center"}`}>
                              {displayName(col.display_name)}
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
                    {sorted.map((row, i) => {
                      const rowState = stateCol >= 0 ? String(row[stateCol] ?? "") : "";
                      const isActive = rowState && rowState === selectedState;
                      return (
                        <tr
                          key={i}
                          onClick={() => setSelectedState((s) => s === rowState ? null : rowState)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isActive ? "bg-orange-50" : "hover:bg-gray-50"}`}
                        >
                          <td className={`px-3 py-1.5 text-center text-xs w-10 shrink-0 ${isActive ? "text-orange-500 font-bold" : "text-gray-400"}`}>{i + 1}</td>
                          {row.map((cell, j) => {
                            const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                            const isLeft = GEO_LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                            return (
                              <td key={j} className={`px-4 py-1.5 ${isLeft ? "text-left" : "text-center"} ${isNum ? "tabular-nums" : ""} ${isActive ? "text-orange-700 font-semibold" : "text-gray-800"}`}>
                                {cell === null || cell === undefined ? "" : String(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td className="px-3 py-2"></td>
                      {totals.map((val, j) => {
                        const isLeft = GEO_LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                        return (
                          <td key={j} className={`px-4 py-2 ${isLeft ? "text-left" : "text-center tabular-nums"} text-gray-900`}>
                            {typeof val === "number" ? val.toLocaleString() : val}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function GeoInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterState([]);
    setSelectedState(null);
  }, [resetSignal]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-3">
          <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} search={fetchFieldOptions("district")} />
          <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={fetchFieldOptions("state")} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <GeographyTable
          campaign={campaign}
          dateStart={dateStart}
          dateEnd={dateEnd}
          filterDistrict={filterDistrict}
          filterState={filterState}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <GeoInsightsContent />
    </MetabaseProviderWrapper>
  );
}
