# Active Context — Brooks Architect Persona

**Session**: 2026-04-10 (Docker Remediation + Commit)
**Status**: ✅ Brooks Framework ACTIVE | 📋 Docs Updated
**Last Event ID**: 5 (SESSION_COMPLETE logged)

## Current Focus

**Frederick P. Brooks Jr. is now the system architect.**

All architectural decisions (CA/VA/WS commands) are logged to Postgres with:
- `agent_id='brooks'` — Unified identity
- `runtime` — Identifies execution platform (claude-code, copilot, openclaw, opencode)
- `session_id` — Groups cross-platform work
- `metadata` — Principle, decision, reasoning, alternatives, tradeoffs

## Strategic Positioning (Updated from Notion)

**Allura Memory is a developer-focused memory layer for AI agents** that emphasizes **traceability, governance, and multi-tenant isolation** — positioned as a more controlled, enterprise-grade alternative to mem0.

### How it differs from mem0

- **Governance-first:** Human-in-the-loop gates (Curator → Auditor) before promoting knowledge
- **Auditability:** Decisions and memory updates are reconstructable over time
- **Multi-tenant isolation:** Strict `group_id` boundaries to prevent cross-tenant leakage
- **Layered architecture:** Designed as part of an Agent-OS (storage + runtime + orchestration + UI)

### One-line pitch

**"mem0, but with provable governance, tenant isolation, and an auditable promotion pipeline."**

## What's Live

✅ **Postgres Tracking Schema** (runtime + session_id columns deployed)
✅ **5 Analytical Views** (brooks_decisions, brooks_metrics, brooks_session_timeline, brooks_confidence_distribution, brooks_principles_applied)
✅ **Brooks Startup Protocol** (max 2 calls: events query + config read)
✅ **Reflection Protocol** (audit trail on every CA/VA/WS/NX)
✅ **8-Command Menu** (CA · VA · WS · NX · CH · MH · PM · DA)
✅ **Enterprise Docker Setup** (observability stack parked, ready to merge)

## Curator Plan (What We're Building Next)

### 1) Queue (Proposals)
- When a memory score is high and `PROMOTION_MODE=soc2`, it goes into a queue
- Queue item includes: `group_id`, content, score, evidence links, and status

### 2) Distinguish Checks (Before Approval)
- **Duplicate:** Do we already have this fact?
- **Conflict:** Does it fight an older fact?
- **Age:** Is this a long-term rule or a short-term detail?

### 3) Human Approval
- Human reviews the queue in the admin screen (Next.js dashboard)
- Only humans can approve

### 4) Promotion (Write to Neo4j)
- After approval, write the fact into Neo4j
- If it replaces an old fact, add a `SUPERSEDES` link
- Do not overwrite old facts — keep history

## Recommended Build Order (Updated)

1. **Living README + Immediate Orientation** — Project context panel, decision log, open loops
2. **Explicit Save Point commands** — `@memory add:`, `@memory decision:`, `@memory constraint:`
3. **Groundedness + Provenance** — Score + evidence list
4. **TTL tiers + warm/cold** — Memory hygiene
5. **Mixed-initiative editing + supersedes UX** — HITL refinement
6. **Role-based lenses** — Dashboard views by role

## Next Steps (Priority Order)

1. **P0: Curator Queue Implementation** (2-3 days)
   - Build proposal queue for high-score memories
   - Implement duplicate/conflict/age checks
   - Create admin screen for human review

2. **P1: Living README + Orientation** (1 day)
   - Project orientation panel (`{group_id} / {project}`)
   - Immediate orientation view at session start
   - Decision log with SUPERSEDES links

3. **P2: Explicit Save Point Commands** (1 day)
   - Parse `@memory add:`, `@memory decision:`, `@memory constraint:`
   - Create queue items with `source=explicit_user`
   - Route through curator approval

4. **P2: Groundedness Metrics** (1 day)
   - Evidence coverage metric
   - Evidence list per response
   - Click-through to lineage

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
