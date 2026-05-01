import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Known build-tool limitation (DD-004):
 * Shadow values use hardcoded rgba(15,17,21,0.05) in cva template literals.
 * This matches tokens.shadow.sm exactly, but Tailwind cva requires literal strings —
 * dynamic token interpolation is not supported in template position.
 * tokens.ts defines: shadow.sm = "0 1px 2px 0 rgba(15, 17, 21, 0.05)"
 * If cva supports dynamic values in the future, replace shadow strings with tokens.
 */

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 shadow-[0_1px_2px_0_rgba(15,17,21,0.05)]",
        primary:
          `bg-[var(--allura-blue)] text-white hover:bg-[var(--allura-blue-hover)] focus-visible:ring-[var(--allura-blue)] shadow-[0_1px_2px_0_rgba(15,17,21,0.05)]`,
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_1px_2px_0_rgba(15,17,21,0.05)]",
        accent:
          `bg-[var(--allura-orange)] text-white hover:bg-[var(--allura-orange-hover)] focus-visible:ring-[var(--allura-orange)] shadow-[0_1px_2px_0_rgba(15,17,21,0.05)]`,
        ghost:
          `bg-transparent text-[var(--allura-blue)] border-[var(--allura-border-2)] hover:bg-[var(--allura-muted)] focus-visible:ring-[var(--allura-blue)]`,
        danger:
          `bg-white text-orange-700 border-[var(--allura-orange)] hover:bg-orange-50 focus-visible:ring-[var(--allura-orange)]`,
        outline:
          "border-border bg-background shadow-xs hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/40",
      },
      size: {
        default:
          "h-9 gap-1.5 rounded-md px-2.5 text-sm",
        xs: "h-6 gap-1 rounded-[4px] px-2 text-xs",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs",
        md: "h-10 gap-1.5 rounded-[8px] px-4 text-sm",
        lg: "h-12 gap-2 rounded-[8px] px-6 text-base",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[4px]",
        "icon-sm": "size-8 rounded-[min(var(--radius-md),10px)]",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "cursor-wait opacity-80"
      )}
      disabled={props.disabled || loading}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
