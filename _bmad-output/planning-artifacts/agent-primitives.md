# Agent Primitives — Allura Agent-OS

> **Status:** Active — Course Correction Applied (2026-04-05)
> **Created:** 2026-04-05
> **Updated:** 2026-04-05
> **Priority:** P1
> **Source:** Notion Critical Path + Claude Code Leak Analysis
> **Course Correction:** [course-correction-agent-primitives.md](./course-correction-agent-primitives.md)
> **Audit:** [agent-primitives-audit.md](./agent-primitives-audit.md) — Full scorecard vs. Claude Code

---

## Overview

The 12 Agent Primitives define the foundational capabilities every agent must have. These are the building blocks that enable safe, observable, governable agent behavior.

---

## The 12 Primitives

### 1. Tool Registry (Metadata-First)

**Purpose:** Every tool is defined by its metadata manifest (`SKILL.md`), not just its implementation.

**Components:**
- Tool name and version
- Capability surface (what it can do)
- Permission requirements
- Input/output schemas
- Side effects declaration

**Implementation:**
```typescript
interface ToolManifest {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  permissions: Permission[];
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  sideEffects: SideEffect[];
}
```

**Status:** ✅ Implemented (OpenCode skills)

---

### 2. Permission System (3 Trust Tiers)

**Purpose:** Tools and skills operate at different trust levels.

**Tiers:**
| Tier | Level | Description |
|------|-------|-------------|
| 1 | Kernel | System-level operations, full access |
| 2 | Plugin | Workspace-scoped operations, group_id enforced |
| 3 | Skill | Task-scoped operations, approval gates |

**Implementation:**
```typescript
type TrustTier = 'kernel' | 'plugin' | 'skill';

interface Permission {
  tier: TrustTier;
  resource: string;
  action: 'read' | 'write' | 'execute';
  scope: 'global' | 'group' | 'session';
}
```

**Status:** ⏳ Partial (needs formal tiers)

---

### 3. Session Persistence

**Purpose:** Every agent session creates persistent, replayable artifacts that survive crashes.

**Artifacts:**
- `envelope.json` — Session metadata, agent identity, timestamps
- `steps.jsonl` — Line-delimited JSON of each step
- `verdict.json` — Final decision with confidence and evidence
- `session-state.json` — Full session state for crash recovery (NEW)

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

**Status:** ⏳ Partial (PostgreSQL events exist, need envelope/verdict/session-state)

---

### 4. Workflow State vs Conversation State

**Purpose:** Separate long-running workflow state from transient conversation state. **Critical for crash recovery.**

**Workflow State:**
- Persists across turns
- Survives restarts
- Checkpointed to PostgreSQL `workflow_states` table
- Explicit state machine: `planned` → `discovering` → `approved` → `executing` → `validating` → `complete`

**Conversation State:**
- Transient, in-memory
- Dies with session
- Not persisted

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

**Key Principle:** "A chat transcript answers 'what have we said?' A workflow state answers 'what step are we in?'"

**Status:** ❌ Not implemented (spec created, P1 priority — course correction)

---

### 5. Token Budget Pre-Turn Checks

**Purpose:** Prevent runaway token consumption. **Hard stops before API calls if budget exceeded.**

**Mechanism:**
- Before each turn, check remaining budget
- If budget exhausted, pause and notify — **stop execution before API call**
- Budget allocated per workspace
- Pre-turn projection prevents overspending

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

**Status:** ⏳ Partial (tracking exists, not enforced — course correction: add pre-turn checks)

---

### 6. Structured Streaming Events

**Purpose:** All agent outputs are typed events, not raw text. **Includes crash-reason "black box" events.**

**Event Types:**
- `message_start` — Session begins
- `reasoning_start` — Agent begins reasoning
- `reasoning_step` — Intermediate step
- `reasoning_end` — Reasoning complete
- `tool_call` — Tool invocation
- `tool_result` — Tool response
- `budget_warning` — Token budget running low
- `state_transition` — Workflow state changed
- `error` — Error occurred
- `decision` — Final decision
- `crash` — **NEW** Last event before failure, includes reason and context

**Implementation:**
```typescript
type AgentEvent = 
  | { type: 'message_start'; session_id: string }
  | { type: 'reasoning_start'; agent_id: string }
  | { type: 'reasoning_step'; content: string; confidence: number }
  | { type: 'reasoning_end'; result: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; result: any; error?: string }
  | { type: 'budget_warning'; remaining: number }
  | { type: 'state_transition'; from: string; to: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'decision'; verdict: string; confidence: number }
  | { type: 'crash'; reason: string; context: any }; // NEW — black box pattern
```

**Status:** ⏳ Partial (some events, need formal typing + crash-reason events)

---

### 7. System Event Logging

**Purpose:** Every agent action is logged to `events` table in PostgreSQL.

