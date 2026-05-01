"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  title: string;
  url: string;
  icon: string; // single-char icon glyph
}

const navMain: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: "⌂" },
  { title: "Memory Feed", url: "/dashboard/feed", icon: "▤" },
  { title: "Graph", url: "/dashboard/graph", icon: "◎" },
  { title: "Insights", url: "/dashboard/insights", icon: "✦" },
  { title: "Evidence", url: "/dashboard/evidence", icon: "▧" },
  { title: "Agents", url: "/dashboard/agents", icon: "♙" },
  { title: "Projects", url: "/dashboard/projects", icon: "□" },
  { title: "Skills", url: "/dashboard/skills", icon: "⚡" },
  { title: "Settings", url: "/dashboard/settings", icon: "⚙" },
];

function AgencyLogo() {
  return (
    <Link
      href="/dashboard"
      prefetch={false}
      className="flex items-center gap-2.5 px-3 py-3"
    >
      <img
        src="/design/Wordmark.png"
        alt="Allura"
        className="h-7 w-auto object-contain"
        width={98}
        height={28}
      />
    </Link>
  );
}

function NavLink({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "group/menu-item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          "text-[var(--allura-gray-500)] hover:text-[var(--allura-charcoal)] hover:bg-[var(--allura-gray-100)]",
          isActive &&
            "bg-[var(--allura-gray-100)] text-[var(--allura-blue)] font-semibold"
        )}
      >
        <Link prefetch={false} href={item.url}>
          <span className="text-base leading-none w-5 text-center shrink-0">
            {item.icon}
          </span>
          <span>{item.title}</span>
          {isActive && (
            <div className="absolute inset-y-2 -left-0.5 w-[3px] rounded-full bg-[var(--allura-blue)]" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const path = usePathname();

  const isItemActive = (url: string) => {
    if (url === "/dashboard") {
      return path === url || (path.startsWith("/dashboard/") && path.split("/").length <= 3);
    }
    return path === url || path.startsWith(url + "/");
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-[var(--allura-gray-200)] bg-[var(--dashboard-surface)]/86 backdrop-blur-[16px]",
        className
      )}
      {...props}
    >
      <SidebarHeader className="px-0">
        <AgencyLogo />
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarMenu className="gap-0.5">
          {navMain.map((item) => (
            <NavLink
              key={item.url}
              item={item}
              isActive={isItemActive(item.url)}
            />
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--allura-gray-200)] px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--allura-blue)] text-white text-xs font-semibold shrink-0">
            U
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-[var(--allura-charcoal)] truncate">
              User
            </span>
            <span className="text-xs text-[var(--allura-gray-400)] truncate">
              admin@allura.ai
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
