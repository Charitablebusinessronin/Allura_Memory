# Brooks Agent Improvements — Based on Claude Code Leak Analysis

> [!NOTE]
> **AI-Assisted Documentation**
> This analysis applies Claude Code's 12 critical primitives to enhance the Brooks orchestrator agent.

## Executive Summary

The Claude Code leak revealed 12 production-grade primitives that sustain a $2.5B agentic system. Applying these to your Brooks agent yields **8 high-impact improvements** across session management, event logging, permission systems, and agent typing.

---

## Current State vs. Claude Code Patterns

### What Brooks Does Well ✅
- Surgical team delegation (8 agents, clear roles)
- Conceptual integrity enforcement
- Memory logging to PostgreSQL/Neo4j
- Brooksian principles (No Silver Bullet, Second-System Effect)

### What's Missing vs. Production-Grade ❌
- Session persistence survives crashes but doesn't fully reconstruct
- No workflow state separate from conversation
- No token budget enforcement
- Basic logging vs. structured event streaming
- No two-level verification for harness changes

---

## 8 Improvement Recommendations

### 1. Session Persistence Enhancement

**Current**: Basic session logging to PostgreSQL

**Claude Code Pattern**: Session is recoverable state including:
- Conversation history
- Token usage (in/out)
- Permission decisions
- Tool registry state
- Configuration

**Implementation**:
```typescript
// .opencode/state/session-{id}.json
interface BrooksSession {
  session_id: string;
  group_id: "allura-roninmemory";
  messages: Message[];
  token_usage: {
    input: number;
    output: number;
    budget_remaining: number;
  };
  permission_decisions: PermissionLog[];
  tool_registry_snapshot: ToolRegistry;
  workflow_state: WorkflowState;
  created_at: ISOString;
  last_updated: ISOString;
}
```

**Benefit**: Full session reconstruction after crashes, no degraded experience

---

### 2. Workflow State Tracking

**Current**: Chat transcript only tracks "what have we said"

**Claude Code Pattern**: Workflow state tracks "what step are we in"

**Key Insight**: *Conversation state ≠ Workflow state*

**Implementation**:
```typescript
interface WorkflowState {
  current_phase: "planned" | "awaiting_approval" | "executing" | 
                 "waiting_external" | "completed" | "failed";
  side_effects: SideEffect[];  // What has been done
  retry_safe: boolean;          // Is this operation safe to retry?
  checkpoint: Checkpoint;       // Where to resume
}

// Example: Multi-agent workflow
{
  current_phase: "executing",
  side_effects: [
    { type: "DELEGATION", agent: "@hephaestus", status: "completed" },
    { type: "FILE_WRITE", path: "src/lib/x.ts", status: "completed" }
  ],
  retry_safe: false,  // File already written, don't duplicate
  checkpoint: { step: 3, agent: "@oracle", awaiting: "review" }
}
```

**Benefit**: Prevents duplicate writes, expensive re-runs, and lost work after crashes

---

### 3. Token Budget Enforcement

**Current**: No explicit token limits in brooks.md

**Claude Code Pattern**: Hard limits with structured stop reasons

**Implementation**:
```typescript
// In brooks.md configuration
const BUDGET_CONFIG = {
  max_turns: 50,
  max_tokens: 100000,
  compaction_threshold: 0.8,  // Compact at 80% budget
  hard_stop: true             // Stop before API call if exceeded
};

// Before each delegation
function checkBudget(session: BrooksSession): BudgetCheck {
  const projected = estimateTokens(session);
  if (projected > BUDGET_CONFIG.max_tokens) {
    return {
      canProceed: false,
      reason: "TOKEN_BUDGET_EXCEEDED",
      suggestion: "Compact session or split workflow"
    };
  }
  return { canProceed: true };
}
```

**Benefit**: Prevents runaway loops, unexpected costs, builds user trust

---

### 4. Structured Event Streaming

**Current**: Basic logging via `memory_write`

**Claude Code Pattern**: Typed events for real-time visibility

