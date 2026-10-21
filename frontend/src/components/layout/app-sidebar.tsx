"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesColumn,
  Flower2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeSelector } from "@/components/layout/theme-selector";

const links = [
  { href: "/opportunities", label: "Oportunidades", icon: BriefcaseBusiness },
  { href: "/pipeline", label: "Pipeline", icon: ChartNoAxesColumn },
  { href: "/alerts", label: "Alertas", icon: Bell },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r-0">
      <SidebarHeader className="px-4 pt-5 pb-5 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-3">
          <Link
            href="/opportunities"
            className="focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 focus-visible:ring-2"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#83b735]/20 bg-[#83b735]/10 text-[#83b735] group-data-[collapsible=icon]:size-8">
              <Flower2 className="size-5" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block text-sm leading-tight font-semibold">
                Grupo Nobre
              </span>
              <span className="text-muted-foreground text-xs">
                CRM Comercial
              </span>
            </span>
          </Link>
          <SidebarTrigger
            className="shrink-0"
            aria-label={
              state === "expanded" ? "Recolher menu" : "Expandir menu"
            }
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      }
                      isActive={active}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-2 py-3">
        <ThemeSelector />
        <p className="text-muted-foreground px-2 text-xs group-data-[collapsible=icon]:hidden">
          Ambiente comercial
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
