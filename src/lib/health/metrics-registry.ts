/**
 * Prometheus Metrics Registry — In-memory metrics collection
 *
 * Implements the Prometheus exposition format (text/plain; version=0.0.4)
 * without external dependencies. Thread-safe for Bun's single-threaded model.
 *
 * Metric types:
 * - Counter: Monotonically increasing cumulative metric
 * - Gauge: Value that can go up or down
 * - Histogram: Distribution of observations into configurable buckets
 *
 * Naming follows Prometheus conventions: allura_memory_<name>
 */

// ── Types ────────────────────────────────────────────────────────────────────

interface CounterEntry {
  type: "counter";
  name: string;
  help: string;
  values: Map<string, number>; // key = label hash
  labels: Map<string, Record<string, string>>; // key = label hash, value = label pairs
}

interface GaugeEntry {
  type: "gauge";
  name: string;
  help: string;
  values: Map<string, number>;
  labels: Map<string, Record<string, string>>;
}

interface HistogramEntry {
  type: "histogram";
  name: string;
  help: string;
  buckets: number[];
  values: Map<string, Map<string, number>>; // key = label hash, value = bucket counts
  sums: Map<string, number>;
  counts: Map<string, number>;
  labels: Map<string, Record<string, string>>;
}

type MetricEntry = CounterEntry | GaugeEntry | HistogramEntry;

/** Label key-value pairs for metric dimensions */
export type Labels = Record<string, string>;

// ── Label Hashing ────────────────────────────────────────────────────────────