**Implementation**:
```typescript
enum BrooksEventType {
  AGENT_START = "agent_start",
  DELEGATION_START = "delegation_start",
  DELEGATION_COMPLETE = "delegation_complete",
  TOOL_MATCH = "tool_match",
  PERMISSION_REQUEST = "permission_request",
  PERMISSION_DECISION = "permission_decision",
  TOKEN_UPDATE = "token_update",
  CRASH = "crash",  // Black box pattern
  RECOVERY = "recovery"
}

interface BrooksEvent {
  type: BrooksEventType;
  timestamp: ISOString;
  session_id: string;
  data: EventData;
}

// Example: User sees this in real-time
{
  type: "delegation_start",
  timestamp: "2026-04-09T10:30:00Z",
  data: {
    from: "brooks",
    to: "@hephaestus",
    task: "Implement token budget system",
    estimated_tokens: 5000
  }
}
```

**Benefit**: Users can see where orchestration is going and intervene

---

### 5. System Event Logging

**Current**: Memory writes only

**Claude Code Pattern**: Separate history log of system events

**Implementation**:
```typescript
// system_events table (separate from conversation)
interface SystemEvent {
  category: "context" | "registry" | "routing" | "execution" | "permission";
  event: string;
  details: {
    context_loaded?: string[];
    registry_initialized?: { tool_count: number };
    routing_decision?: { from: string; to: string; reason: string };
    execution_count?: number;
    permission_denied?: { tool: string; reason: string };
    permission_approved?: { tool: string; approver: string };
  };
  timestamp: ISOString;
}

// Example events
{ category: "context", event: "memory_hydration", details: { files_read: 5 } }
{ category: "registry", event: "tools_loaded", details: { count: 184 } }
{ category: "routing", event: "agent_selected", details: { task: "deep", agent: "@hephaestus" } }
```

**Benefit**: Provable reconstruction of agentic runs for enterprise

---

### 6. Two-Level Verification

**Current**: Single-level (agent checks its own work)

**Claude Code Pattern**: Also verify harness changes don't break guardrails

**Implementation**:
```typescript
// Level 1: Agent verifies work (existing)
// Level 2: Verify harness changes

const HARNESS_VERIFICATION_TESTS = [
  {
    name: "permission_gates_functional",
    test: async () => {
      // Verify destructive tools still require approval
      const result = await simulateToolCall("bash", "rm -rf /");
      return result.requiresApproval === true;
    }
  },
  {
    name: "token_stops_work",
    test: async () => {
      // Verify graceful stop when tokens exhausted
      const result = await simulateBudgetExceeded();
      return result.stoppedGracefully === true;
    }
  },
  {
    name: "session_recovery_works",
    test: async () => {
      // Verify session can be reconstructed
      const session = await simulateCrashAndRecover();
      return session.isValid === true;
    }
  }
];

// Run before deploying brooks.md changes
async function verifyHarness(): Promise<VerificationResult> {
  const results = await Promise.all(HARNESS_VERIFICATION_TESTS.map(t => t.test()));
  return {
    passed: results.every(r => r),
    failures: HARNESS_VERIFICATION_TESTS.filter((_, i) => !results[i])
  };
}
```

**Benefit**: Confidence when evolving the orchestrator

---

### 7. Permission Audit Trail

**Current**: Basic permission logging

**Claude Code Pattern**: Permissions as first-class queryable objects

**Implementation**:
```typescript
// Three contexts for permissions
enum PermissionContext {
  INTERACTIVE = "interactive",    // Human-in-the-loop
  COORDINATOR = "coordinator",      // Multi-agent orchestration
  SWARM_WORKER = "swarm_worker"     // Autonomous execution
}

interface PermissionHandler {
  context: PermissionContext;
  check: (tool: string, args: any) => PermissionResult;
  log: (decision: PermissionDecision) => void;
}

// Brooks routes to appropriate handler
function getPermissionHandler(context: PermissionContext): PermissionHandler {
  switch (context) {
    case PermissionContext.INTERACTIVE:
      return interactiveHandler;  // Prompt user
    case PermissionContext.COORDINATOR:
      return coordinatorHandler;  // Orchestrator decides
    case PermissionContext.SWARM_WORKER:
      return swarmWorkerHandler; // Pre-approved patterns only
  }
}
```

