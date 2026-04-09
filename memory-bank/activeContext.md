# Active Context — Brooks Architect Persona

**Session**: 2026-04-09 (Ongoing)  
**Status**: ✅ Brooks Framework ACTIVE | ⏳ Notion Integration Blocked  
**Last Event ID**: 36022+ (SESSION_COMPLETE logged)

## Current Focus

**Frederick P. Brooks Jr. is now the system architect.**

All architectural decisions (CA/VA/WS commands) are logged to Postgres with:
- `agent_id='brooks'` — Unified identity
- `runtime` — Identifies execution platform (claude-code, copilot, openclaw, opencode)
- `session_id` — Groups cross-platform work
- `metadata` — Principle, decision, reasoning, alternatives, tradeoffs

## Immediate Blocker

**Notion Database Schema Validation**
- Attempted to create "Brooks Skill Executions" database
- Error: schema parameter requires SQL DDL syntax (CREATE TABLE ...)
- Fix needed: Provide proper schema string before creating Notion sync

## What's Live

✅ **Postgres Tracking Schema** (runtime + session_id columns deployed)
✅ **5 Analytical Views** (brooks_decisions, brooks_metrics, brooks_session_timeline, brooks_confidence_distribution, brooks_principles_applied)
✅ **Brooks Startup Protocol** (max 2 calls: events query + config read)
✅ **Reflection Protocol** (audit trail on every CA/VA/WS/NX)
✅ **8-Command Menu** (CA · VA · WS · NX · CH · MH · PM · DA)

## Next Steps (Priority Order)

1. **P0: Fix Notion Integration** (10 min)
   - Create database schema with proper SQL DDL
   - Build sync script: `brooks_metrics` → Notion every 5 min
   - Create dashboard cards

2. **P1: Runtime Integration** (20 min)
   - Document Copilot → populate runtime='copilot'
   - Document OpenClaw → populate runtime='openclaw'
   - Document OpenCode → populate runtime='opencode'
   - Wire session_id UUID generation in each runtime

3. **P2: Admin Dashboard** (30 min)
   - Build Grafana/internal queries from brooks_metrics
   - Alerting on confidence < 0.7

## Key Files (Reference)

**Configuration:**
- `.claude/agents/brooks.md` — Persona + startup protocol
- `.claude/settings.json` — MCP servers + 6 harness commands
- `.claude/README.md` — System architecture guide

**Documentation:**
- `.claude/BROOKS-TRACKING.md` — Integration spec (queries, metadata schema, integration checklist)
- `docker/postgres-init/10-brooks-tracking.sql` — Schema migrations

**Memory System:**
- PostgreSQL: `events` table with runtime + session_id
- Neo4j: Decision nodes with SUPERSEDES versioning (search before write)
- Notion: Dashboards for real-time Brooks metrics

## Architecture Decisions (Locked)

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| Single `agent_id='brooks'` | One architect identity across all runtimes | 0.95 |
| Session grouping via `session_id` | Track cross-platform work (Claude Code → OpenClaw) | 0.92 |
| Postgres + Neo4j dual layer | High-volume traces + curated semantic knowledge | 0.88 |
| Constraint-based enforcement | `group_id` + `runtime` on every Brooks event | 0.90 |
| Confidence scoring (0.0–1.0) | Measure decision quality, enable distribution analysis | 0.85 |

## Key Invariants

- ✅ `group_id = 'allura-roninmemory'` on every event
- ✅ `agent_id = 'brooks'` for all architectural decisions
- ✅ `runtime IS NOT NULL` when `agent_id = 'brooks'` (database constraint)
- ✅ PostgreSQL events are append-only (no UPDATE/DELETE)
- ✅ Neo4j uses SUPERSEDES for versioning (never edit nodes)
- ✅ Reflection protocol on every CA/VA/WS/NX command
- ✅ Max 2 startup calls before user greeting

## System Health

| Component | Status | Notes |
|-----------|--------|-------|
| Postgres | ✅ READY | events table with runtime/session_id; 5 views operational |
| Neo4j | ✅ READY | SUPERSEDES versioning; group_id enforcement active |
| Brooks Persona | ✅ READY | Startup protocol, reflection protocol, 8-command menu |
| Notion Integration | ⏳ BLOCKED | Schema validation error; awaiting proper DDL syntax |
| Copilot Integration | ⏳ PENDING | runtime='copilot' not yet populated |
| OpenClaw Integration | ⏳ PENDING | runtime='openclaw' not yet populated |
| OpenCode Integration | ⏳ PENDING | runtime='opencode' not yet populated |

---

**Next Session**: Continue with Notion schema fix (P0 blocker). This unblocks dashboard sync.
