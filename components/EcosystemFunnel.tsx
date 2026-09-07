"use client";

import { useEffect, useState } from "react";
import { CalendarSearch, Loader2, X } from "lucide-react";
import { useFilter } from "./FilterContext";
import { CAMPAIGNS, campaignGoals } from "@/lib/campaigns";
import MultiSelectDropdown from "./MultiSelectDropdown";

const STEP = 26;
const CARD_W = 240;
const ROW_H = 80;

function fmt(val: string | number | null): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return Math.round(n).toLocaleString();
}

function computePct(actual: string | number | null, goal: number): string | undefined {
  const n = Number(actual);
  if (actual === null || actual === undefined || isNaN(n)) return undefined;
  return Math.round((n / goal) * 100) + "%";
}

interface FunnelData {
  impressions: string | number | null;
  engagements: string | number | null;
  ctr: string | number | null;
  engagedUsers: string | number | null;
  leads: string | number | null;
}

interface Stage {
  label: string;
  description: string;
  goal?: string;
  value: string;
  goalValue?: string;
}

export function EcosystemFilterBar() {
  const { campaign, setCampaign, dateStart, dateEnd, setDateStart, setDateEnd } = useFilter();

  return (
    <div className="flex items-center gap-2 mb-2">
      {/* Campaign pill */}
      <MultiSelectDropdown
        label="ABMi Campaign"
        value={campaign}
        onChange={setCampaign}
        options={[...CAMPAIGNS]}
        minWidth={220}
      />

      {/* Date range pill */}
      <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
        <CalendarSearch size={14} className="text-orange-400 shrink-0" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">Date Range:</span>
        <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
          className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
        <span className="text-gray-300 text-xs">–</span>
        <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
          className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
        {(dateStart || dateEnd) && (
          <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="text-gray-300 hover:text-gray-500 ml-0.5">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function EcosystemFunnel() {
  const { campaign, dateStart, dateEnd } = useFilter();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaign.length) params.set("campaign", campaign.join(","));
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd) params.set("dateEnd", dateEnd);
    const qs = params.toString();
    fetch(`/api/funnel-data${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (error || !data) {
    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error || "Failed to load"}</div>;
  }

  const goals = campaignGoals(campaign);

  const stages: Stage[] = [
    {
      label: "Impressions",
      description: "Total times ads were displayed",
      goal: `Impression Goal: ${goals.impressions.toLocaleString()}`,
      value: fmt(data.impressions),
      goalValue: computePct(data.impressions, goals.impressions),
    },
    {
      label: "Engagements",
      description: "Click across digital channels and email opens",
      value: fmt(data.engagements),
    },
    {
      label: "Click-Through Rate (CTR)",
      description: "Percentage of impressions that generated a click",
      value: fmt(data.ctr),
    },
    {
      label: "Unique Engaged Users (UEU)",
      description: "Unique individuals who engaged",
      value: fmt(data.engagedUsers),
    },
    {
      label: "Leads",
      description: "Content downloads by personas",
      goal: `Goal: ${goals.leads.toLocaleString()} Leads`,
      value: fmt(data.leads),
      goalValue: computePct(data.leads, goals.leads),
    },
  ];

  return (
    <div className="w-full py-4 px-2">
      {/*
        Below the `ef-wide` breakpoint there isn't enough room for the
        staircase-indent + fixed-width card layout — the description column
        collapses to almost nothing and text wraps to one word per line.
        Below that width, rows stack (description on top, metric card below,
        both full-width) instead of sitting side by side.
      */}
      <style>{`
        .ef-row { display: flex; flex-direction: column; }
        .ef-indent { display: none; }
        .ef-chevron { border-radius: 6px; clip-path: none !important; padding-right: 16px !important; }
        .ef-card { width: 100% !important; border-radius: 6px; margin-top: 6px; display: flex; flex-direction: column; }
        .ef-card-goal { width: 100%; border-top: 1px solid #374151; padding-top: 6px; margin-top: 6px; }
        @media (min-width: 860px) {
          .ef-row { flex-direction: row; align-items: stretch; }
          .ef-indent { display: block; }
          .ef-chevron { border-radius: 0; }
          .ef-chevron.ef-notlast { clip-path: polygon(0 0, 100% 0, calc(100% - 30px) 100%, 0 100%) !important; padding-right: 44px !important; }
          .ef-chevron.ef-islast { border-radius: 6px 0 0 6px; padding-right: 28px !important; }
          .ef-card { width: ${CARD_W}px !important; margin-top: 0; border-radius: 0; flex-direction: row; align-items: center; }
          .ef-card.ef-islast { border-radius: 0 6px 6px 0; }
          .ef-card-goal { width: auto; min-width: 72px; border-top: none; border-left: 1px solid #374151; padding-top: 0; padding-left: 8px; margin-top: 0; }
        }
      `}</style>
      <div className="flex flex-col gap-1.5">
        {stages.map((stage, i) => {
          const indent = i * STEP;
          const isLast = i === stages.length - 1;

          return (
            <div key={stage.label} className="ef-row" style={{ minHeight: ROW_H }}>
              {/* Staircase spacer (wide layout only) */}
              <div className="ef-indent" style={{ width: indent, flexShrink: 0 }} />

              {/* Gray chevron */}
              <div
                className={`ef-chevron flex flex-col justify-center pl-8 bg-gray-200 ${isLast ? "ef-islast" : "ef-notlast"}`}
                style={{ flex: 1, minWidth: 0 }}
              >
                <h3
                  className="font-black text-gray-900 leading-none"
                  style={{ fontSize: 16, letterSpacing: "-0.01em" }}
                >
                  {stage.label}
                </h3>
                <p className="text-gray-500 mt-0.5 leading-snug" style={{ fontSize: 10, maxWidth: 200 }}>
                  {stage.description}
                </p>
                {stage.goal && (
                  <p className="font-semibold text-green-600 mt-0.5" style={{ fontSize: 10 }}>
                    {stage.goal}
                  </p>
                )}
              </div>

              {/* Dark metric card */}
              <div
                className={`ef-card bg-gray-950 text-white shrink-0 ${isLast ? "ef-islast" : ""}`}
                style={{ padding: "10px 16px", gap: stage.goalValue ? 10 : 0 }}
              >
                {/* Primary metric */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="block uppercase tracking-widest text-gray-400 font-semibold"
                    style={{ fontSize: 11, marginBottom: 2 }}
                  >
                    {stage.label}
                  </span>
                  <span
                    className="block font-black text-white tabular-nums"
                    style={{ fontSize: 20, lineHeight: 1.1, letterSpacing: "-0.02em" }}
                  >
                    {stage.value}
                  </span>
                </div>

                {/* % to Goal column — stacks below the primary metric on
                    narrow cards (not enough width to sit side by side
                    without the label overflowing), sits beside it once the
                    card is wide enough (ef-wide breakpoint). */}
                {stage.goalValue && (
                  <div className="ef-card-goal shrink-0 flex flex-col">
                    <span
                      className="block uppercase tracking-widest text-gray-400 font-semibold"
                      style={{ fontSize: 9, marginBottom: 2 }}
                    >
                      % to Goal
                    </span>
                    <span
                      className="block font-black text-white tabular-nums"
                      style={{ fontSize: 16, lineHeight: 1.1 }}
                    >
                      {stage.goalValue}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
