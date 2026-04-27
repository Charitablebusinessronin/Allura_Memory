"use client"

import * as React from "react"

import { cn, getInitials } from "@/lib/utils"

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
      "flex h-full w-full items-center justify-center rounded-full bg-[#1D4ED8] font-medium text-white",
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
  online: "bg-[#157A4A]",
  offline: "bg-[#9CA3AF]",
  away: "bg-[#C89B3C]",
  busy: "bg-[#FF5A2E]",
}

export function UserAvatar({ src, alt, size = "md", status, fallback, className }: DashboardAvatarProps) {
  const initials = fallback ?? getInitials(alt)
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
            "inline-flex items-center justify-center rounded-full bg-[#1D4ED8] font-semibold text-white ring-2 ring-white",
            sizeMap[size]
          )}
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

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((avatar, i) => (
        <div key={i} className={cn("relative", i > 0 && "-ml-2")} style={{ zIndex: i + 1 }}>
          <UserAvatar {...avatar} size={size} className="ring-2 ring-white" />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "relative -ml-2 inline-flex items-center justify-center rounded-full bg-[#F3F4F6] font-medium text-[#6B7280] ring-2 ring-white",
            sizeMap[size]
          )}
          style={{ zIndex: max + 1 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
