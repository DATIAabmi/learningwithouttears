"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Globe,
  Users,
  UserCircle,
  TrendingUp,
  BookOpen,
  FileText,
  MonitorPlay,
  SlidersHorizontal,
  ScrollText,
  Sparkles,
  MapPin,
} from "lucide-react";

const navItems = [
  { label: "Ecosystem Insights", icon: Globe, href: "/" },
  { label: "Engaged Users by District", icon: Users, href: "/engaged-users" },
  { label: "School Board Minutes", icon: ScrollText, href: "/school-board-minutes" },
  { label: "Persona Insights", icon: UserCircle, href: "/persona-insights" },
  { label: "Geo Insights", icon: MapPin, href: "/geo-insights" },
  { label: "Leads Insights", icon: TrendingUp, href: "/leads-insights" },
  { label: "Topic Insights", icon: BookOpen, href: "/topic-insights" },
  { label: "Content Insights", icon: FileText, href: "/content-insights" },
  { label: "Ad Samples", icon: MonitorPlay, href: "/ad-samples" },
  { label: "AI Opportunity Feed", icon: Sparkles, href: "/ai-opportunity-feed" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const now = new Date();
    setLastUpdated(now.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
    }));
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 flex flex-col z-10">
      {/* Branding */}
      <div className="px-5 py-4 border-b border-gray-100">
        {lastUpdated && (
          <p className="text-[10px] text-blue-500 font-medium mb-3">
            Last Updated: {lastUpdated}
          </p>
        )}
        <Image
          src="/datia-k12-logo.png"
          alt="DATIA K12"
          width={180}
          height={40}
          priority
        />
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mt-2">
          Analytics Portal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon
                size={16}
                className={isActive ? "text-indigo-600" : "text-gray-400"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left">
          <SlidersHorizontal size={16} className="text-gray-400" />
          Filters
        </button>
      </div>
    </aside>
  );
}
