"use client";

import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import EcosystemFunnel from "@/components/EcosystemFunnel";
import ChannelPerformanceChart from "@/components/ChannelPerformanceChart";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { useFilter } from "@/components/FilterContext";
import { campaignGoals } from "@/lib/campaigns";

function fmtNum(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return Math.round(n).toLocaleString();
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Home() {
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);
  const { campaign, dateStart, dateEnd } = useFilter();

  async function handleEcosystemExport() {
    const params = new URLSearchParams();
    if (campaign.length) params.set("campaign", campaign.join(","));
    if (dateStart)       params.set("dateStart", dateStart);
    if (dateEnd)         params.set("dateEnd",   dateEnd);
    const qs = params.toString();

    const [funnelRes, channelRes] = await Promise.all([
      fetch(`/api/funnel-data${qs ? `?${qs}` : ""}`).then((r) => r.json()),
      fetch(`/api/q363-data${qs ? `?${qs}` : ""}`).then((r) => r.json()),
    ]);

    const goals = campaignGoals(campaign);
    const stages = [
      { label: "Impressions",          value: funnelRes.impressions,  goal: goals.impressions, hasGoal: true  },
      { label: "Engagements",          value: funnelRes.engagements,  goal: null,              hasGoal: false },
      { label: "Click-Through Rate",   value: funnelRes.ctr,          goal: null,              hasGoal: false },
      { label: "Unique Engaged Users", value: funnelRes.engagedUsers, goal: null,              hasGoal: false },
      { label: "Leads",                value: funnelRes.leads,        goal: goals.leads,       hasGoal: true  },
    ];

    const campaignLabel = campaign.length ? campaign.join(", ") : "All Campaigns";
    const dateLabel = dateStart && dateEnd ? `${dateStart} – ${dateEnd}` : "All Dates";

    const rows: (string | number | null)[][] = [
      ["Campaign", campaignLabel],
      ["Date Range", dateLabel],
      [],
      ["ECOSYSTEM FUNNEL"],
      ["Metric", "Value", "Goal", "% of Goal"],
      ...stages.map((s) => [
        s.label,
        fmtNum(s.value),
        s.hasGoal && s.goal ? fmtNum(s.goal) : "",
        s.hasGoal && s.goal ? (Math.round((Number(s.value) / s.goal) * 100) + "%") : "",
      ]),
      [],
      ["CHANNEL PERFORMANCE BY CLICKS"],
      ["Channel", "Clicks", "% of Total"],
      ...(channelRes.rows ?? []).map((r: [string, number, number]) => [
        r[0], fmtNum(r[1]), Math.round(r[2] * 100) + "%",
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`DATIA ABMxi-Ecosystem-Insights-${stamp}.csv`, rows);
  }

  return (
    <>
      <DashboardHeader onExport={handleEcosystemExport} />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <MultiSelectDropdown
          label="Channel"
          value={filterChannel}
          onChange={setFilterChannel}
          options={channelOptions}
        />
      </div>
      <div className="flex flex-col xl:flex-row gap-6 xl:items-start">
        <div className="w-full xl:w-1/2 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 bg-gray-900 rounded-sm shrink-0" />
            <span className="text-sm font-bold tracking-widest uppercase text-gray-800">
              Program Metrics Summary
            </span>
          </div>
          <EcosystemFunnel />
        </div>
        <div className="w-full xl:w-1/2 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 bg-gray-900 rounded-sm shrink-0" />
            <span className="text-sm font-bold tracking-widest uppercase text-gray-800">
              Engagements By Channel
            </span>
          </div>
          <ChannelPerformanceChart
            filterChannel={filterChannel}
            onChannelsLoaded={setChannelOptions}
          />
        </div>
      </div>
    </>
  );
}
