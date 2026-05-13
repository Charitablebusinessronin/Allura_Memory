"use client"

import { useState, useEffect, useCallback } from "react"
import type { DashboardResult } from "@/lib/dashboard/types"

export type RouteStateClassification = "loading" | "success" | "empty" | "error" | "degraded"

export type ClassifiedRouteState<T> = {
  data: T | null
  error: string | null
  degraded: boolean
  warnings: Array<{ code: string; message: string; source?: string; severity: "info" | "warning" | "critical" }>
  source: string | null
  fetchedAt: string | null
  isLoading: boolean
  state: RouteStateClassification
  isEmpty: boolean
}

export type RouteStateOptions = {
  initialData?: unknown
  revalidate?: boolean
  emptyThreshold?: number
}

/**
 * useRouteStateClassified is a hook that accepts a DashboardResult<T> and
 * provides a consistent state classification across dashboard routes.
 * It wraps the result from API calls (getCommandStatus, getSystemHealth, etc.)
 * and classifies into: loading, success, empty, error, degraded.
 *
 * This aligns with the frozen dashboard-v2 contracts-0.1.0 spec for warnings shape.
 */
export function useRouteStateClassified<T>(
  result: DashboardResult<T> | null,
  options: RouteStateOptions = {}
): ClassifiedRouteState<T> {
  const emptyThreshold = options.emptyThreshold ?? 0

  // Classify state based on result content
  const classification = useCallback((): RouteStateClassification => {
    if (result === null) return "loading"
    if (result.error !== null) return "error"
    if (result.degraded) return "degraded"
    if (result.data === null || (Array.isArray(result.data) && result.data.length <= emptyThreshold)) return "empty"
    return "success"
  }, [result, emptyThreshold])

  const state: RouteStateClassification = classification()
  const isEmpty = state === "empty"

  // Sync fields from DashboardResult
  const data = result?.data ?? null
  const error = result?.error ?? null
  const degraded = result?.degraded ?? false
  const warnings = result?.warnings ?? []
  const source = result?.source ?? null
  const fetchedAt = result?.fetched_at ?? null

  // Map legacy warnings to new shape if needed
  const normalizedWarnings = warnings.map((w) => {
    // If already has code field, it's the new shape
    if ("code" in w && w.code !== undefined) {
      return w as { code: string; message: string; source?: string; severity: "info" | "warning" | "critical" }
    }
    // Legacy shape: convert {id, message, source, severity} to {code, message, source, severity}
    const legacy = w as unknown as { id?: string; message?: string; source?: string; severity?: string }
    return {
      code: legacy.id || "LEGACY",
      message: legacy.message || "Unknown",
      source: legacy.source,
      severity: (legacy.severity || "info") as "info" | "warning" | "critical",
    }
  })

  return {
    data,
    error,
    degraded,
    warnings: normalizedWarnings,
    source,
    fetchedAt,
    isLoading: state === "loading",
    state,
    isEmpty,
  }
}

/**
 * DEPRECATED: useRouteStateClassified is the new implementation.
 * This wrapper remains for backward compatibility during migration.
 * Migrating components should switch to useRouteStateClassified(DashboardResult, options).
 */
export function useRouteState<T>(
  fetcher: () => Promise<DashboardResult<T>>,
  options: RouteStateOptions = {}
): ClassifiedRouteState<T> {
  const [state, setState] = useState<ClassifiedRouteState<T>>({
    data: null,
    error: null,
    degraded: false,
    warnings: [],
    source: null,
    fetchedAt: null,
    isLoading: true,
    state: "loading",
    isEmpty: false,
  })

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher()

      const classified = useRouteStateClassified<T>(result, options)

      setState(classified)
    } catch {
      setState({
        data: null,
        error: "Failed to load data",
        degraded: false,
        warnings: [],
        source: null,
        fetchedAt: null,
        isLoading: false,
        state: "error",
        isEmpty: false,
      })
    }
  }, [fetcher])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Revalidate if enabled and not initial load
  useEffect(() => {
    if (options.revalidate && state.state !== "loading" && state.state !== "error") {
      const interval = setInterval(() => {
        fetchData()
      }, 30000) // Revalidate every 30 seconds
      return () => clearInterval(interval)
    }
  }, [options.revalidate, fetchData, state.state])

  return state
}
