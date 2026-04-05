# Course Correction: Agent Primitives from Claude Code Leak Analysis

> **Date:** 2026-04-05  
> **Trigger:** Video analysis — "I Broke Down Anthropic's $2.5 Billion Leak. Your Agent Is Missing 12 Critical Pieces"  
> **Impact:** High — Adds 3 critical missing primitives, strengthens 4 partial ones  
> **Status:** Approved for implementation
> **Audit:** [agent-primitives-audit.md](./agent-primitives-audit.md) — Full scorecard

---

## Executive Summary

Analysis of the Claude Code source leak (March 31, 2026) revealed **12 production primitives** that separate real agent systems from demos. Our current implementation covers 7 of these partially or fully, but is missing 3 critical pieces that block crash recovery and responsible operation.

**Core Finding:** Production agents are 80% plumbing, 20% model. We've been building the right foundation but need to add crash recovery, state persistence, and budget enforcement before scaling.

---

## What Changed

### New Primitives Added (Previously Missing)

| # | Primitive | Priority | Implementation Target |
|---|-----------|----------|----------------------|
| 3 | **Session Persistence** | P1 | `.opencode/state/session-{id}.json` |
| 4 | **Workflow State Machine** | P1 | PostgreSQL `workflow_states` table |
| 5 | **Token Budget Pre-Turn Checks** | P1 | MCP server budget middleware |

### Strengthened Primitives (Partial → Complete)

| # | Primitive | Before | After |
|---|-----------|--------|-------|
| 6 | **Structured Streaming Events** | Ad-hoc events | Typed event schema with crash-reason events |
| 8 | **Two-Level Verification** | Basic checks | Harness regression tests for config changes |
| 9 | **Dynamic Tool Pool Assembly** | Static loading | Session-specific tool assembly |
| 10 | **Transcript Compaction** | Manual curation | Auto-compaction with configurable thresholds |

---

## Detailed Changes

### 1. Session Persistence (NEW — P1)

**Problem:** If a session crashes mid-workflow, all state is lost. Every interruption is a restart.

**Solution:** Persist session state as JSON files that survive crashes.

**Implementation:**
```typescript
interface SessionState {
  session_id: string;
  agent_id: string;
  group_id: string;
  workflow_stage: 'planned' | 'discovering' | 'approved' | 'executing' | 'validating' | 'complete';
  token_usage: { input: number; output: number; turns: number };
  permissions_granted: string[];
  subagent_results: Record<string, any>;
  checkpoint_data: any;
  created_at: string;
  updated_at: string;
}
```

**Storage:** `.opencode/state/session-{id}.json`  
**Persistence Trigger:** After every significant event (stage transition, permission grant, subagent completion)

---

### 2. Workflow State Machine (NEW — P1)

**Problem:** We have a 7-stage workflow but don't persist state transitions. Conversation state ≠ workflow state.

**Solution:** Explicit state machine with checkpointed transitions in PostgreSQL.

**Implementation:**
```sql
CREATE TABLE workflow_states (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('planned', 'discovering', 'approved', 'executing', 'validating', 'complete', 'failed')),
  checkpoint_data JSONB,
  retry_safe BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**States:**
- `planned` → `discovering` → `approved` → `executing` → `validating` → `complete`
- Any state → `failed` (with error context)

**Key Principle:** "Save your workflow state like you saved your game every two seconds in the 1990s."

---

### 3. Token Budget Pre-Turn Checks (NEW — P1)

**Problem:** No hard limits on token consumption. Runaway loops can spend money unintentionally.

**Solution:** Pre-turn budget checks that stop execution before API calls if budget would be exceeded.

**Implementation:**
```typescript
interface TokenBudget {
  group_id: string;
  allocated: number;
  used: number;
  remaining: number;
  hard_stop: boolean;
  reset_at: string;
}

