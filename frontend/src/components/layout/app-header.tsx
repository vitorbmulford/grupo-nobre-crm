"use client";

import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, ChartNoAxesColumn, Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

const pageNames: Record<string, string> = {
  "/opportunities": "Oportunidades",
  "/pipeline": "Pipeline",
  "/alerts": "Alertas",
};
const pageIcons: Record<string, typeof Bell> = {
  "/opportunities": BriefcaseBusiness,
  "/pipeline": ChartNoAxesColumn,
  "/alerts": Bell,
};

export function AppHeader() {
  const pathname = usePathname();
  const title = pageNames[pathname] ?? "Grupo Nobre CRM";
  const Icon = pageIcons[pathname] ?? BriefcaseBusiness;
  return (
    <header className="bg-background/90 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-7">
      <SidebarTrigger className="md:hidden" aria-label="Abrir menu">
        <Menu className="size-4" />
      </SidebarTrigger>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="text-muted-foreground size-4 sm:hidden" />
        {title}
      </div>
      <div className="text-muted-foreground ml-auto text-xs">Nobre Brindes</div>
    </header>
  );
}
