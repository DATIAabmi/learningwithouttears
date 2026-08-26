"use client";

import { InteractiveDashboard } from "@metabase/embedding-sdk-react";

// Dashboard 135, tab 227 = Ecosystem Insights
export default function EcosystemInsights() {
  return (
    <div className="h-[calc(100vh-4rem)] -m-8">
      <InteractiveDashboard
        dashboardId={135}
        dashboardTabId={227}
        style={{ height: "100%" }}
      />
    </div>
  );
}
