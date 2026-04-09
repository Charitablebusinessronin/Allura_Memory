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

## Immediate Blocker — RESOLVED (Degraded)

**Notion Integration Status: DEGRADED**
- **Reason**: No `NOTION_TOKEN` in environment; requires manual Notion integration setup
- **Decision**: Remove P0 designation; dashboard visibility deferred to P2
- **Alternative**: Use Postgres queries directly (`brooks_metrics` view) for metrics
- **Documentation**: See `docs/degraded-services.md` for rationale

**Previous attempt**: "Brooks Skill Executions" database creation failed due to missing auth token and schema parameter issues.

## What's Live

✅ **Postgres Tracking Schema** (runtime + session_id columns deployed)
✅ **5 Analytical Views** (brooks_decisions, brooks_metrics, brooks_session_timeline, brooks_confidence_distribution, brooks_principles_applied)
✅ **Brooks Startup Protocol** (max 2 calls: events query + config read)
✅ **Reflection Protocol** (audit trail on every CA/VA/WS/NX)
✅ **8-Command Menu** (CA · VA · WS · NX · CH · MH · PM · DA)

## Next Steps (Priority Order)

1. **P0: Surgical Team Activation** (1 day) — See `docs/recovery-plan-2026-04-09.md`
   - Audit why 7 of 8 agents are silent
   - Decide: accept/fix/assign/retire per evidence
   - Document in `memory-bank/systemPatterns.md`

2. **P1: Neo4j Promotion** (2 hours)
   - Mine last 30 Brooks events for promotion-worthy decisions
   - Run curator approval flow
   - Verify SUPERSEDES usage

3. **P2: Notion Integration** (Deferred)
   - Requires: Manual Notion integration token setup
   - Alternative: Use Postgres `brooks_metrics` view for dashboard
   - See `docs/degraded-services.md` for full rationale

4. **P2: Runtime Integration** (20 min)
   - Document Copilot → populate runtime='copilot'
   - Document OpenClaw → populate runtime='openclaw'
   - Document OpenCode → populate runtime='opencode'

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
