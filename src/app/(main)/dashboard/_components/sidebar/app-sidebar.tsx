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
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "./theme-switcher";

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
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Link
      href="/dashboard"
      prefetch={false}
      className="flex min-h-12 items-center gap-2.5 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--allura-blue)]"
      aria-label="Go to dashboard overview"
      data-testid="allura-logo"
    >
      {isCollapsed ? (
        /* Collapsed: Show the Allura mark icon */
        <img
          src="/design/mark-icon-128.png"
          alt="Allura mark"
          className="h-8 w-8 object-contain rounded-md"
          width={32}
          height={32}
        />
      ) : (
        /* Expanded: Show the full Allura wordmark */
        <img
          src="/design/Wordmark.png"
          alt="Allura"
          className="h-9 w-auto object-contain"
          width={120}
          height={36}
        />
      )}
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
          "group/menu-item relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          "text-[var(--dashboard-text-secondary)] hover:bg-[color-mix(in_srgb,var(--allura-blue)_8%,white)] hover:text-[var(--allura-charcoal)] focus-visible:ring-2 focus-visible:ring-[var(--allura-blue)]",
          isActive &&
            "bg-[color-mix(in_srgb,var(--allura-blue)_10%,white)] text-[var(--allura-blue)] font-semibold"
        )}
      >
        <Link prefetch={false} href={item.url} aria-current={isActive ? "page" : undefined}>
          <span className="text-base leading-none w-5 text-center shrink-0">
            {item.icon}
          </span>
          <span>{item.title}</span>
          {isActive && (
            <div className="absolute inset-y-2 -left-0.5 w-[3px] rounded-full bg-[var(--allura-orange)]" />
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
    if (url === "/dashboard") return path === url;
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

      <SidebarContent className="px-3 py-2" role="navigation" aria-label="Dashboard navigation">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--allura-blue)] text-white text-xs font-semibold shrink-0">
              U
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-[var(--allura-charcoal)] truncate">
                User
              </span>
              <span className="text-xs text-[var(--allura-gray-400-text)] truncate">
                admin@allura.ai
              </span>
            </div>
          </div>
          <ThemeSwitcher />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
