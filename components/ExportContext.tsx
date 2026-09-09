"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

/**
 * Lets the current page hand the global DashboardHeader an export action for
 * whatever table it is showing, so the header "Export CSV" button always
 * exports the columns/rows of the tab the user is on. Pages register their
 * exporter on mount and clear it on unmount.
 */
interface ExportState {
  csvExport: (() => void) | null;
  setCsvExport: (fn: (() => void) | null) => void;
}

const ExportContext = createContext<ExportState>({
  csvExport: null,
  setCsvExport: () => {},
});

export function ExportProvider({ children }: { children: ReactNode }) {
  const [csvExport, setCsvExport] = useState<(() => void) | null>(null);
  return (
    <ExportContext.Provider value={{ csvExport, setCsvExport }}>
      {children}
    </ExportContext.Provider>
  );
}

export function useExport() {
  return useContext(ExportContext);
}

/**
 * Register a per-tab CSV exporter with the global header for the lifetime of
 * the calling component. `run` may be a fresh closure every render (so it can
 * capture the latest columns/rows); a stable wrapper backed by a ref is what
 * actually gets registered, so this only touches context state on mount/unmount.
 */
export function useRegisterCsvExport(run: () => void) {
  const { setCsvExport } = useExport();
  const runRef = useRef(run);

  useEffect(() => { runRef.current = run; });

  useEffect(() => {
    const stable = () => runRef.current();
    setCsvExport(() => stable);
    return () => setCsvExport(null);
  }, [setCsvExport]);
}
