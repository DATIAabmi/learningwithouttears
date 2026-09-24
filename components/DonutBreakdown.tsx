"use client";

export interface DonutSegment {
  label: string;
  /** Share of the ring (0–1). */
  pct: number;
  color: string;
  /** Bold text in the middle column, e.g. "38.5%". */
  valueText: string;
  /** Gray text above the bar, e.g. "1,489 clicks". */
  subText?: string;
}

interface Props {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
  /** Label of the highlighted segment, if the chart is used as a filter. */
  selected?: string | null;
  onSelect?: (label: string) => void;
}

const R = 84;
const SW = 44;
const C = 110;

export default function DonutBreakdown({ segments, centerLabel, centerValue, selected = null, onSelect }: Props) {
  const circumference = 2 * Math.PI * R;
  const interactive = !!onSelect;
  const active = selected ? segments.find((s) => s.label === selected) ?? null : null;

  let cum = 0;
  const arcs = segments.map((seg) => {
    const start = cum * circumference;
    cum += seg.pct;
    return { seg, start };
  });

  return (
    <div className="flex items-center gap-10 w-full">
      <div className="shrink-0">
        <svg viewBox="0 0 220 220" width={220} height={220}>
          <circle cx={C} cy={C} r={R} fill="none" stroke="#f3f4f6" strokeWidth={SW} />
          <g transform={`rotate(-90 ${C} ${C})`}>
            {arcs.map(({ seg, start }) => {
              const dimmed = selected !== null && selected !== seg.label;
              return (
                <circle
                  key={seg.label}
                  cx={C} cy={C} r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={SW}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(seg.pct * circumference - 1.5, 0)} ${circumference}`}
                  strokeDashoffset={-(start + 0.75)}
                  opacity={dimmed ? 0.25 : 1}
                  style={{ cursor: interactive ? "pointer" : "default", transition: "opacity 0.15s" }}
                  onClick={interactive ? () => onSelect(seg.label) : undefined}
                />
              );
            })}
          </g>
          {active ? (
            <>
              <text x={C} y={C - 10} textAnchor="middle" fontSize={13} fill="#6b7280" fontFamily="inherit">{active.label}</text>
              <text x={C} y={C + 12} textAnchor="middle" fontSize={22} fontWeight="700" fill="#111827" fontFamily="inherit">{active.valueText}</text>
            </>
          ) : (
            <>
              <text x={C} y={C - 10} textAnchor="middle" fontSize={13} fill="#6b7280" fontFamily="inherit">{centerLabel}</text>
              <text x={C} y={C + 14} textAnchor="middle" fontSize={24} fontWeight="700" fill="#111827" fontFamily="inherit">{centerValue}</text>
            </>
          )}
        </svg>
      </div>

      <div className="flex flex-col justify-around gap-5 flex-1 min-w-0">
        {segments.map((seg) => {
          const dimmed = selected !== null && selected !== seg.label;
          const isActive = selected === seg.label;
          return (
            <div
              key={seg.label}
              className={`flex items-center gap-4 -mx-2 px-2 py-1 rounded-lg transition-colors ${interactive ? "cursor-pointer" : ""}`}
              style={{ backgroundColor: isActive ? "#f3f4f6" : "transparent", opacity: dimmed ? 0.5 : 1 }}
              onClick={interactive ? () => onSelect(seg.label) : undefined}
            >
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-[15px] font-medium text-gray-800 shrink-0 truncate" style={{ width: 96 }}>{seg.label}</span>
              <span className="w-px h-9 bg-gray-200 shrink-0" />
              <span className="text-[15px] font-bold text-gray-900 tabular-nums shrink-0" style={{ width: 64 }}>{seg.valueText}</span>
              <span className="w-px h-9 bg-gray-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-500 tabular-nums mb-1.5 h-5 truncate">{seg.subText ?? ""}</div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
