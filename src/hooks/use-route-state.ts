"use client"

import { useCallback, useEffect, useState } from "react"
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

function classifyRouteState<T>(
  result: DashboardResult<T> | null,
  options: RouteStateOptions = {}
): ClassifiedRouteState<T> {
  const emptyThreshold = options.emptyThreshold ?? 0

  let state: RouteStateClassification = "success"
  if (result === null) state = "loading"
  else if (result.error !== null) state = "error"
  else if (result.degraded) state = "degraded"
  else if (result.data === null || (Array.isArray(result.data) && result.data.length <= emptyThreshold)) state = "empty"

  const warnings = result?.warnings ?? []
  const normalizedWarnings = warnings.map((warning) => {
    if (warning.code !== undefined) {
      return {
        code: warning.code,
        message: warning.message,
        source: warning.source,
        severity: warning.severity ?? "info",
      }
    }

    return {
      code: warning.id || "LEGACY",
      message: warning.message || "Unknown",
      source: warning.source,
      severity: warning.severity ?? "info",
    }
  })

  return {
    data: result?.data ?? null,
    error: result?.error ?? null,
    degraded: result?.degraded ?? false,
    warnings: normalizedWarnings,
    source: result?.source ?? null,
    fetchedAt: result?.fetched_at ?? null,
    isLoading: state === "loading",
    state,
    isEmpty: state === "empty",
  }
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
  return classifyRouteState(result, options)
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

      const classified = classifyRouteState<T>(result, options)

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
  }, [fetcher, options])

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
