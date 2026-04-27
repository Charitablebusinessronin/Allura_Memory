"use client"

import { cn } from "@/lib/utils"

interface NotificationBadgeProps {
  variant: "dot" | "count"
  count?: number
  max?: number
  pulse?: boolean
  className?: string
}

export function NotificationBadge({
  variant,
  count = 0,
  max = 99,
  pulse = true,
  className,
}: NotificationBadgeProps) {
  if (variant === "dot") {
    return (
      <span
        className={cn(
          "absolute -right-1 -top-1 block h-2 w-2 rounded-full bg-[#FF5A2E]",
          pulse && "animate-ping",
          className
        )}
      />
    )
  }

  const display = count > max ? `${max}+` : String(count)

  return (
    <span
      className={cn(
        "inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF5A2E] px-1 text-[10px] font-bold leading-none text-white",
        className
      )}
    >
      {display}
    </span>
  )
}
