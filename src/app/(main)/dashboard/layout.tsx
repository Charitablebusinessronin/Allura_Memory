import type { ReactNode } from "react"

import { cookies } from "next/headers"
import Link from "next/link"

import { Bell, Github, PanelLeft, Search } from "lucide-react"

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
        {/* Top Bar */}
        <header
          className={cn(
            "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[var(--dashboard-border)] bg-white/80 backdrop-blur-md px-5"
          )}
        >
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text-primary)]" />
            <div className="hidden h-5 w-px bg-[var(--dashboard-border)] md:block" />
            <div className="agency-search hidden md:flex">
              <Search className="size-[18px] text-[var(--dashboard-text-muted)]" />
              <input type="text" placeholder="Search memories, insights, agents, projects…" />
              <span className="kbd">⌘K</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-lg p-2 text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text-primary)] hover:bg-[var(--dashboard-surface-muted)] transition-colors">
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--allura-orange)] ring-2 ring-white" />
            </button>
            <Button asChild size="icon" variant="ghost" className="text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text-primary)]">
              <Link
                prefetch={false}
                href="https://github.com/Charitablebusinessronin/Allura_Memory"
                target="_blank"
                rel="noreferrer"
                aria-label="Open GitHub repository"
              >
                <Github className="size-5" />
              </Link>
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--allura-blue)] text-white text-xs font-semibold">
              U
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-5 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
