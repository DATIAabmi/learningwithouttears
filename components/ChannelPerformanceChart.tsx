"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useFilter } from "./FilterContext";

const COLORS = ["#509EE3", "#88BF4D", "#EF8C8C", "#F9D45C", "#A989C5", "#98D9D9"];

type Row = [string, number, number];

function DonutChart({ rows }: { rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r[1], 0);
  const R = 78;
  const SW = 38;
  const CX = 105;
  const CY = 105;
  const circumference = 2 * Math.PI * R;

  let cumulative = 0;
  const segments = rows.map((row, i) => {
    const pct = total > 0 ? row[1] / total : 0;
    const offset = -(cumulative * circumference) + circumference * 0.25;
    cumulative += pct;
    return { label: row[0], clicks: row[1], pct, offset, color: COLORS[i % COLORS.length] };
  });

  const fmtNum = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="flex items-center gap-8 w-full">
      {/* Donut */}
      <div className="shrink-0">
        <svg viewBox="0 0 210 210" width={210} height={210}>
          {/* Track */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={SW} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={SW}
              strokeDasharray={`${seg.pct * circumference} ${circumference}`}
              strokeDashoffset={seg.offset}
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          ))}
          {/* Center label */}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize={10} fill="#6b7280" fontFamily="inherit">Total Clicks</text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize={15} fontWeight="700" fill="#111827" fontFamily="inherit">
            {fmtNum(total)}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-800 truncate">{seg.label}</span>
                <span className="text-sm tabular-nums text-gray-500 shrink-0">{fmtNum(seg.clicks)}</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }} />
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{(seg.pct * 100).toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  filterChannel?: string[];
  onChannelsLoaded?: (channels: string[]) => void;
}

export default function ChannelPerformanceChart({ filterChannel, onChannelsLoaded }: Props) {
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
