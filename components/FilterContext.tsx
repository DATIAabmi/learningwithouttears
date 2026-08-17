"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { DEFAULT_CAMPAIGN } from "@/lib/campaigns";

interface FilterState {
  dateStart: string;
  dateEnd: string;
  setDateStart: (d: string) => void;
  setDateEnd: (d: string) => void;
  metabaseDateRange: string | undefined;
  campaign: string[];
  setCampaign: (c: string[]) => void;
  district: string[];
  setDistrict: (d: string[]) => void;
  /** Increments each time resetAll() is called. Pages watch this to reset local state. */
  resetSignal: number;
  resetAll: () => void;
}

const FilterContext = createContext<FilterState>({
  dateStart: "",
  dateEnd: "",
  setDateStart: () => {},
  setDateEnd: () => {},
  metabaseDateRange: undefined,
  campaign: [],
  setCampaign: () => {},
  district: [],
  setDistrict: () => {},
  resetSignal: 0,
  resetAll: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [campaign, setCampaign] = useState<string[]>([DEFAULT_CAMPAIGN]);
  const [district, setDistrict] = useState<string[]>([]);
  const [resetSignal, setResetSignal] = useState(0);

  const metabaseDateRange =
    dateStart && dateEnd ? `${dateStart}~${dateEnd}` : undefined;

  function resetAll() {
    setCampaign([DEFAULT_CAMPAIGN]);
    setDateStart("");
    setDateEnd("");
    setDistrict([]);
    setResetSignal((s) => s + 1);
  }

  return (
    <FilterContext.Provider
      value={{ dateStart, dateEnd, setDateStart, setDateEnd, metabaseDateRange, campaign, setCampaign, district, setDistrict, resetSignal, resetAll }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
