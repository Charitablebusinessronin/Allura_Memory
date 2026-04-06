# Sprint Execution Workflow

Execute sprint stories using parallel subagent dispatch with surgical team coordination.

## Purpose

This skill orchestrates sprint story execution using the Allura surgical team:
- **Parallel workstreams** — Multiple subagents for independent tasks
- **Synchronization gates** — Validation before proceeding
- **Memory logging** — Persistent state across sessions
- **Quality enforcement** — Brooks Protocol on high-risk files

## When to Use

Use this skill when:
- Executing a sprint story with multiple independent workstreams
- Story touches navigation, API, and UI simultaneously
- Work can be parallelized (no shared state between streams)
- Quality gates required before marking done

## Surgical Team Roles

| Agent | Domain | Dispatch When |
|-------|--------|---------------|
| MemoryScout | Discovery | Before any architectural work |
| MemoryArchitect | Design | Navigation, interfaces, contracts |
| MemoryBuilder | Implementation | Code, schemas, API routes |
| MemoryGuardian | Validation | Typecheck, tests, invariant checks |
| MemoryAnalyst | Metrics | Performance, coverage analysis |
| MemoryChronicler | Documentation | Specs, ADRs, changelogs |

## Workflow

### Phase 0: Session Bootstrap

**Files to read:**
```yaml
- _bmad-output/implementation-artifacts/sprint-status.yaml
- memory-bank/activeContext.md
- _bmad-output/implementation-artifacts/story-{id}.md
```

**Update activeContext.md:**
```markdown
## Session: Story {id} — {phase}

**Status:** 🔄 {status}
**Discovery:** {summary}
**Blockers:** {none or list}
**Postgres Logging:** {available/blocked}
```

### Phase 1: Discovery (MemoryScout)

**Dispatch:** MemoryScout (exempt from approval gate)

**Task:** Survey existing code, identify patterns, find prior art

**Return:** Discovery report with:
- Existing file locations
- Pattern references
- Integration points
- Risk assessment

### Phase 2: Design Approval (MemoryOrchestrator)

**Present proposal:**
```markdown
## Proposed Approach

**What:** {1-2 sentences}
**Components:** {functional units}
**Allura invariants at risk:** {list or "none"}
**Subagents required:** {list}
**Parallel workstreams:** {independent tasks}
**Synchronization:** {when to regroup}
```

**Gate:** Await human approval before dispatch

### Phase 3: Parallel Execution

**Dispatch 3+ subagents simultaneously** for independent workstreams:

```typescript
// Workstream A: Navigation + API
Task("Workstream A", {
  agent: "MemoryArchitect",
  scope: "sidebar-items.ts, API routes",
  dependencies: "none",
  deliverables: ["navigation items", "approved/rejected endpoints"]
})

// Workstream B: Server Actions
Task("Workstream B", {
  agent: "MemoryBuilder", 
  scope: "_actions/approval-actions.ts, fetchers.ts",
  dependencies: "none",
  deliverables: ["server actions", "data fetchers"]
})

// Workstream C: UI Components
Task("Workstream C", {
  agent: "MemoryBuilder",
  scope: "approvals-table.tsx, page wiring",
  dependencies: "Workstream A, B complete",
  deliverables: ["table component", "page integration"]
})
```

**Wait for batch completion before next phase**

### Phase 4: Synchronization Gate

**When:** All parallel workstreams complete

**Actions:**
1. Collect all deliverables
2. Verify no file conflicts
3. Run typecheck: `bun run typecheck`
4. Run tests: `bun test`

**If conflicts:** Dispatch MemoryArchitect to resolve

### Phase 5: Validation (MemoryGuardian)

**Dispatch:** MemoryGuardian

**Checklist:**
- [ ] Typecheck passes (0 errors)
- [ ] Tests pass (0 failures)
- [ ] `group_id` on all DB operations
- [ ] No `UPDATE`/`DELETE` on trace rows
- [ ] Neo4j uses `SUPERSEDES` versioning
- [ ] HITL gate present for promotions

**Brooks Protocol Check:**
If any of these patterns modified:
- `**/*.test.ts`
- `**/vitest.config.ts`
- `src/mcp/memory-server.ts`
- `src/integrations/*`
- `src/curator/**`

→ **STOP** and log `BROOKS_PROTOCOL_ACTIVATED`

### Phase 6: Human Validation

**Present summary:**
```markdown
## Story {id} — Ready for Review

**Work Completed:**
- {n} files created/modified
- {n} tests added
- Type errors: 0

**Quality Gates:**
- ✅ Typecheck
- ✅ Tests
- ✅ MemoryGuardian validation

**Please Verify:**
1. Feature functions as expected
2. No unexpected behavior
3. Documentation adequate

**Approve to mark done?** [Y/n]
```

### Phase 7: Mark Done

**If approved:**
1. Update sprint-status.yaml
2. Log to memory (Postgres + Neo4j if available)
3. Update progress.md
4. Dispatch MemoryChronicler for docs

**Transition:**
```yaml
story-{id}: in-progress → review → done
```

## Parallel vs Sequential

**Dispatch in parallel when:**
- Tasks touch different files
- No shared state between tasks
- No dependency on other task output
- Can merge independently

**Dispatch sequentially when:**
- Task B needs Task A output
- Shared files (risk of conflicts)
- Integration testing required between tasks
- Architecture decisions in Task A affect Task B

