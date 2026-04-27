"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brain, FileText, Folder, GitBranch, Home, Lightbulb, Search, Settings, Users } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navMain: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: Home },
  { title: "Memory Feed", url: "/dashboard/feed", icon: Brain },
  { title: "Graph", url: "/dashboard/graph", icon: GitBranch },
  { title: "Insights", url: "/dashboard/insights", icon: Lightbulb },
  { title: "Evidence", url: "/dashboard/evidence", icon: FileText },
  { title: "Agents", url: "/dashboard/agents", icon: Users },
  { title: "Projects", url: "/dashboard/projects", icon: Folder },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

function AgencyLogo() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--allura-cream)] text-[var(--allura-charcoal)]">
        <img
          src="/design/allura-monogram.png"
          alt="Allura"
          className="h-6 w-6 object-contain"
          width="36"
          height="36"
        />
      </div>
      <span className="text-base font-semibold tracking-tight" style={{ fontFamily: 'var(--font-family-brand)' }}>
        allura
      </span>
    </div>
  );
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "group/menu-item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          "text-[var(--dashboard-text-secondary)] hover:text-[var(--dashboard-text-primary)] hover:bg-[var(--dashboard-surface-muted)]",
          isActive && "bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text-primary)] font-semibold"
        )}
      >
        <Link prefetch={false} href={item.url}>
          <item.icon className={cn("size-[18px] shrink-0", isActive ? "text-[var(--allura-blue)]" : "text-[var(--dashboard-text-muted)]")} />
          <span>{item.title}</span>
          {item.badge && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--tone-orange-bg)] px-1.5 text-[10px] font-semibold text-[var(--tone-orange-text)]">
              {item.badge}
            </span>
          )}
          {isActive && (
            <div className="absolute inset-y-2 -left-0.5 w-0.5 rounded-full bg-[var(--allura-blue)]" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  const path = usePathname();

  const isItemActive = (url: string) => {
    if (url === "/dashboard") {
      return path === url || path.startsWith("/dashboard/");
    }
    return path === url;
  };

  return (
    <Sidebar className={cn("border-r border-[var(--dashboard-border)] bg-white", className)} {...props}>
      <SidebarHeader className="px-0">
        <AgencyLogo />
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarMenu className="gap-0.5">
          {navMain.map((item) => (
            <NavLink key={item.url} item={item} isActive={isItemActive(item.url)} />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--dashboard-border)] px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--allura-blue)] text-white text-xs font-semibold">
            U
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--dashboard-text-primary)]">User</span>
            <span className="text-xs text-[var(--dashboard-text-muted)]">admin@allura.ai</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
