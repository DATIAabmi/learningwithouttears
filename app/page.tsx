"use client";

import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import EcosystemFunnel from "@/components/EcosystemFunnel";
import ChannelPerformanceChart from "@/components/ChannelPerformanceChart";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

export default function Home() {
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);

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
          <EcosystemFunnel />
        </div>
        <div className="w-full xl:w-1/2 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 bg-gray-900 rounded-sm shrink-0" />
            <span className="text-sm font-bold tracking-widest uppercase text-gray-800">
              Channel Performance By Engagements
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
