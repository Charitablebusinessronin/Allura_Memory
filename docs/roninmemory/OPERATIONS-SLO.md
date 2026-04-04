# roninmemory Operations SLO

## Service Level Objectives

### 1) Session Hydration Latency
- **SLO:** p95 `< 30s`
- **Measured by:** session hydration command timing (`session:hydrate`)

### 2) Memory Write Reliability (Neo4j)
- **SLO:** `>= 99.0%` successful writes with readback verification
- **Measured by:** write + immediate readback checks

### 3) Raw Trace Ingestion Reliability (PostgreSQL)
- **SLO:** `>= 99.5%` event ingestion success
- **Measured by:** insert success + row-count verification in time window

### 4) Curator Promotion Lag
- **SLO:** p95 promotion latency `< 10m` from qualifying run to promoted insight
- **Measured by:** `adas_runs.finished_at` to `promoted=true` timestamps

## Error Budget Policy

- Breach in 2 consecutive windows triggers incident review.
- Freeze non-critical feature work until reliability recovers.

## Weekly Verification

- Run memory smoke test command
- Validate latest session reflection readback
- Validate trace ingestion counters
- Validate curator queue drain metrics
