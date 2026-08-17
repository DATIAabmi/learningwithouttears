"use client";

import { StaticQuestion } from "@metabase/embedding-sdk-react";

interface Metric {
  label: string;
  description: string;
  goal?: string;
  cardId: number;
  goalCardId?: number;
}

const METRICS: Metric[] = [
  {
    label: "Impressions",
    description: "Number of times your content or ads were displayed on social, offsite display",
    goal: "Impression Goal: 300,000",
    cardId: 623,
    goalCardId: 624,
  },
  {
    label: "Engagements",
    description: "Number of clicks on your ads or opened emails",
    cardId: 625,
  },
  {
    label: "Click Thru Rate",
    description: "The percentage of people that click on a link or ad out of all the times they saw that ad",
    cardId: 626,
  },
  {
    label: "Engaged Users",
    description: "Unique users who viewed your content from all sources",
    cardId: 627,
  },
  {
    label: "Downloads",
    description: "Goal: 300 Leads",
    goal: "Goal: 300 Leads",
    cardId: 628,
    goalCardId: 629,
  },
];

const STEP = 52;
const CARD_W = 340;

function MetricValue({ cardId }: { cardId: number }) {
  return (
    <div className="sdk-scalar">
      <StaticQuestion questionId={cardId} showVisualization title={false} height={88} />
    </div>
  );
}

export default function ProgramMetricsSummary() {
  return (
    <div className="w-full max-w-5xl mx-auto py-10 px-6">
      <style>{`
        .sdk-scalar > div {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .sdk-scalar header,
        .sdk-scalar [data-testid="legend-caption"] {
          display: none !important;
        }
        /* White numbers inside dark cards */
        .dark-card .sdk-scalar [class*="scalar"],
        .dark-card .sdk-scalar [class*="Scalar"],
        .dark-card .sdk-scalar span,
        .dark-card .sdk-scalar h1,
        .dark-card .sdk-scalar h2,
        .dark-card .sdk-scalar p,
        .dark-card .sdk-scalar div {
          color: white !important;
        }
      `}</style>

      {/* Funnel rows */}
      <div className="flex flex-col gap-3">
        {METRICS.map((metric, i) => {
          const indent = i * STEP;

          return (
            <div key={metric.label} className="flex items-stretch" style={{ minHeight: 120 }}>

              {/* Staircase indent */}
              <div style={{ width: indent, flexShrink: 0 }} />

              {/* Gray chevron panel */}
              <div
                className="flex flex-col justify-center pl-8 pr-12 bg-gray-200"
                style={{
                  flex: 1,
                  clipPath: "polygon(0 0, 100% 0, calc(100% - 32px) 100%, 0 100%)",
                  minWidth: 0,
                }}
              >
                <h2 className="text-2xl font-black text-gray-800 leading-tight">
                  {metric.label}
                </h2>
                <p className="text-sm text-gray-500 mt-1 leading-snug max-w-xs">
                  {metric.description}
                </p>
                {metric.goal && (
                  <p className="text-xs font-semibold text-green-600 mt-1">
                    {metric.goal}
                  </p>
                )}
              </div>

              {/* Dark metric card */}
              <div
                className="dark-card bg-gray-950 text-white flex items-center px-7 gap-8 shrink-0"
                style={{ width: CARD_W }}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs uppercase tracking-widest text-gray-400 mb-1 font-semibold">
                    {metric.label}
                  </span>
                  <MetricValue cardId={metric.cardId} />
                </div>

                {metric.goalCardId && (
                  <div className="flex flex-col items-end shrink-0 border-l border-gray-700 pl-8">
                    <span className="text-xs uppercase tracking-widest text-gray-400 mb-1 font-semibold">
                      % to Goal
                    </span>
                    <MetricValue cardId={metric.goalCardId} />
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
