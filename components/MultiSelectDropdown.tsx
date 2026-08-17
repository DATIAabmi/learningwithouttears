"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";

interface BaseProps {
  label: string;
  value: string[];
  onChange: (values: string[]) => void;
  minWidth?: number;
}

interface StaticProps extends BaseProps {
  /** Fixed, fully-known option list (e.g. campaigns). */
  options: string[];
  search?: undefined;
}

interface SearchProps extends BaseProps {
  /** Async live-search, e.g. district/state/domain/job function lookups. */
  search: (query: string) => Promise<string[]>;
  options?: undefined;
}

type Props = StaticProps | SearchProps;

function summarize(value: string[]): string {
  if (value.length === 0) return "All";
  if (value.length === 1) return value[0];
  return `${value.length} selected`;
}

export default function MultiSelectDropdown(props: Props) {
  const { label, value, onChange, minWidth = 180 } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>(props.options ?? []);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const runSearch = useCallback((q: string) => {
    if (!props.search) return;
    setLoading(true);
    props.search(q).then((vals) => { setOptions(vals); setLoading(false); }).catch(() => setLoading(false));
  }, [props.search]);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    setQuery("");
    if (next && props.search) {
      setTimeout(() => { inputRef.current?.focus(); }, 50);
      runSearch("");
    }
  }

  function handleSearchInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  }

  function toggle(opt: string) {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  }

  const displayOptions = props.options ?? options;
  const allShownSelected = displayOptions.length > 0 && displayOptions.every((opt) => value.includes(opt));
  const active = value.length > 0;

  function toggleSelectAllShown() {
    if (allShownSelected) {
      onChange(value.filter((v) => !displayOptions.includes(v)));
    } else {
      onChange([...new Set([...value, ...displayOptions])]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={`group flex items-center gap-2 px-3.5 py-2 rounded-full text-sm shadow-sm transition-all duration-150 border ${
          active
            ? "bg-blue-50 border-blue-200 hover:border-blue-300 hover:shadow"
            : "bg-white border-gray-200 hover:border-gray-300 hover:shadow"
        } ${open ? "ring-2 ring-blue-100 border-blue-300" : ""}`}
        style={{ minWidth }}
      >
        <span className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${active ? "text-blue-400" : "text-gray-400"}`}>
          {label}
        </span>
        <span className="flex-1 text-left truncate text-xs">
          {active
            ? <span className="text-blue-700 font-semibold">{summarize(value)}</span>
            : <span className="text-gray-400">All</span>}
        </span>
        {active ? (
          <span
            role="button"
            className="flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:text-white hover:bg-blue-500 shrink-0 transition-colors"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          >
            <X size={11} />
          </span>
        ) : (
          <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-72 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/60 overflow-hidden">
          {props.search && (
            <div className="p-2.5 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
            </div>
          )}

          {active && (
            <div className="flex flex-wrap gap-1.5 p-2.5 border-b border-gray-100 max-h-24 overflow-y-auto bg-gray-50/60">
              {value.map((v) => (
                <span key={v} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-white border border-blue-100 text-blue-700 text-xs font-medium rounded-full shadow-sm">
                  <span className="truncate max-w-[160px]">{v}</span>
                  <button onClick={() => toggle(v)} className="text-blue-300 hover:text-blue-700 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => onChange([])}
                className="text-xs text-gray-400 hover:text-red-500 font-medium px-1.5 py-1 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {loading && <p className="px-4 py-3 text-xs text-gray-400 text-center">Searching…</p>}
            {!loading && displayOptions.length === 0 && query && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">No results for &quot;{query}&quot;</p>
            )}
            {!loading && displayOptions.length === 0 && !query && props.search && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">Type to search</p>
            )}
            {!loading && displayOptions.length > 0 && (props.search ? query : true) && (
              <button
                onClick={toggleSelectAllShown}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 mb-1 border-b border-gray-100"
              >
                {allShownSelected ? "Deselect all shown" : `Select all ${displayOptions.length} shown`}
              </button>
            )}
            {!loading && displayOptions.map((opt) => {
              const checked = value.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center gap-2.5 text-left px-4 py-2 mx-1 rounded-lg text-sm truncate transition-colors ${checked ? "text-blue-700 font-semibold bg-blue-50" : "text-gray-700 hover:bg-gray-50"}`}
                  style={{ width: "calc(100% - 8px)" }}
                >
                  <span className={`flex items-center justify-center w-4 h-4 rounded-md border shrink-0 transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                    {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
