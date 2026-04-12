# ADR-002: Autonomous Curator Agent

**Status**: Proposed
**Date**: 2026-04-12
**Decision Maker**: brooks-architect

## Context

Phase 2 wired the curator pipeline end-to-end: `memory_add` → `curatorScore()` → `canonical_proposals` table → `POST /api/curator/approve` → Neo4j `InsightHead` + `Insight` + `SUPERSEDES`. The pipeline currently requires manual triggering — a human must call `bun src/curator/index.ts run` to score events, then `POST /api/curator/approve` to promote them.

This creates a gap: unpromoted events accumulate in PostgreSQL with no autonomous scoring. The canonical queue (`canonical_proposals`) may sit empty between manual runs, delaying the flow from raw events to curated knowledge.

Phase 3 makes the curator autonomous — a background watchdog that continuously feeds the approval queue, leaving humans in the review loop but removing the need for manual trigger execution.

## Decision

Implement a long-running **curator watchdog loop** (`src/curator/watchdog.ts`) that:

1. **Polls** PostgreSQL `events` table for unpromoted, high-confidence events (7-day window)
2. **Scores** each candidate via `curatorScore()`
3. **Creates proposals** in `canonical_proposals` for scores above threshold (default 0.7)
4. **Surfaces** pending proposals to Notion for human review (via `src/curator/notion-sync.ts`)
5. **Does NOT auto-approve** — the existing `POST /api/curator/approve` route remains the single approval path

The watchdog respects two promotion modes:
- **`auto`**: Proposals above auto-approval threshold (0.85) are automatically promoted
- **`soc2`**: All proposals require human approval via the canonical queue

### Key Constraints

- **Single approval queue**: All proposals flow through `canonical_proposals` — no parallel approval paths
- **Idempotency**: `ON CONFLICT DO NOTHING` prevents duplicate proposals for the same event
- **Group isolation**: `group_id` validated against `^allura-[a-z0-9-]+$` pattern
- **Configurable interval**: Default 60 seconds, overridable via `--interval` CLI arg
- **Bounded scan**: Maximum 50 events per scan cycle to prevent resource saturation
- **HITL gate**: The watchdog NEVER bypasses `PROMOTION_MODE=soc2` — it only creates proposals, never approves them

### Companion: Notion Sync Surface

A second module (`src/curator/notion-sync.ts`) queries pending proposals and prepares data for Notion page creation. The actual Notion writes happen through `MCP_DOCKER_notion-create-pages`, keeping the sync layer decoupled from API specifics.

## Alternatives Considered

### 1. Webhook-Triggered Curator (Rejected)

PostgreSQL `LISTEN/NOTIFY` could trigger scoring on every INSERT.

**Rejected because**: Adds infrastructure complexity (webhook receiver, retry logic, dead letter queue). Requires the app to maintain a persistent listener process. The watchdog's polling approach is simpler and more resilient to restarts.

### 2. Cron-Based Batch (Rejected)

External cron scheduler runs the curator every N minutes.

**Rejected because**: Not real-time enough for interactive workflows. Requires external scheduler (cron, K8s CronJob) outside the application's control. Polling from within the process is simpler and self-contained.

### 3. Event-Sourced Streaming (Rejected)

Kafka/Kinesis stream processes events as they arrive.

**Rejected because**: Premature infrastructure. K8s event bus not available in current deployment. The PostgreSQL-polling approach achieves the same result with zero additional infrastructure.

## Consequences

### Positive

- **Curator becomes autonomous** but bounded by HITL gates — no human intervention needed for scoring, only for approval
- **Notion becomes the human review surface** — pending proposals surface where humans already work
- **Single approval queue preserves conceptual integrity** — no split between "auto-approved" and "queue-approved" paths
- **Simple operations**: One process to monitor, one queue to drain

### Negative

- **Polling introduces up to N-second latency** between event creation and proposal creation (where N = interval)
- **Watchdog process must be kept alive** — requires process supervision (Docker, systemd, or similar)
- **Notion sync is one-way** — approvals made through the API don't automatically update Notion pages (requires future webhook or polling)

### Risks

- **Duplicate proposals**: Mitigated by `ON CONFLICT DO NOTHING` and `trace_ref` uniqueness
- **Resource exhaustion**: Mitigated by 50-event scan limit and interval guard
- **Approval backlog**: If humans don't review, proposals accumulate. Mitigated by Notion visibility + dashboard alerts (future)

## References

- `docker/postgres-init/11-canonical-proposals.sql` — Canonical proposals table schema
- `src/lib/curator/score.ts` — Scoring system (emerging/adoption/mainstream tiers)
- `src/curator/index.ts` — Current manual curator (`runCurator()` + deprecated `approvePromotions()`)
- ADR-001: Canonical Memory Interface (referenced in `docs/allura/RISKS-AND-DECISIONS.md`)