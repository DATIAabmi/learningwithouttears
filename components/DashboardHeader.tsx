"use client";

import Image from "next/image";
import { CalendarSearch, X, RotateCcw, LogOut, FileSpreadsheet, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFilter } from "@/components/FilterContext";
import { CAMPAIGNS, campaignDateRange } from "@/lib/campaigns";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

export default function DashboardHeader({ legend }: { legend?: string }) {
  const { campaign, setCampaign, dateStart, dateEnd, setDateStart, setDateEnd, resetAll } = useFilter();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (campaign.length) params.set("campaign", campaign.join(","));
      if (dateStart) params.set("dateStart", dateStart);
      if (dateEnd)   params.set("dateEnd",   dateEnd);
      const res  = await fetch(`/api/export-excel?${params.toString()}`);
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? "datia-export.xlsx";
      const a    = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: name,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  const subtitle =
    campaign.length === 0
      ? "All Campaigns"
      : campaign.length === 1
      ? campaignDateRange(campaign[0])
      : `${campaign.length} Campaigns Selected`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-3 mb-4">
      <div className="relative flex items-center">
        {/* Left: Learning Without Tears logo */}
        <div className="flex-shrink-0 flex items-center gap-4">
          <Image
            src="/learning-without-tears-logo.png"
            alt="Learning Without Tears"
            width={252}
            height={148}
            style={{ height: "67px", width: "auto" }}
            className="object-contain"
          />
          {/* Vertical divider */}
          <div className="self-stretch w-px bg-gray-200 shrink-0" />
        </div>

        {/* Center: absolutely centered in the full card */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <h1
            className="font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Lato', sans-serif", fontSize: "30px", letterSpacing: "-0.5px" }}
          >
            ABMi Always On
          </h1>
          <p className="mt-1 font-medium" style={{ fontSize: "12px", color: "#6b8cba" }}>
            {subtitle}
          </p>
          <div className="h-0.5 bg-red-500 mt-1.5 rounded-full" style={{ width: 44 }} />
        </div>
      </div>

      {/* Global filters — Campaign + Date Range */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        <MultiSelectDropdown
          label="ABMi Campaign"
          value={campaign}
          onChange={setCampaign}
          options={[...CAMPAIGNS]}
          minWidth={220}
        />
        <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
          <CalendarSearch size={14} className="text-orange-400 shrink-0" />
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">Date Range:</span>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
            className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
          <span className="text-gray-300 text-xs">–</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
            className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
          {(dateStart || dateEnd) && (
            <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="text-gray-300 hover:text-gray-500 ml-0.5">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg bg-white transition-colors shrink-0 ml-auto"
          title="Reset all filters to default"
        >
          <RotateCcw size={13} />
          Reset Filters
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-emerald-700 hover:text-emerald-900 border border-emerald-300 hover:border-emerald-500 rounded-lg bg-white transition-colors shrink-0 disabled:opacity-60 disabled:cursor-wait"
          title="Export all table data to Excel"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-lg bg-white transition-colors shrink-0"
          title="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {legend && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-0.5" style={{ fontFamily: "'Lato', sans-serif" }}>
          {legend.split(" | ").map((line, i) => (
            <p key={i} className="text-xs text-gray-400 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