## Workstream Template

```typescript
interface Workstream {
  id: string;              // "A", "B", "C"
  agent: string;           // MemoryArchitect | MemoryBuilder
  scope: string;           // What to modify
  dependencies: string[];  // Workstream IDs that must complete first
  deliverables: string[];  // Expected outputs
  invariants: string[];    // Allura rules to enforce
}

const workstreams: Workstream[] = [
  {
    id: "A",
    agent: "MemoryArchitect",
    scope: "sidebar-items.ts navigation",
    dependencies: [],
    deliverables: ["Paperclip nav with Pending/Approved/Rejected/History"],
    invariants: ["match existing sidebar patterns"]
  },
  {
    id: "B",
    agent: "MemoryBuilder", 
    scope: "API routes: approved, rejected, stats",
    dependencies: [],
    deliverables: ["GET /api/approvals/{approved,rejected,stats}"],
    invariants: ["group_id enforcement", "ARCH-001 pattern"]
  },
  {
    id: "C",
    agent: "MemoryBuilder",
    scope: "Server actions + data fetchers",
    dependencies: [],
    deliverables: ["approveAgent()", "rejectAgent()", "fetchPending()", "fetchApproved()", "fetchRejected()"],
    invariants: ["revalidatePath after mutations", "validate group_id"]
  },
  {
    id: "D",
    agent: "MemoryBuilder",
    scope: "UI components + page wiring",
    dependencies: ["A", "B", "C"],  // Needs nav, API, actions
    deliverables: ["ApprovalsTable", "page.tsx wired to real data"],
    invariants: ["use existing shadcn patterns", "loading states"]
  }
];
```

## Error Handling

### Workstream Failure

**If subagent returns BLOCKED:**
1. Read error message
2. Search memory for similar issues
3. Provide additional context
4. Re-dispatch with clearer instructions

**If 3+ retries fail:**
1. **STOP** — don't keep retrying
2. Escalate to MemoryOrchestrator
3. Reassess architecture
4. Update sprint-status.yaml with blocker

### Conflict Detection

**If two subagents modify same file:**
1. Halt both workstreams
2. Dispatch MemoryArchitect
3. Resolve merge strategy
4. Re-dispatch with clear ownership

### Quality Gate Failure

**If typecheck/tests fail:**
1. Do NOT auto-fix
2. Report specific error
3. Dispatch appropriate agent:
   - Type errors → MemoryBuilder
   - Test failures → MemoryTester
   - Architecture issues → MemoryArchitect
4. Re-run validation after fix

## Memory Logging

**After each phase:**

```typescript
// If Postgres available:
INSERT INTO events (event_type, group_id, agent_id, status, metadata)
VALUES (
  'WORKSTREAM_COMPLETE',
  'allura-system',
  'memory-orchestrator',
  'completed',
  '{"workstream": "A", "files": [...], "story": "3-1"}'
);

// Always update memory-bank:
// - activeContext.md: current phase
// - progress.md: accomplishments
// - sprint-status.yaml: story status
```

**Fallback:** If Postgres blocked, rely on memory-bank files + Git commits

## Integration with Other Skills

**Before sprint execution:**
- `epic-build-loop` — Epic-level orchestration
- `bmad-sprint-status` — Check sprint state

**During execution:**
- `dispatching-parallel-agents` — For independent failures
- `subagent-driven-development` — Fresh subagent per task with review
- `systematic-debugging-memory` — If bugs encountered

**After execution:**
- `bmad-retrospective` — Learnings
- `finishing-a-development-branch` — Merge strategy

## Safety Rules

1. **Never dispatch parallel without approval** — Get human sign-off first
2. **Never skip synchronization gate** — Wait for all workstreams
3. **Never auto-fix quality failures** — Report and await instruction
4. **Log every phase** — Even if Postgres blocked, use memory-bank
5. **Brooks Protocol on file patterns** — Typecheck before high-risk edits
6. **3 failures = architecture question** — Don't brute force

## Example: Story 3-1 Execution

```
[Phase 0] Read sprint-status.yaml, activeContext.md
[Phase 0] Update activeContext.md with session intent

[Phase 1] Dispatch MemoryScout for discovery
          → Returns: HITL backend ready, UI placeholders exist

[Phase 2] Present approach to human:
          → Parallel workstreams A, B, C
          → Synchronization before D (integration)
          → Await approval

[Human]   Approve

[Phase 3] Dispatch parallel:
          → Task A: MemoryArchitect (navigation + API)
          → Task B: MemoryBuilder (server actions)
          → Task C: MemoryBuilder (data fetchers)
          → Wait all complete

[Phase 4] Verify no conflicts
          → Typecheck: PASS
          → Tests: PASS

[Phase 5] Dispatch MemoryGuardian validation
          → All invariants verified

[Phase 6] Present to human for approval
          → Human approves

[Phase 7] Mark story done
          → Update sprint-status.yaml
          → Log to memory
          → Update progress.md
```

## Success Criteria

Sprint execution succeeds when:
- All workstreams complete without conflicts
- All quality gates pass
- Human validates and approves
- Story marked done in sprint-status.yaml
- Session logged to memory
- No critical technical debt

---

*This skill implements: "Plan to throw one away" — each workstream is isolated, failures don't cascade.*