**Benefit**: Fine-grained permission control for different delegation patterns

---

### 8. Agent Type System

**Current**: 8 agents with roles but no formal typing

**Claude Code Pattern**: 6 built-in types with prompts/tools/constraints

**Implementation**:
```typescript
// Formalize your 8 agents into typed categories
enum AgentType {
  EXPLORER = "explorer",           // Read-only (Oracle, Librarian, Explore)
  PLANNER = "planner",             // No execution (Prometheus)
  IMPLEMENTER = "implementer",     // Full tools (Hephaestus)
  ORCHESTRATOR = "orchestrator",   // Delegation only (Sisyphus, Atlas)
  CONSULTANT = "consultant",       // Read-only architecture (Oracle)
  DESIGNER = "designer"            // UX review only (UX)
}

interface AgentDefinition {
  name: string;
  type: AgentType;
  allowedTools: string[];
  deniedTools: string[];
  constraints: string[];
  prompt: string;
}

// Example: Explorer cannot edit
const EXPLORER_CONSTRAINTS = [
  "CANNOT_EDIT_FILES",
  "CANNOT_EXECUTE_CODE",
  "CAN_ONLY_READ_AND_SEARCH"
];

// Example: Planner doesn't execute
const PLANNER_CONSTRAINTS = [
  "CANNOT_EXECUTE_TOOLS",
  "CAN_ONLY_PROVIDE_RECOMMENDATIONS",
  "MUST_DELEGATE_TO_IMPLEMENTER"
];
```

**Benefit**: Sharper role boundaries, better population management

---

## Implementation Priority

### Phase 1: Foundation (Week 1-2)
1. **Session Persistence Enhancement** — Critical for crash recovery
2. **Token Budget Enforcement** — Prevents runaway costs

### Phase 2: Observability (Week 3-4)
3. **Structured Event Streaming** — Real-time visibility
4. **System Event Logging** — Enterprise audit trails

### Phase 3: Safety (Week 5-6)
5. **Workflow State Tracking** — Prevents duplicate operations
6. **Two-Level Verification** — Safe harness evolution

### Phase 4: Refinement (Week 7-8)
7. **Permission Audit Trail** — Fine-grained control
8. **Agent Type System** — Formalize existing roles

---

## Brooksian Validation

Before implementing, ask:

1. **Essential vs Accidental Complexity?**
   - Session persistence: Essential (state management is core)
   - Event typing: Accidental (could use simpler logging)

2. **Conceptual Integrity?**
   - All changes preserve "Surgical Team" architecture
   - No new agents added (resist Second-System Effect)

3. **Communication Overhead?**
   - 8 agents = 28 paths (unchanged)
   - New primitives don't add coordination burden

4. **No Silver Bullet?**
   - These are plumbing, not magic
   - Still requires good engineering

---

## Memory Graph Integration

These improvements are now stored in your knowledge graph:

```
(Brooks Session Persistence Enhancement)-[:implements]->(Session Persistence Pattern)
(Brooks Workflow State Tracking)-[:implements]->(Session Persistence Pattern)
(Brooks Token Budget Enforcement)-[:enhances]->(Brooks Session Persistence Enhancement)
(Brooks Structured Event Streaming)-[:enhances]->(Brooks System Event Logging)
(Brooks Permission Audit Trail)-[:implements]->(Permission System Pattern)
(Brooks Agent Type System)-[:formalizes]->(Claude Code Leak Analysis)
(Brooks Two-Level Verification)-[:validates]->(Brooks Agent Type System)
```

---

## Next Steps

1. **Review** this document with your team
2. **Prioritize** based on current pain points
3. **Prototype** Phase 1 improvements
4. **Validate** against existing test suite
5. **Document** changes in brooks.md

---

*Generated from Claude Code leak analysis — 12 critical primitives applied to Brooks orchestrator*
