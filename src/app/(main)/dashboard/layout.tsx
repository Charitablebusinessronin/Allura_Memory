import type { ReactNode } from "react"

import { cookies } from "next/headers"

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar variant="sidebar" collapsible="icon" />
      <SidebarInset
        className={cn(
          "relative flex w-full flex-1 flex-col bg-[var(--dashboard-surface-alt)]",
          "[html[data-content-layout=centered]_&]:mx-auto! [html[data-content-layout=centered]_&]:max-w-screen-2xl!"
        )}
      >
        <div className="sticky top-0 z-20 flex h-14 items-center border-b border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur md:hidden">
          <SidebarTrigger aria-label="Open navigation" className="min-h-11 min-w-11" />
          <span className="ml-2 text-sm font-semibold text-[var(--dashboard-text-primary)]">Allura Memory</span>
        </div>
        {/* Page Content */}
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