**Schema:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  content JSONB NOT NULL,
  confidence NUMERIC(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation:** ✅ Implemented

**Status:** ✅ Implemented

---

### 8. Two-Level Verification

**Purpose:** Critical operations require two passes: run + harness. **Level 2 verifies harness changes don't break guardrails.**

**Flow:**
1. Agent runs operation
2. Harness verifies preconditions
3. Harness commits result
4. **NEW:** Harness regression tests verify config changes don't break guardrails

**Implementation:**
```typescript
// Level 1: Agent checks its own work (existing)
async function twoLevelVerify<T>(
  operation: () => Promise<T>,
  validator: (result: T) => Promise<boolean>
): Promise<T> {
  const result = await operation();
  const isValid = await validator(result);
  if (!isValid) {
    throw new VerificationError('Harness validation failed');
  }
  return result;
}

// Level 2: Verify harness changes don't break guardrails (NEW)
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

**Status:** ⏳ Partial (PostgreSQL triggers exist, need harness regression tests)

---

### 9. Dynamic Tool Pool Assembly

**Purpose:** Each session gets a customized tool pool based on mode flags, permission context, and deny lists.

**Mechanism:**
- Tools filtered by workspace permissions
- Tools filtered by behavior spec
- Tools assembled at session start based on context
- **NEW:** Mode flags, trust tiers, and deny lists drive assembly

**Implementation:**
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

**Status:** ❌ Not implemented (course correction: add session-specific assembly)

---

### 10. Transcript Compaction

**Purpose:** Agent turns are compacted by Curator Agent, promoted to Neo4j. **Auto-compaction with configurable thresholds.**

**Mechanism:**
- High-frequency: PostgreSQL raw traces
- Low-frequency: Curator proposes insights
- Approved insights → Neo4j
- **NEW:** Auto-compaction after configurable turn/token thresholds

**Implementation:**
```typescript
interface CompactionConfig {
  turn_threshold: number;      // Compact after N turns
  token_threshold: number;     // Compact after N tokens
  keep_recent: number;         // Keep last N entries
  persist_before_compact: boolean; // Ensure persistence before compaction
}

interface TranscriptCompaction {
  session_id: string;
  raw_traces: PostgresTrace[];
  proposed_insight: Neo4jInsight;
  curator_confidence: number;
  auditor_approval: boolean;
}
```

**Status:** ⏳ Partial (PostgreSQL → Notion exists, need Neo4j + auto-compaction)

---

### 11. Permission Audit Trail

**Purpose:** Every permission check is logged.

**Handler Types:**
1. `allow` — Permission granted
2. `deny` — Permission denied
3. `escalate` — Needs human approval

**Schema:**
```sql
CREATE TABLE permission_audit (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  permission_level TEXT NOT NULL,
  handler_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ❌ Not implemented

---

### 12. Six Agent Types (Constrained Roles)

**Purpose:** Only specific agent types can be instantiated.

**Types:**
| Type | Role | Constraints |
|------|------|-------------|
| Curator | Knowledge curator | Can propose, not approve |
| Auditor | HITL approver | Can approve/reject, not create |
| Builder | Implementation | Can write code, not approve |
| Tester | Validation | Can test, not deploy |
| Architect | Design | Can design, not implement |
| Orchestrator | Coordination | Can delegate, not execute |

**Status:** ⏳ Partial (7 Memory{Role} exist, need constraint enforcement)

---

## Implementation Priority

| Primitive | Priority | Blocks | Status |
|-----------|----------|--------|--------|
| Tool Registry | P2 | Skills | ✅ Done |
| Permission System | P1 | All | ⏳ Partial |
| Session Persistence | P1 | Crash recovery | ⏳ Partial — course correction |
| Workflow State | P1 | Epic 1 | ❌ P1 — course correction |
| Token Budget | P1 | Budget control | ⏳ Partial — pre-turn checks added |
| Structured Events | P2 | Observability | ⏳ Partial — crash events added |
| System Logging | P2 | Audit trail | ✅ Done |
| Two-Level Verify | P2 | Safety | ⏳ Partial — harness tests added |
| Dynamic Tool Pool | P2 | Permission | ❌ Pending — session assembly added |
| Transcript Compaction | P2 | Memory | ⏳ Partial — auto-compaction added |
| Permission Audit | P3 | Governance | ❌ Pending |
| Agent Types | P3 | Architecture | ⏳ Partial |

### Course Correction Phases

| Phase | Primitives | Timeline | Dependencies |
|-------|-----------|----------|--------------|
| **Phase 1** | Session Persistence, Workflow State | Week 1 | None |
| **Phase 2** | Token Budget, Streaming Events | Week 2 | Phase 1 |
| **Phase 3** | Two-Level Verification, Tool Pool | Week 3 | Phase 2 |
| **Phase 4** | Transcript Compaction | Week 4 | Phase 3 |

---

## References

- [PRD v2 — 12 Primitives](../planning-artifacts/prd-v2.md)
- [Architectural Brief](../planning-artifacts/architectural-brief.md)
- [Workflow State Spec](./workflow-state-spec.md)
- [Course Correction: Claude Code Leak Analysis](./course-correction-agent-primitives.md)
- [Video: "I Broke Down Anthropic's $2.5 Billion Leak"](https://www.youtube.com/watch?v=FtCdYhspm7w)