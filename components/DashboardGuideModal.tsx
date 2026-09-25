"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const DEFINITIONS = [
  { term: "Filtering",          def: "Use the filters at the top of the page to filter by Campaign, Date Range, District, Domain, or State." },
  { term: "Reset",              def: "To reset filters, click the Reset Filters button at the top right of the page." },
  { term: "Sorting",            def: "Sort the table by clicking any column header or using the Sort By menu at the top right of the page." },
  { term: "Export",             def: "Use Export All at the top of the page to export data from all dashboard views. Use Export within an individual dashboard view to export data from that view only." },
  { term: "Intel",              def: "Account Intelligence signals including School Board Minutes, RFPs/Bids, Grants/Bonds, Strategic Initiatives, Leadership Changes, and District News. See the Account Intelligence dashboard for details." },
  { term: "Topic",              def: "Reading Behavior signals indicating above-baseline content consumption on relevant topics. See the Topic Insights dashboard for details." },
  { term: "Engagements",        def: "Total engagement activity, including ad clicks, email opens, and asset downloads." },
  { term: "Engaged Users",      def: "Unique users who engaged with your content or campaign." },
  { term: "Leads",              def: "Unique content downloads by target personas." },
  { term: "Total Downloads",    def: "Total content assets downloaded by contacts." },
  { term: "Intent Score",       def: "A numerical score reflecting a district's overall level of buying activity based on Account Intelligence, Reading Behavior, and engagement signals." },
  { term: "Intent Score Trend", def: "Change in Intent Score compared with the prior campaign, indicating whether account activity has increased or decreased." },
];

export default function DashboardGuideModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <div
        role="dialog"
        aria-label="Dashboard Guide"
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 640, width: "calc(100% - 32px)", maxHeight: "88vh", overflowY: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Dashboard Guide</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#111", flexShrink: 0, width: 140, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
