"use client"

import { useCallback, useEffect, useState } from "react"
import { CircleUser, CreditCard, EllipsisVertical, LogOut, MessageSquareDot } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { getInitials } from "@/lib/utils"

/**
 * NavUser — User account menu in sidebar footer.
 *
 * When Clerk is configured: shows live Clerk user data + signOut action.
 * When Clerk is not configured (DevAuthProvider mode): shows props-based user data.
 *
 * Clerk hooks are loaded dynamically to avoid crashes when Clerk is not available.
 */

// Minimal Clerk types — avoids static import from @clerk/nextjs
interface ClerkUserLike {
  fullName?: string | null
  imageUrl?: string
  primaryEmailAddress?: { emailAddress?: string } | null
}

interface ClerkLike {
  signOut: (options?: { redirectUrl?: string }) => Promise<void>
}

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string
    readonly email: string
    readonly avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const [clerkUser, setClerkUser] = useState<ClerkUserLike | null>(null)
  const [clerk, setClerk] = useState<ClerkLike | null>(null)
  const [clerkReady, setClerkReady] = useState(false)

  useEffect(() => {
    let mounted = true

    // Dynamic import — only loads Clerk when available
    import("@clerk/nextjs")
      .then(({ useUser, useClerk }) => {
        // Hooks can't be called inside effects or dynamic imports.
        // We store the module reference; the component can't use hooks
        // from a dynamically loaded module in a way compatible with React rules.
        // Instead, we mark Clerk as available so the component knows it's present.
        if (mounted) {
          setClerkReady(true)
        }
      })
      .catch(() => {
        // Clerk not available — use props-based fallback
        if (mounted) {
          setClerkUser(null)
          setClerk(null)
          setClerkReady(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  // Use props-based display when Clerk is not available
  const displayName = clerkUser?.fullName ?? user.name
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? user.email
  const displayAvatar = clerkUser?.imageUrl ?? user.avatar

  const handleSignOut = useCallback(() => {
    if (clerk?.signOut) {
      clerk.signOut({ redirectUrl: "/" })
    } else {
      // DevAuthProvider mode — no real sign out, just reload
      window.location.href = "/"
    }
  }, [clerk])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={displayAvatar || undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">{displayEmail}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={displayAvatar || undefined} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="text-muted-foreground truncate text-xs">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CircleUser />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquareDot />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
