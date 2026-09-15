"use client";

import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import EcosystemFunnel, { type FunnelData } from "@/components/EcosystemFunnel";
import ChannelPerformanceChart, { type Row as ChannelRow } from "@/components/ChannelPerformanceChart";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { useRegisterCsvExport } from "@/components/ExportContext";

function fmtMetric(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  return Math.round(val).toLocaleString();
}

export default function Home() {
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [channelRows, setChannelRows] = useState<ChannelRow[]>([]);

  // Combines the funnel KPIs and channel breakdown — the only two data
  // sources on this page — into one Metric/Value report, since neither is
  // its own row-based table to export on its own.
  useRegisterCsvExport(() => {
    const rows: [string, string][] = [
      ["Impressions", fmtMetric(funnelData?.impressions ?? null)],
      ["Engagements", fmtMetric(funnelData?.engagements ?? null)],
      ["Click-Through Rate (CTR)", fmtMetric(funnelData?.ctr ?? null)],
      ["Unique Engaged Users (UEU)", fmtMetric(funnelData?.engagedUsers ?? null)],
      ["Leads", fmtMetric(funnelData?.leads ?? null)],
      ...channelRows.map((r): [string, string] => [`${r[0]} (Engagements)`, fmtMetric(r[1])]),
    ];
    exportToCsv("ecosystem-insights", [{ display_name: "Metric" }, { display_name: "Value" }], rows);
  });

  return (
    <>
      <DashboardHeader />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <MultiSelectDropdown
          label="Channel"
          value={filterChannel}
          onChange={setFilterChannel}
          options={channelOptions}
        />
      </div>
      <div className="flex flex-col xl:flex-row gap-6 xl:items-start">
        {/* Each header travels with its own content so the label stays
            attached to the right chart once this stacks below xl. */}
        <div className="w-full xl:w-1/2 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 bg-gray-900 rounded-sm shrink-0" />
            <span className="text-sm font-bold tracking-widest uppercase text-gray-800">
              Program Metrics Summary
            </span>
          </div>
          <EcosystemFunnel onDataLoaded={setFunnelData} />
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
            onRowsLoaded={setChannelRows}
          />
        </div>
      </div>
    </>
  );
}
