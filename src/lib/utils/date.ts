/**
 * Date formatting utilities — single source of truth for Allura.
 *
 * Consolidates duplicated Neo4j DateTime normalization,
 * relative-time formatting, group headers, and provenance dates.
 */

import { format, isToday, isYesterday } from "date-fns"

/**
 * Normalize a Neo4j DateTime object (or plain string) to an ISO string.
 *
 * Neo4j driver returns `{ year: { low: N }, month: { low: N }, … }` objects,
 * which JSON.stringify turns into nested objects. This unwraps them.
 */
export function normalizeNeo4jTimestamp(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "year" in (value as Record<string, unknown>)) {
    const d = value as Record<string, { low: number; high?: number }>
    const get = (field: string): number => d[field]?.low ?? 0
    return new Date(
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
        Math.floor(get("nanosecond") / 1_000_000)
      )
    ).toISOString()
  }
  return String(value ?? new Date().toISOString())
}

/**
 * Format a date string as relative time (e.g. "5 minutes ago").
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

/**
 * Format a date string as a day-group label (Today / Yesterday / EEEE, MMMM d).
 * Used by the audit log to group events by day.
 */
export function formatGroupHeader(dateString: string): string {
  const date = new Date(dateString)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "EEEE, MMMM d")
}

/**
 * Format a date string for provenance display (human-readable locale string).
 */
export function formatProvenanceDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}
