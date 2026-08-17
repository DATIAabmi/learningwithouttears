"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "District of Columbia": "DC", "Puerto Rico": "PR",
};

function interpolateBlue(t: number): string {
  // white (low) -> #1e3a8a-ish deep blue (high)
  const clamped = Math.max(0, Math.min(1, t));
  const from = { r: 238, g: 242, b: 251 };
  const to = { r: 30, g: 58, b: 138 };
  const r = Math.round(from.r + (to.r - from.r) * clamped);
  const g = Math.round(from.g + (to.g - from.g) * clamped);
  const b = Math.round(from.b + (to.b - from.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function UsStateChoropleth({
  valueByState,
  selectedState,
  onStateClick,
}: {
  valueByState: Record<string, number>;
  selectedState?: string;
  onStateClick?: (abbr: string) => void;
}) {
  const max = Math.max(1, ...Object.values(valueByState));

  return (
    <div className="w-full">
      <ComposableMap projection="geoAlbersUsa" style={{ width: "100%", height: "auto" }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const abbr = STATE_NAME_TO_ABBR[geo.properties.name as string];
              const value = abbr ? valueByState[abbr] ?? 0 : 0;
              const isSelected = abbr && abbr === selectedState;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isSelected ? "#f97316" : interpolateBlue(value / max)}
                  stroke={isSelected ? "#c2410c" : "#ffffff"}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  onClick={() => abbr && onStateClick?.(abbr)}
                  style={{
                    default: { outline: "none", cursor: onStateClick ? "pointer" : "default" },
                    hover: { outline: "none", opacity: 0.8 },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>0</span>
        <div className="h-2.5 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${interpolateBlue(0)}, ${interpolateBlue(1)})` }} />
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}
