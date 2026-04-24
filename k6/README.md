# k6 Load Tests — Allura Memory

## Quick Smoke Test (CI)

```bash
k6 run k6/smoke-test.js
```

5 VUs, 10 seconds. Validates that all endpoints respond.

## Full Load Test

```bash
k6 run k6/load-test.js
```

Ramps from 0→20→50→100 VUs over 60 seconds. Measures p50/p95/p99 latency for:

- `memory_add` — 40% weight
- `memory_search` — 30% weight
- `health/metrics` — 15% weight
- `health` (basic) — 10% weight
- `curator/proposals` — 5% weight

### Thresholds

| Metric | p50 | p95 | p99 |
|--------|-----|-----|-----|
| Overall | <500ms | <2000ms | <5000ms |
| memory_add | — | <3000ms | — |
| memory_search | — | <2000ms | — |
| health_metrics | — | <1000ms | — |
| Error rate | — | <10% | — |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:4748` | Allura HTTP gateway URL |
| `GROUP_ID` | `allura-system` | Tenant group ID |
| `API_KEY` | `dev-key-local` | Authorization API key |

### Results

Results are written to `k6/load-test-results.json` and printed to stdout.

## Reference

- Sprint Plan RK-14: k6 load validation (VU=100)
- docs/allura/SPRINT-PLAN.md