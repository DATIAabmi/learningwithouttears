"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FilterProvider } from "./FilterContext";
import { ExportProvider } from "./ExportContext";
import Sidebar from "./Sidebar";

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <FilterProvider>
      <ExportProvider>
        <Sidebar />
        <main className="ml-64 min-h-screen p-8">{children}</main>
      </ExportProvider>
    </FilterProvider>
  );
}
