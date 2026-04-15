import type { ReactNode } from "react"

import type { Metadata } from "next"

import { cookies } from "next/headers"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { APP_CONFIG } from "@/config/app-config"
import { fontVars } from "@/lib/fonts/registry"
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config"
import { CONTENT_LAYOUT_VALUES, NAVBAR_STYLE_VALUES } from "@/lib/preferences/layout"
import { THEME_MODE_VALUES, THEME_PRESET_VALUES } from "@/lib/preferences/theme"
import { isClerkEnabled } from "@/lib/auth/config"
import { ThemeBootScript } from "@/scripts/theme-boot"
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider"
import { getPreference } from "@/server/server-actions"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.meta.title,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.meta.description,
}

function getSafe<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return raw && allowed.includes(raw as T) ? (raw as T) : fallback
}

/**
 * Conditionally wraps children in ClerkProvider.
 *
 * CRITICAL: ClerkProvider is imported dynamically to avoid import-time crashes
 * when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set (e.g., Docker dev mode).
 * When Clerk is disabled, children render directly without Clerk context.
 */
async function ConditionalClerkProvider({ children }: { children: ReactNode }) {
  if (!isClerkEnabled()) {
    return <>{children}</>
  }

  try {
    const { ClerkProvider } = await import("@clerk/nextjs")
    return <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider>
  } catch (err) {
    console.warn("[layout] ClerkProvider dynamic import failed, rendering without Clerk:", err)
    return <>{children}</>
  }
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies()
  const get = (key: string) => cookieStore.get(key)?.value

  const theme_mode = getSafe(get("theme_mode"), THEME_MODE_VALUES, PREFERENCE_DEFAULTS.theme_mode)
  const theme_preset = getSafe(get("theme_preset"), THEME_PRESET_VALUES, PREFERENCE_DEFAULTS.theme_preset)
  const content_layout = getSafe(get("content_layout"), CONTENT_LAYOUT_VALUES, PREFERENCE_DEFAULTS.content_layout)
  const navbar_style = getSafe(get("navbar_style"), NAVBAR_STYLE_VALUES, PREFERENCE_DEFAULTS.navbar_style)
  const font = (get("font") ?? PREFERENCE_DEFAULTS.font) as typeof PREFERENCE_DEFAULTS.font

  return (
    <html
      lang="en"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={PREFERENCE_DEFAULTS.sidebar_variant}
      data-sidebar-collapsible={PREFERENCE_DEFAULTS.sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme and layout preferences on load to avoid flicker and unnecessary server rerenders. */}
        <ThemeBootScript />
      </head>
      {/* suppressHydrationWarning: browser extensions inject attributes (e.g. data-gptw) onto body before React hydrates */}
      <body className={`${fontVars} min-h-screen antialiased`} suppressHydrationWarning>
        <ConditionalClerkProvider>
          <TooltipProvider>
            <PreferencesStoreProvider
              themeMode={theme_mode}
              themePreset={theme_preset}
              contentLayout={content_layout}
              navbarStyle={navbar_style}
              font={font}
            >
              {/* Server reads actual cookie values so client and server agree on first render.
                  ThemeBootScript remains as a fast-paint fallback for the very first visit
                  (before cookies are set) and for system theme detection. */}
              {children}
              <Toaster />
            </PreferencesStoreProvider>
          </TooltipProvider>
        </ConditionalClerkProvider>
      </body>
    </html>
  )
}
