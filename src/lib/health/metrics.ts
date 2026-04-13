/**
 * Prometheus Metrics Collection — /metrics endpoint handler
 *
 * Collects application metrics from the registry and process metrics
 * from Node.js runtime, then formats them in Prometheus exposition format.
 *
 * Content-Type: text/plain; version=0.0.4; charset=utf-8
 */

import {
  metricsRegistry,
  registerStandardMetrics,
} from "./metrics-registry";
import { getBreakerManager } from "@/lib/circuit-breaker/manager";

// ── Initialize Standard Metrics ──────────────────────────────────────────────

let metricsInitialized = false;

/**
 * Ensure standard metrics are registered.
 * Safe to call multiple times — idempotent.
 */
export function ensureMetricsInitialized(): void {
  if (!metricsInitialized) {
    registerStandardMetrics();
    metricsInitialized = true;
  }
}

// ── Process Metrics ───────────────────────────────────────────────────────────

/**
 * Collect process-level metrics from Node.js runtime.
 * Updates gauges for uptime and heap usage.
 */
function collectProcessMetrics(): void {
  // Process uptime
  metricsRegistry.setGauge("allura_memory_process_uptime_seconds", process.uptime());

  // Heap memory (available in Node.js/Bun)
  const memoryUsage = process.memoryUsage();
  metricsRegistry.setGauge("allura_memory_nodejs_heap_used_bytes", memoryUsage.heapUsed);
  metricsRegistry.setGauge("allura_memory_nodejs_heap_total_bytes", memoryUsage.heapTotal);
}

// ── Circuit Breaker Metrics ───────────────────────────────────────────────────

/**
 * Map circuit breaker state to numeric gauge value.
 * closed=1 (healthy), half_open=0.5 (testing), open=0 (tripped)
 */
function breakerStateToValue(state: string): number {
  switch (state) {
    case "closed":
      return 1;
    case "half_open":
      return 0.5;
    case "open":
      return 0;
    default:
      return 0;
  }
}

/**
 * Collect circuit breaker state metrics from the BreakerManager.
 */
function collectCircuitBreakerMetrics(): void {
  try {
    const manager = getBreakerManager();
    // The BreakerManager doesn't expose a list-all method directly,
    // so we collect from the known breaker names.
    // If no breakers are registered, this is a no-op.
    const breakerNames = ["memory_add", "memory_search", "memory_get", "memory_list", "memory_delete"];

    for (const name of breakerNames) {
      for (const groupId of ["allura-roninmemory"]) {
        const breaker = manager.getBreaker(name, groupId);
        if (breaker) {
          const state = breaker.getState();
          const value = breakerStateToValue(state);
          metricsRegistry.setGauge(
            "allura_memory_circuit_breaker_state",
            value,
            { breaker_name: name, group_id: groupId, state },
          );
        }
      }
    }
  } catch {
    // BreakerManager may not be initialized yet — that's fine
  }
}

// ── Metrics Collection ────────────────────────────────────────────────────────

/**
 * Collect all metrics and return them in Prometheus exposition format.
 *
 * This function:
 * 1. Ensures standard metrics are registered
 * 2. Updates process-level gauges (uptime, heap)
 * 3. Updates circuit breaker gauges
 * 4. Collects all metrics from the registry
 *
 * Returns the Prometheus text format string.
 */
export function collectMetrics(): string {
  ensureMetricsInitialized();
  collectProcessMetrics();
  collectCircuitBreakerMetrics();
  return metricsRegistry.collect();
}

// ── Convenience Functions for Recording Metrics ───────────────────────────────

/**
 * Record an HTTP request metric.
 * Increments the request counter and observes the duration histogram.
 */
export function recordHttpRequest(
  method: string,
  path: string,
  durationSeconds: number,
): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_http_requests_total", { method, path });
  metricsRegistry.observeHistogram("allura_memory_http_request_duration_seconds", durationSeconds, { method, path });
}

/**
 * Record a memory_add operation.
 */
export function recordMemoryAdd(): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_add_total");
}

/**
 * Record a memory_search operation.
 */
export function recordMemorySearch(): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_search_total");
}

/**
 * Record a watchdog cycle.
 */
export function recordWatchdogCycle(): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_watchdog_cycles_total");
}

/**
 * Record a proposal created.
 */
export function recordProposalCreated(): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_proposals_created_total");
}

/**
 * Record a proposal approved.
 */
export function recordProposalApproved(): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_proposals_approved_total");
}

/**
 * Record a proposal rejected.
 */
export function recordProposalRejected(): void {
  ensureMetricsInitialized();
  metricsRegistry.incrementCounter("allura_memory_proposals_rejected_total");
}

/**
 * Update budget remaining gauge.
 */
export function recordBudgetRemaining(
  category: string,
  remaining: number,
): void {
  ensureMetricsInitialized();
  metricsRegistry.setGauge("allura_memory_budget_remaining", remaining, { category });
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export { metricsRegistry, registerStandardMetrics } from "./metrics-registry";