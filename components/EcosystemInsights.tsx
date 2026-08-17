"use client";

import { InteractiveDashboard } from "@metabase/embedding-sdk-react";

// Dashboard 69, tab 133 = Ecosystem Insights
export default function EcosystemInsights() {
  return (
    <div className="h-[calc(100vh-4rem)] -m-8">
      <InteractiveDashboard
        dashboardId={135}
        dashboardTabId={133}
        style={{ height: "100%" }}
      />
    </div>
  );
}