function labelHash(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}=${labels[k]}`).join("&");
}

function formatLabelPairs(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  const pairs = keys.map((k) => `${k}="${escapeLabelValue(labels[k])}"`);
  return `{${pairs.join(",")}}`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ── Default Histogram Buckets ────────────────────────────────────────────────

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// ── Metrics Registry ─────────────────────────────────────────────────────────

/**
 * In-memory Prometheus metrics registry.
 *
 * Thread-safe for Bun's single-threaded event loop model.
 * No external dependencies — implements the exposition format directly.
 */
export class MetricsRegistry {
  private metrics: Map<string, MetricEntry> = new Map();

  // ── Counter Operations ───────────────────────────────────────────────────

  /**
   * Register a counter metric. Must be called before incrementing.
   * Idempotent — calling twice with the same name and help is safe.
   */
  registerCounter(name: string, help: string): void {
    const existing = this.metrics.get(name);
    if (existing) {
      if (existing.type === "counter") {
        return; // Already registered — idempotent
      }
      throw new Error(`Metric "${name}" already registered as ${existing.type}, cannot re-register as counter`);
    }
    this.metrics.set(name, {
      type: "counter",
      name,
      help,
      values: new Map(),
      labels: new Map(),
    });
  }

  /**
   * Increment a counter by the given amount (default 1).
   * Labels are used to partition the counter into dimensions.
   */
  incrementCounter(name: string, labels: Labels = {}, amount: number = 1): void {
    const entry = this.metrics.get(name);
    if (!entry) {
      throw new Error(`Counter "${name}" not registered. Call registerCounter() first.`);
    }
    if (entry.type !== "counter") {
      throw new Error(`Metric "${name}" is a ${entry.type}, not a counter.`);
    }
    if (amount < 0) {
      throw new Error(`Counter increment must be non-negative, got ${amount}.`);
    }

    const key = labelHash(labels);
    const current = entry.values.get(key) ?? 0;
    entry.values.set(key, current + amount);
    entry.labels.set(key, { ...labels });
  }

  // ── Gauge Operations ─────────────────────────────────────────────────────

  /**
   * Register a gauge metric. Must be called before setting values.
   * Idempotent — calling twice with the same name and help is safe.
   */
  registerGauge(name: string, help: string): void {
    const existing = this.metrics.get(name);
    if (existing) {
      if (existing.type === "gauge") {
        return; // Already registered — idempotent
      }
      throw new Error(`Metric "${name}" already registered as ${existing.type}, cannot re-register as gauge`);
    }
    this.metrics.set(name, {
      type: "gauge",
      name,
      help,
      values: new Map(),
      labels: new Map(),
    });
  }

  /**
   * Set a gauge to the given value.
   */
  setGauge(name: string, value: number, labels: Labels = {}): void {
    const entry = this.metrics.get(name);
    if (!entry) {
      throw new Error(`Gauge "${name}" not registered. Call registerGauge() first.`);
    }
    if (entry.type !== "gauge") {
      throw new Error(`Metric "${name}" is a ${entry.type}, not a gauge.`);
    }

    const key = labelHash(labels);
    entry.values.set(key, value);
    entry.labels.set(key, { ...labels });
  }

  // ── Histogram Operations ──────────────────────────────────────────────────

  /**
   * Register a histogram metric with configurable buckets.
   * Idempotent — calling twice with the same name and help is safe.
   */
  registerHistogram(name: string, help: string, buckets: number[] = DEFAULT_BUCKETS): void {
    const existing = this.metrics.get(name);
    if (existing) {
      if (existing.type === "histogram") {
        return; // Already registered — idempotent
      }
      throw new Error(`Metric "${name}" already registered as ${existing.type}, cannot re-register as histogram`);
    }

    // Ensure buckets are sorted
    const sortedBuckets = [...buckets].sort((a, b) => a - b);
    this.metrics.set(name, {
      type: "histogram",
      name,
      help,
      buckets: sortedBuckets,
      values: new Map(),
      sums: new Map(),
      counts: new Map(),
      labels: new Map(),
    });
  }

  /**
   * Observe a value in the histogram.
   * The value is placed into the appropriate bucket and the sum/count are updated.
   */
  observeHistogram(name: string, value: number, labels: Labels = {}): void {
    const entry = this.metrics.get(name);
    if (!entry) {
      throw new Error(`Histogram "${name}" not registered. Call registerHistogram() first.`);
    }
    if (entry.type !== "histogram") {
      throw new Error(`Metric "${name}" is a ${entry.type}, not a histogram.`);
    }

    const key = labelHash(labels);

    // Initialize bucket map for this label set if needed
    if (!entry.values.has(key)) {
      const bucketMap = new Map<string, number>();
      for (const bucket of entry.buckets) {
        bucketMap.set(`le_${bucket}`, 0);
      }
      bucketMap.set("le_+Inf", 0);
      entry.values.set(key, bucketMap);
      entry.sums.set(key, 0);
      entry.counts.set(key, 0);
      entry.labels.set(key, { ...labels });
    }

    // Increment appropriate buckets (cumulative)
    const bucketMap = entry.values.get(key)!;
    for (const bucket of entry.buckets) {
      if (value <= bucket) {
        const current = bucketMap.get(`le_${bucket}`) ?? 0;
        bucketMap.set(`le_${bucket}`, current + 1);
      }
    }
    // +Inf bucket always increments
    const infCurrent = bucketMap.get("le_+Inf") ?? 0;
    bucketMap.set("le_+Inf", infCurrent + 1);

    // Update sum and count
    entry.sums.set(key, (entry.sums.get(key) ?? 0) + value);
    entry.counts.set(key, (entry.counts.get(key) ?? 0) + 1);
  }

  // ── Collection ─────────────────────────────────────────────────────────────

  /**
   * Collect all metrics in Prometheus exposition format.
   * Returns a string suitable for the /metrics endpoint.
   *
   * Format: https://prometheus.io/docs/instrumenting/exposition_formats/
   */
  collect(): string {
    const lines: string[] = [];

    // Sort metrics by name for deterministic output
    const sortedNames = [...this.metrics.keys()].sort();

    for (const name of sortedNames) {
      const entry = this.metrics.get(name)!;

      // Help line
      lines.push(`# HELP ${name} ${entry.help}`);
      // Type line
      lines.push(`# TYPE ${name} ${entry.type}`);

      switch (entry.type) {
        case "counter":
          this.collectCounter(entry, lines);
          break;
        case "gauge":
          this.collectGauge(entry, lines);
          break;
        case "histogram":
          this.collectHistogram(entry, lines);
          break;
      }

      lines.push(""); // Blank line between metric groups
    }

    return lines.join("\n").trimEnd() + "\n";
  }

  private collectCounter(entry: CounterEntry, lines: string[]): void {
    for (const [key, value] of entry.values) {
      const labelPairs = entry.labels.get(key) ?? {};
      const labelStr = formatLabelPairs(labelPairs);
      if (labelStr) {
        lines.push(`${entry.name}${labelStr} ${value}`);
      } else {
        lines.push(`${entry.name} ${value}`);
      }
    }
  }

  private collectGauge(entry: GaugeEntry, lines: string[]): void {
    for (const [key, value] of entry.values) {
      const labelPairs = entry.labels.get(key) ?? {};
      const labelStr = formatLabelPairs(labelPairs);
      if (labelStr) {
        lines.push(`${entry.name}${labelStr} ${value}`);
      } else {
        lines.push(`${entry.name} ${value}`);
      }
    }
  }

  private collectHistogram(entry: HistogramEntry, lines: string[]): void {
    for (const [key] of entry.labels) {
      const labelPairs: Record<string, string> = entry.labels.get(key) ?? {};

      // Bucket counts (cumulative)
      const bucketMap = entry.values.get(key);
      if (bucketMap) {
        for (const bucket of entry.buckets) {
          const bucketLabel = Object.keys(labelPairs).length > 0
            ? `{${Object.entries(labelPairs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(",")},le="${bucket}"}`
            : `{le="${bucket}"}`;
          const count = bucketMap.get(`le_${bucket}`) ?? 0;
          lines.push(`${entry.name}_bucket${bucketLabel} ${count}`);
        }
        // +Inf bucket
        const infLabel = Object.keys(labelPairs).length > 0
          ? `{${Object.entries(labelPairs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(",")},le="+Inf"}`
          : `{le="+Inf"}`;
        const infCount = bucketMap.get("le_+Inf") ?? 0;
        lines.push(`${entry.name}_bucket${infLabel} ${infCount}`);
      }

      // Sum and Count
      const labelStr = formatLabelPairs(labelPairs);
      lines.push(`${entry.name}_sum${labelStr} ${entry.sums.get(key) ?? 0}`);
      lines.push(`${entry.name}_count${labelStr} ${entry.counts.get(key) ?? 0}`);
    }
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /**
   * Reset all metrics. Useful for testing.
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Get the number of registered metrics.
   */
  get size(): number {
    return this.metrics.size;
  }
}

