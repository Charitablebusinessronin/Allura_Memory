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
import { sidebarItems, type NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { ThemeSwitcher } from "./theme-switcher";

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
        <img
          src="/design/mark-icon-128.png"
          alt="Allura mark"
          className="h-8 w-8 rounded-md object-contain"
          width={32}
          height={32}
        />
      ) : (
        <img
          src="/design/mark-logo.png"
          alt="Allura"
          className="h-9 w-auto object-contain"
          width={120}
          height={36}
        />
      )}
    </Link>
  );
}

function NavLink({ item, isActive }: { item: NavMainItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "group/menu-item relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          "text-[var(--dashboard-text-secondary)] hover:bg-[color-mix(in_srgb,var(--allura-blue)_8%,white)] hover:text-[var(--allura-charcoal)] focus-visible:ring-2 focus-visible:ring-[var(--allura-blue)]",
          isActive && "bg-[color-mix(in_srgb,var(--allura-blue)_10%,white)] text-[var(--allura-blue)] font-semibold"
        )}
      >
        <Link prefetch={false} href={item.url} aria-current={isActive ? "page" : undefined}>
          {Icon && <Icon className="size-5 shrink-0" />}
          <span>{item.title}</span>
          {item.isNew && (
            <span className="ml-auto rounded-full bg-[var(--allura-orange)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              New
            </span>
          )}
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
        {sidebarItems.map((group) => (
          <div key={group.id} className="mb-2">
            {group.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                {group.label}
              </p>
            )}
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.url}
                  item={item}
                  isActive={isItemActive(item.url)}
                />
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--allura-gray-200)] px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--allura-blue)] text-xs font-semibold text-white">
              U
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-[var(--allura-charcoal)]">
                User
              </span>
              <span className="truncate text-xs text-[var(--allura-gray-400-text)]">
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
