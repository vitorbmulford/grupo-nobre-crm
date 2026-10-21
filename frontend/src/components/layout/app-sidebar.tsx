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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeSelector } from "@/components/layout/theme-selector";
import { useQuery } from "@tanstack/react-query";
import { openAlertCountQuery } from "@/lib/api/queries";

const links = [
  { href: "/opportunities", label: "Oportunidades", icon: BriefcaseBusiness },
  { href: "/pipeline", label: "Pipeline", icon: ChartNoAxesColumn },
  { href: "/alerts", label: "Alertas", icon: Bell },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const openAlertCount = useQuery(openAlertCountQuery);
  const alertCount = openAlertCount.data ?? 0;
  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r-0">
      <SidebarHeader className="shrink-0 px-4 pt-4 pb-4 group-data-[collapsible=icon]:px-2">
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
      <SidebarContent className="gap-1 pt-2">
        <SidebarSeparator className="mb-1 shrink-0" />
        <SidebarGroup className="gap-1 px-3">
          <SidebarGroupLabel className="h-7 px-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
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
                          aria-label={
                            href === "/alerts" && alertCount > 0
                              ? `${label}, ${alertCount} em aberto`
                              : label
                          }
                        >
                          <Icon />
                          <span>{label}</span>
                          {href === "/alerts" && alertCount > 0 && (
                            <span
                              aria-hidden="true"
                              className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#e1be68]/20 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-[#80651f] tabular-nums group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:size-2 group-data-[collapsible=icon]:min-w-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-transparent dark:bg-[#e1be68]/15 dark:text-[#e1be68]"
                            >
                              {alertCount > 99 ? "99+" : alertCount}
                            </span>
                          )}
                        </Link>
                      }
                      isActive={active}
                      tooltip={label}
                      className="data-active:text-foreground h-10 rounded-lg px-3 text-[14px] group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! data-active:bg-[#83b735]/10 data-active:font-semibold dark:data-active:bg-[#83b735]/15 [&[data-active=true]>svg]:text-[#6e9c2d] dark:[&[data-active=true]>svg]:text-[#a4d45c]"
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
        <SidebarSeparator className="mt-1" />
        <SidebarGroup className="gap-1 px-3 pt-2">
          <SidebarGroupLabel className="h-7 px-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
            Preferências
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <ThemeSelector />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 py-3 group-data-[collapsible=icon]:px-2">
        <div className="bg-muted/45 flex items-center gap-2 rounded-lg border px-3 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <span className="size-2 shrink-0 rounded-full bg-[#83b735] shadow-[0_0_0_3px_rgb(131_183_53_/_12%)]" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-muted-foreground text-[10px] leading-none font-medium tracking-[0.1em] uppercase">
              Ambiente
            </p>
            <p className="mt-1 truncate text-xs leading-none font-medium">
              Comercial
            </p>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
