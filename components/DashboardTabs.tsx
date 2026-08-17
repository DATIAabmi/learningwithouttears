"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Ecosystem Insights", href: "/" },
  { label: "Engaged Users by District", href: "/engaged-users" },
  { label: "Persona Insights", href: "/persona-insights" },
  { label: "Leads Insights", href: "/leads-insights" },
  { label: "Topic Insights", href: "/topic-insights" },
  { label: "Content Insights", href: "/content-insights" },
  { label: "Ad Samples", href: "/ad-samples" },
];

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-gray-200 mb-6 -mx-8 px-8 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
              isActive
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