async function checkBudgetBeforeTurn(groupId: string): Promise<boolean> {
  const budget = await getBudget(groupId);
  if (budget.remaining < MIN_TURN_TOKENS) {
    await notifyBudgetExhausted(groupId);
    return false; // Stop execution before API call
  }
  return true;
}
```

**Key Principle:** "Anthropic puts in checks that are not beneficial to Anthropic, they're beneficial to the long-term health of the customer."

---

### 4. Structured Streaming Events (STRENGTHENED)

**Addition:** Crash-reason events as last streamed message ("black box" pattern).

```typescript
type AgentEvent = 
  | { type: 'message_start'; session_id: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; result: any; error?: string }
  | { type: 'budget_warning'; remaining: number }
  | { type: 'state_transition'; from: string; to: string }
  | { type: 'crash'; reason: string; context: any }; // NEW
```

---

### 5. Two-Level Verification (STRENGTHENED)

**Addition:** Level 2 — Verify harness changes don't break guardrails.

```typescript
// Level 1: Agent checks its own work (existing)
// Level 2: Verify config changes don't break guardrails (NEW)
interface HarnessVerification {
  test_name: string;
  guardrail: string;
  expected_behavior: string;
  test_fn: () => Promise<boolean>;
}

// Example tests:
// - "Destructive tools always require approval after config change"
// - "Token budget enforcement still works after config update"
// - "group_id validation still enforced after schema change"
```

---

### 6. Dynamic Tool Pool Assembly (STRENGTHENED)

**Addition:** Session-specific tool assembly based on mode flags, permission context, deny lists.

```typescript
async function assembleToolPool(sessionContext: SessionContext): Promise<Tool[]> {
  const allTools = await getToolRegistry();
  return allTools.filter(tool => 
    sessionContext.mode_flags.includes(tool.required_mode) &&
    sessionContext.permission_context >= tool.min_trust_tier &&
    !sessionContext.deny_list.includes(tool.name)
  );
}
```

---

### 7. Transcript Compaction (STRENGTHENED)

**Addition:** Auto-compaction with configurable thresholds, persistence tracking.

```typescript
interface CompactionConfig {
  turn_threshold: number;      // Compact after N turns
  token_threshold: number;     // Compact after N tokens
  keep_recent: number;         // Keep last N entries
  persist_before_compact: boolean; // Ensure persistence before compaction
}
```

---

## Implementation Priority

| Phase | Primitives | Timeline | Dependencies |
|-------|-----------|----------|--------------|
| **Phase 1** | Session Persistence, Workflow State | Week 1 | None |
| **Phase 2** | Token Budget, Streaming Events | Week 2 | Phase 1 |
| **Phase 3** | Two-Level Verification, Tool Pool | Week 3 | Phase 2 |
| **Phase 4** | Transcript Compaction | Week 4 | Phase 3 |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Session persistence adds latency | Low | Async writes, non-blocking |
| Workflow state machine complexity | Medium | Start with 5 core states, expand later |
| Budget enforcement breaks existing flows | High | Soft limits first, hard limits after testing |
| Tool pool assembly breaks skills | Medium | Fallback to full registry if assembly fails |

---

## Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Session recovery after crash | 100% | Test suite with simulated crashes |
| Workflow state persistence | All transitions | PostgreSQL audit log |
| Budget enforcement | Zero runaway sessions | Token usage monitoring |
| Crash-reason events | 100% of failures | Event log analysis |

---

## References

- [Video: "I Broke Down Anthropic's $2.5 Billion Leak"](https://www.youtube.com/watch?v=FtCdYhspm7w)
- [Agent Primitives Spec](./agent-primitives.md)
- [Architectural Brief](./architectural-brief.md)
- [Workflow State Spec](./workflow-state-spec.md)

---

## Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Owner | Sabir Asheed | ✅ Approved | 2026-04-05 |
| Architect | Winston (AI) | ✅ Approved | 2026-04-05 |
