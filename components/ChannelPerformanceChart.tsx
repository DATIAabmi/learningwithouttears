"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useFilter } from "./FilterContext";
import { channelColor } from "@/lib/channelColors";
import DonutBreakdown from "@/components/DonutBreakdown";

export type Row = [string, number, number];

function DonutChart({ rows }: { rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r[1], 0);
  const fmtNum = (n: number) => Math.round(n).toLocaleString();
  const segments = rows.map((row, i) => {
    const pct = total > 0 ? row[1] / total : 0;
    return {
      label: row[0],
      pct,
      color: channelColor(row[0], i),
      valueText: `${(pct * 100).toFixed(1)}%`,
      subText: `${fmtNum(row[1])} clicks`,
    };
  });

  return <DonutBreakdown segments={segments} centerLabel="Total Engagements" centerValue={fmtNum(total)} />;
}

interface Props {
  filterChannel?: string[];
  onChannelsLoaded?: (channels: string[]) => void;
  onRowsLoaded?: (rows: Row[]) => void;
}

export default function ChannelPerformanceChart({ filterChannel, onChannelsLoaded, onRowsLoaded }: Props) {
  const { campaign, dateStart, dateEnd } = useFilter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length) params.set("campaign", campaign.join(","));
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd) params.set("dateEnd", dateEnd);
    const qs = params.toString();
    fetch(`/api/q363-data${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        const loaded: Row[] = d.rows ?? [];
        setRows(loaded);
        setLoading(false);
        onChannelsLoaded?.(loaded.map((r) => r[0]));
        onRowsLoaded?.(loaded);
      })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleRows = filterChannel && filterChannel.length > 0
    ? rows.filter((r) => filterChannel.includes(r[0]))
    : rows;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>;
  }

  return <DonutChart rows={visibleRows} />;
}