// ── Singleton Registry ────────────────────────────────────────────────────────

/**
 * Global metrics registry singleton.
 * Import this to record metrics from anywhere in the application.
 */
export const metricsRegistry = new MetricsRegistry();

// ── Register All Standard Metrics ─────────────────────────────────────────────

/**
 * Register all standard Allura Memory metrics.
 * Called once at application startup.
 */
export function registerStandardMetrics(): void {
  // Counters
  metricsRegistry.registerCounter("allura_memory_add_total", "Total number of memory_add operations");
  metricsRegistry.registerCounter("allura_memory_search_total", "Total number of memory_search operations");
  metricsRegistry.registerCounter("allura_memory_http_requests_total", "Total number of HTTP requests by method and path");
  metricsRegistry.registerCounter("allura_memory_watchdog_cycles_total", "Total number of watchdog scan cycles");
  metricsRegistry.registerCounter("allura_memory_proposals_created_total", "Total number of curator proposals created");
  metricsRegistry.registerCounter("allura_memory_proposals_approved_total", "Total number of curator proposals approved");
  metricsRegistry.registerCounter("allura_memory_proposals_rejected_total", "Total number of curator proposals rejected");

  // Histograms
  metricsRegistry.registerHistogram(
    "allura_memory_http_request_duration_seconds",
    "HTTP request duration in seconds by method and path",
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  );

  // Gauges
  metricsRegistry.registerGauge("allura_memory_circuit_breaker_state", "Circuit breaker state: 1=closed, 0.5=half_open, 0=open");
  metricsRegistry.registerGauge("allura_memory_budget_remaining", "Remaining budget by category");
  metricsRegistry.registerGauge("allura_memory_process_uptime_seconds", "Process uptime in seconds");
  metricsRegistry.registerGauge("allura_memory_nodejs_heap_used_bytes", "Node.js heap used in bytes");
  metricsRegistry.registerGauge("allura_memory_nodejs_heap_total_bytes", "Node.js heap total in bytes");
}