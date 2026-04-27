"use client"

import * as React from "react"

import { cn, getInitials } from "@/lib/utils"
import { tokens } from "@/lib/tokens"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/* ─── shadcn/ui compatible Avatar ─── */

const Avatar = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  React.ElementRef<"img">,
  React.ComponentPropsWithoutRef<"img">
>(({ className, ...props }, ref) => (
  <img
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      `flex h-full w-full items-center justify-center rounded-full bg-[${tokens.color.primary.default}] font-medium text-white`,
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }

/* ─── Dashboard-specific Avatar utilities ─── */

interface DashboardAvatarProps {
  src?: string
  alt: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  status?: "online" | "offline" | "away" | "busy"
  fallback?: string
  className?: string
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
}

const statusColorMap = {
  online: `bg-[${tokens.color.success.default}]`,
  offline: `bg-[${tokens.color.text.muted}]`,
  away: `bg-[${tokens.color.accent.gold}]`,
  busy: `bg-[${tokens.color.secondary.default}]`,
}

/** Deterministic color based on name hash */
function getNameColor(name: string): string {
  const colors = [
    tokens.color.primary.default,
    tokens.color.secondary.default,
    tokens.color.success.default,
    tokens.color.accent.gold,
    tokens.color.graph.event,
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function UserAvatar({ src, alt, size = "md", status, fallback, className }: DashboardAvatarProps) {
  const initials = fallback ?? getInitials(alt)
  const fallbackColor = getNameColor(alt)
  return (
    <div className={cn("relative inline-block", className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            "inline-block rounded-full object-cover ring-2 ring-white",
            sizeMap[size]
          )}
        />
      ) : (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white",
            sizeMap[size]
          )}
          style={{ backgroundColor: fallbackColor }}
          aria-label={alt}
        >
          {initials}
        </span>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white",
            statusColorMap[status]
          )}
        />
      )}
    </div>
  )
}

interface AvatarGroupProps {
  avatars: DashboardAvatarProps[]
  max?: number
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

export function AvatarGroup({ avatars, max = 3, size = "md", className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max)
  const overflow = avatars.length - max
  const names = avatars.map((a) => a.alt)

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", className)}>
            {visible.map((avatar, i) => (
              <div key={i} className={cn("relative", i > 0 && "-ml-2")} style={{ zIndex: i + 1 }}>
                <UserAvatar {...avatar} size={size} className="ring-2 ring-white" />
              </div>
            ))}
            {overflow > 0 && (
              <div
                className={cn(
                  `relative -ml-2 inline-flex items-center justify-center rounded-full bg-[${tokens.color.surface.muted}] font-medium text-[${tokens.color.text.secondary}] ring-2 ring-white`,
                  sizeMap[size]
                )}
                style={{ zIndex: max + 1 }}
              >
                +{overflow}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {names.join(", ")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
