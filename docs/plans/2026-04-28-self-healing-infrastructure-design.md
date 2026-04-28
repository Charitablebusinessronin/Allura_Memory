# Self-Healing Infrastructure Design

**Date:** 2026-04-28  
**Branch:** `feature/self-healing-infrastructure`  
**Worktree:** `.worktrees/self-healing`  
**Status:** Approved

## Problem

Allura Brain containers fail silently or with false alarms:
- Neo4j was "unhealthy" for 26 hours (6,284 false failures) because the healthcheck used `curl` which doesn't exist in the image
- BudgetEnforcer breach spam logged every second but never halted sessions (fix deployed, not built)
- No watchdog to detect and restart unhealthy containers
- No circuit breaker wiring for Neo4j operations — existing breaker code is excellent but unused
- No alert coalescing — one incident can generate thousands of log lines

## Architecture: Three-Layer Self-Healing

### Layer 1: Container Watchdog (bash + systemd)

A lightweight script that monitors `docker compose ps` health status and restarts unhealthy containers after N consecutive failures.

**Design:**
- `scripts/health-watchdog.sh` — polls every 30s, tracks streaks
- If a container is unhealthy for 3 consecutive checks (90s), restart it
- Single alert per incident (logs to systemd journal + stdout)
- Cooldown: 5 minutes between restart attempts for the same container
- Systemd service: `allura-watchdog.service`

**Rules:**
- Never restart `knowledge-postgres` automatically (data integrity risk)
- Restart `knowledge-neo4j`, `allura-http-gateway`, `allura-memory-mcp`, `allura-web` after 3 consecutive failures
- Log all actions to `scripts/watchdog-state.json` for audit

### Layer 2: Application Circuit Breaker (TypeScript)

Wire the existing `src/lib/circuit-breaker/` into Neo4j operations.

**Key changes:**
1. `src/lib/neo4j/resilient-client.ts` — wraps `readTransaction`/`writeTransaction` with circuit breaker
2. When Neo4j breaker is OPEN:
   - Read operations fall back to PostgreSQL-only (graceful degradation)
   - Write operations queue for retry or fail with clear error
   - `/ready` endpoint already marks Neo4j as optional — no change needed
3. Health check: `isDriverHealthy()` already exists — wire it as the breaker's health check
4. Alert coalescing: existing `alerting.ts` already has `AlertQueue` — ensure it deduplicates

**Breaker configuration for Neo4j:**
- `errorThreshold`: 5 (trip after 5 consecutive Neo4j errors)
- `openTimeoutMs`: 60000 (try recovery every 60s)
- `successThreshold`: 3 (3 successful calls to close breaker)
- `enableAutoRecovery`: true

### Layer 3: Alert Coalescing (TypeScript)

Modify `src/lib/circuit-breaker/alerting.ts` to:
1. Deduplicate alerts within a 5-minute window (same breaker + same state = suppress)
2. Log ONE alert per state transition, not per check
3. Add `/api/health/breakers` endpoint to expose breaker status
4. Integrate with BudgetEnforcer halt events (already logged to PG)

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `scripts/health-watchdog.sh` | Container health watchdog |
| `scripts/systemd/allura-watchdog.service` | Systemd unit for watchdog |
| `src/lib/neo4j/resilient-client.ts` | Circuit breaker wrapper for Neo4j |
| `src/lib/neo4j/resilient-client.test.ts` | Tests for resilient client |
| `src/app/api/health/breakers/route.ts` | Breaker status API endpoint |

### Modified Files
| File | Change |
|------|---------|
| `src/lib/circuit-breaker/alerting.ts` | Add dedup window (5min) |
| `src/mcp/canonical-tools.ts` | Use resilient client for Neo4j operations |
| `src/lib/memory/search.ts` | Use resilient client |
| `src/lib/memory/get.ts` | Use resilient client |
| `src/lib/memory/writer.ts` | Use resilient client |
| `docker-compose.yml` | Already fixed (wget healthcheck) |
| `docs/allura/BLUEPRINT.md` | Add self-healing section |

## Task Breakdown for Team RAM

### Task 1: Watchdog Script (hightower-devops)
- `scripts/health-watchdog.sh` — bash watchdog with streak tracking, restart logic, cooldown
- `scripts/systemd/allura-watchdog.service` — systemd unit
- Test: simulate unhealthy container, verify restart

### Task 2: Neo4j Resilient Client (brooks-architect)
- `src/lib/neo4j/resilient-client.ts` — circuit breaker wrapper
- Wire `BreakerManager` with Neo4j health check
- Export `resilientReadTransaction`, `resilientWriteTransaction`
- Fallback: return degradation notice when breaker is OPEN
- `src/lib/neo4j/resilient-client.test.ts` — unit tests

### Task 3: Alert Deduplication (fowler-refactor)
- Modify `src/lib/circuit-breaker/alerting.ts` — add 5-minute dedup window
- Add `/api/health/breakers` endpoint
- Test: verify dedup suppression works

### Task 4: Wire Resilient Client into Memory Operations (woz-builder)
- Update `src/lib/memory/search.ts`, `get.ts`, `writer.ts`
- Update `src/mcp/canonical-tools.ts`
- Ensure graceful degradation when Neo4j is down

### Task 5: Documentation (knuth-data)
- Update `docs/allura/BLUEPRINT.md` with self-healing architecture
- Update `docs/allura/DESIGN.md` with circuit breaker wiring diagram
- Add operational runbook: `docs/operational/self-healing-runbook.md`

## Acceptance Criteria

1. ✅ Neo4j healthcheck uses `wget` (already deployed)
2. ✅ Watchdog restarts unhealthy containers after 3 consecutive failures
3. ✅ Circuit breaker trips after 5 Neo4j errors, auto-recovers in 60s
4. ✅ When Neo4j breaker is OPEN, reads fall back to PG, writes fail gracefully
5. ✅ Alert dedup: same breaker state → max 1 alert per 5 minutes
6. ✅ `/api/health/breakers` endpoint exposes breaker status
7. ✅ All tests pass
8. ✅ Documentation updated