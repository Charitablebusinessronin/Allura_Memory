# Performance Baselines — Allura Memory

**Date:** 2026-05-01
**Measured by:** hightower (FR-11)
**Methodology:** Server-side timing via MCP tool's built-in `latency_ms` (excludes network overhead from external HTTP gateway)

## Results

| Benchmark | Target | Actual | Status |
|-----------|--------|--------|--------|
| memory_search p95 latency | < 200ms | **30ms** | ✅ PASS (6.7x under target) |
| memory_add throughput | ≥ 1 write/sec | **~4.7 writes/sec** | ✅ PASS |
| Dashboard TTFB p50 | — | 17.9ms | ℹ️ Measured |
| Neo4j 1-hop p50 | — | 1.4ms | ℹ️ Measured |
| Neo4j 2-hop p50 | — | 3.2ms | ℹ️ Measured |
| Neo4j 3-hop p50 | — | 2.5ms | ℹ️ Measured |
| Concurrent search (10x) | No errors | All succeeded | ✅ PASS |

## Key Findings

- **Search latency** is excellent at 30ms p95 — 6.7x under the 200ms target
- **Write throughput** is 4.7x the minimum target, with mean add latency of 212ms
- **Dashboard** serves in ~18ms (SPA, actual LCP/FID requires browser instrumentation)
- **Neo4j traversals** are very fast in steady-state (1-3ms p50), with cold-start penalties of 28-104ms on first query
- **Concurrent requests** handle fine with no errors

## Caveats

- Search/add latencies measured via MCP tool's built-in `latency_ms` (server-side timing, excludes network overhead from external HTTP gateway)
- The HTTP gateway benchmark script failed due to MCP session management issues; native tool measurements are more accurate
- Dashboard Core Web Vitals (LCP/FID/CLS) require browser instrumentation — only TTFB was measured
- Neo4j cold-start queries: 28-104ms on first query after container restart

## 8.5/10 Gate Assessment

| Criterion | Target | Actual | Status |
|-----------|--------|--------|--------|
| memory_search p95 | < 200ms | 30ms | ✅ |
| Dashboard LCP | < 1.5s | TTFB 18ms (LCP not measured) | ⚠️ Partial |
| Concurrent stability | No errors | No errors | ✅ |