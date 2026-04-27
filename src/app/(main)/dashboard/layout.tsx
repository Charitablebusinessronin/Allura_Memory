import type { ReactNode } from "react"

import { cookies } from "next/headers"

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
        {/* Page Content */}
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
