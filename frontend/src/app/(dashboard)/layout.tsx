import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh">
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-7 sm:py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
