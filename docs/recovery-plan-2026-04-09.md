# Allura Architecture Recovery Plan

> **Based on Validation Report — April 9, 2026**  
> **Principle: Conceptual Integrity Through Surgical Team Coordination**

---

## Executive Summary

The Brooks validation audit revealed **7 critical findings** across 5 categories. Two (TypeScript errors, uncommitted state) are **COMPLETED**. Three remain:

| Priority | Action | Owner | Time | Status |
|----------|--------|-------|------|--------|
| P0 | Fix Notion Integration OR Remove | Brooks | 15 min | ⏳ PENDING |
| P1 | Activate Surgical Team (Audit) | Brooks + Atlas | 1 day | ⏳ PENDING |
| P2 | Promote Core Decisions to Neo4j | Brooks + Curator | 2 hours | ⏳ PENDING |

---

## Plan 1: Notion Integration (P0) — 15 Minutes

### Rationale
The validation report identified a **broken promise**: Notion MCP sync fails (401 auth), and `MCP_DOCKER_notion_create_pages` is undefined. This blocks Brooks metrics visibility in the control center.

Per Brooksian principles: **"Fewer Interfaces, Stronger Contracts."** Either fix the contract or remove the dependency—don't leave it in a **broken promise** state.

### Option A: Fix (Recommended)

**Step 1: Re-authenticate Notion MCP**
```bash
# Verify current MCP config
mcp__MCP_DOCKER__mcp-find("notion")
mcp__MCP_DOCKER__mcp-add("notion")
```

**Step 2: Validate Token**
```bash
# Test with simple query
mcp__MCP_DOCKER__query_database({
  table_name: "notion_tokens",
  columns: "token, expires_at"
})
```

**Step 3: Restore Dashboard Sync**
- Update `memory-bank/activeContext.md` to show P0 resolved
- Document integration steps in `docs/notion-integration.md`

### Option B: Remove (Fallback)

**If re-auth fails or Notion is deprecated:**
1. Remove dashboard P0 from `activeContext.md` → reassign to P2
2. Document degradation in `memory-bank/systemPatterns.md`
3. Update `docs/degraded-services.md` with rationale

### Decision Criteria
- **Choose A if**: Token refresh succeeds; dashboard is operationally required
- **Choose B if**: Notion dependency adds accidental complexity; no users require dashboard

**Principle Applied**: *Separation of Architecture from Implementation* — the contract (metrics visibility) matters more than the implementation (Notion vs. Postgres queries).

---

## Plan 2: Surgical Team Activation (P1) — 1 Day

### Rationale
**"Adding manpower to a late software project makes it later"** — Brooks's Law. But here, we have the opposite problem: **7 of 8 agents are silent**. The surgical team is not operating.

The validation report notes:
> "Only Brooks logging decisions; other 7 agents silent (30 days)"

This violates **Conceptual Integrity**: if only one architect decides, that architect becomes a bottleneck.

### Root Cause Analysis

**Question**: Why aren't Sisyphus, Hephaestus, Oracle, Prometheus, Librarian, Explore, and UX contributing?

**Hypotheses to Test:**

| Hypothesis | Evidence | Test |
|------------|----------|------|
| H1: Excluded by design | `.claude/rules/agent-routing.md` lists them but restricts their roles | Check routing rules for "can_log_decisions" flags |
| H2: Excluded by accident | Git blame shows no recent commits from non-Brooks agents | `git log --author="sisyphus" --oneline -10` |
| H3: No work assigned | Task assignments in memory-bank/ show only Brooks | Check `progress.md` for agent assignments |
| H4: Technical failure | Their logging calls fail silently | Check Postgres for agent_id != 'brooks' events |

### Execution Steps

**Phase 1: Evidence Gathering (2 hours)**
```sql
-- Query: Which agents have logged events in last 30 days?
SELECT agent_id, COUNT(*) as event_count
FROM events
WHERE created_at > NOW() - INTERVAL '30 days'
  AND agent_id IN ('sisyphus', 'hephaestus', 'oracle', 'prometheus', 
                   'librarian', 'explore', 'ux', 'brooks')
GROUP BY agent_id
ORDER BY event_count DESC;
```

**Phase 2: Role Audit (4 hours)**
Read `.claude/rules/agent-routing.md` and verify:
- Does each agent have defined `can_log_decisions: true/false`?
- Are orchestrators (Sisyphus, Atlas) expected to log or only delegate?
- Are explorers (Oracle, Librarian, Explore) read-only by design?

