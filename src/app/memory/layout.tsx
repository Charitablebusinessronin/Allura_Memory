"use client"

import { useEffect } from "react"
import { applyThemePreset } from "@/lib/preferences/theme-utils"
import { persistPreference } from "@/lib/preferences/preferences-storage"

export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyThemePreset("allura")
    persistPreference("theme_preset", "allura")
  }, [])
  return <>{children}</>
}