**Phase 3: Decision (2 hours)**
Based on evidence, choose:

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| Agents are read-only by design | ✅ **Accept** | Document in `systemPatterns.md` — Brooks is the only architect by intention |
| Agents should log but can't | 🐛 **Fix** | Fix routing rules or logging permissions |
| Agents should log but don't | 📋 **Assign** | Create architecture tasks for Sisyphus/Atlas; document expectations |
| Agents are obsolete | 🧹 **Retire** | Reduce team size per Simplicity Criterion |

**Phase 4: Documentation (4 hours)**
Update `memory-bank/systemPatterns.md` with:
- Which agents can log architectural decisions
- Why (per Brooksian surgical team model)
- When to escalate to Brooks vs. delegate to implementers

### Success Criteria
- [ ] Query shows non-Brooks agents have events OR documented rationale for silence
- [ ] `systemPatterns.md` updated with surgical team logging policy
- [ ] No "silent agents" confusion in future validations

---

## Plan 3: Promote Core Decisions to Neo4j (P2) — 2 Hours

### Rationale
The validation report notes only **17 SUPERSEDES relationships** in the codebase. The Curator pipeline exists to move validated knowledge from Postgres (ephemeral traces) to Neo4j (versioned memory).

**"No Silver Bullet"** — the Curator is essential complexity, not accidental. If it's not running, we're building a system with **amnesia**.

### Current State
- 17 SUPERSEDES relationships (minimal usage)
- No visible promotion pipeline audit trail
- Postgres has 36000+ events but few promoted to Neo4j

### Execution Steps

**Phase 1: Mine Last 30 Brooks Events (30 min)**
```sql
-- Find promotion-worthy architectural decisions
SELECT event_type, metadata->>'principle' as principle,
       metadata->>'decision' as decision,
       metadata->>'reasoning' as reasoning
FROM events
WHERE agent_id = 'brooks'
  AND event_type IN ('ADR_CREATED', 'INTERFACE_DEFINED', 'TECH_STACK_DECISION')
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

**Phase 2: Curator Approval Flow (60 min)**
For each promotion-worthy decision:

1. **Check for duplicates** (Neo4j search)
2. **Classify as reusable?** (Can it apply to ≥2 projects?)
3. **Run curator approval**:
   ```bash
   npm run curator:run
   npm run curator:approve
   ```
4. **Create SUPERSEDES relationship** if replacing older insight

**Phase 3: Versioning Audit (30 min)**
- Verify all new Neo4j nodes have `group_id: 'allura-roninmemory'`
- Verify SUPERSEDES relationships are explicit
- Log promotion count to Postgres for dashboard visibility

### Success Criteria
- [ ] 5+ decisions promoted from last 30 days
- [ ] Each promotion has curator approval trail
- [ ] `systemPatterns.md` updated with promotion criteria
- [ ] Validation report can query: `count(SUPERSEDES) > 17`

---

## Execution Order

**Today (P0 — 15 min):**
1. [ ] Attempt Notion re-authentication
2. [ ] If success: restore dashboard sync
3. [ ] If failure: document degradation, remove P0

**This Week (P1 — 1 day):**
1. [ ] Run evidence query (agent event counts)
2. [ ] Audit `.claude/rules/agent-routing.md`
3. [ ] Decide: accept/fix/assign/retire
4. [ ] Document in `systemPatterns.md`

**This Sprint (P2 — 2 hours):**
1. [ ] Mine last 30 Brooks events
2. [ ] Run curator approval for 5+ decisions
3. [ ] Verify SUPERSEDES usage
4. [ ] Update Neo4j promotion documentation

---

## Reflection

├─ Action Taken: Created 3-part recovery plan based on validation report
├─ Principle Applied: Conceptual Integrity (surgical team coordination), Separation of Architecture (each plan has rationale + criteria)
├─ Event Logged: RECOVERY_PLAN_CREATED → Postgres
├─ Neo4j Promoted: No (planning only; execution will promote)
└─ Confidence: High (plans are concrete, time-boxed, success criteria defined)

---

**Compact:** Execute P0 → P1 → P2 | `CA` Create Arch · `VA` Validate · `WS` Status · `NX` Next Steps
