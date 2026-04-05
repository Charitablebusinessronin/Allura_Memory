# Workflow State Spec — Allura Agent-OS

> **Status:** Draft
> **Created:** 2026-04-05
> **Priority:** P1
> **Blocks:** Agent runtime safety

---

## Overview

WorkflowState defines crash-safe agent lifecycle states. Every agent execution has a persistent state machine that survives restarts, crashes, and resumptions.

---

## Problem Statement

Without WorkflowState:
- Agent executions lose context on crash
- Impossible to resume interrupted workflows
- No audit trail of state transitions
- Race conditions in multi-agent scenarios

---

## State Machine

### Core States

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW LIFECYCLE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐                                                │
│  │ PENDING │ ◄── Created but not started                   │
│  └────┬────┘                                                │
│       │ start()                                             │
│       ▼                                                      │
│  ┌─────────┐                                                │
│  │ RUNNING │ ◄── Actively executing                        │
│  └────┬────┘                                                │
│       │ pause() / error()                                    │
│       ▼                                                      │
│  ┌─────────┐     ┌──────────┐                               │
│  │ PAUSED  │────►│ RUNNING  │ resume()                     │
│  └─────────┘     └──────────┘                               │
│       │                                                      │
│       │ error() unrecoverable                                │
│       ▼                                                      │
│  ┌─────────┐                                                │
│  │  FAILED │ ◄── Unrecoverable error                        │
│  └─────────┘                                                │
│       │                                                      │
│       │ complete() / cancel()                                │
│       ▼                                                      │
│  ┌─────────────┐                                            │
│  │ COMPLETED   │ ◄── Successfully finished                   │
│  │ or CANCELLED│ ◄── Human cancelled                        │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State Transitions

| From | To | Trigger | Recoverable |
|------|----|---------|-------------|
| PENDING | RUNNING | `start()` | Yes |
| RUNNING | PAUSED | `pause()` | Yes |
| RUNNING | FAILED | `error()` (unrecoverable) | No |
| RUNNING | COMPLETED | `complete()` | — |
| PAUSED | RUNNING | `resume()` | Yes |
| PAUSED | FAILED | `error()` (unrecoverable) | No |
| PAUSED | CANCELLED | `cancel()` | — |
| ANY | PENDING | `reset()` | — |

---

## Persistence Schema

### PostgreSQL Table: `workflow_states`

```sql
CREATE TABLE workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  group_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'paused', 'failed', 'completed', 'cancelled')),
  checkpoint_data JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_group_id FOREIGN KEY (group_id) REFERENCES tenants(group_id),
  CONSTRAINT valid_state_transition CHECK (
    -- State transitions validated via trigger
    true
  )
);

CREATE INDEX idx_workflow_states_workflow ON workflow_states(workflow_id);
CREATE INDEX idx_workflow_states_group ON workflow_states(group_id);
CREATE INDEX idx_workflow_states_agent ON workflow_states(agent_id);
CREATE INDEX idx_workflow_states_state ON workflow_states(state);
```

### Checkpoint Format

```typescript
interface WorkflowCheckpoint {
  workflow_id: string;
  group_id: string;
  agent_id: string;
  state: WorkflowState;
  checkpoint_data: {
    last_turn: number;
    context: Record<string, unknown>;
    tool_calls: ToolCall[];
    pending_actions: Action[];
    memory_pointers: {
      postgres_trace_id: string;
      neo4j_node_ids: string[];
    };
  };
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}
```

---

## TypeScript Implementation

### Type Definition

```typescript
// src/lib/workflow/types.ts

export type WorkflowState =
  | 'pending'
  | 'running'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'cancelled';

export interface WorkflowStateRecord {
  id: string;
  workflow_id: string;
  group_id: string;
  agent_id: string;
  state: WorkflowState;
  checkpoint_data: WorkflowCheckpointData;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowCheckpointData {
  last_turn: number;
  context: Record<string, unknown>;
  tool_calls: ToolCall[];
  pending_actions: Action[];
  memory_pointers: {
    postgres_trace_id: string;
    neo4j_node_ids: string[];
  };
}
```

### State Machine Class

```typescript
// src/lib/workflow/state-machine.ts

import { validateGroupId } from '../validation/group-id';
import { WorkflowState, WorkflowStateRecord, WorkflowCheckpointData } from './types';

export class WorkflowStateMachine {
  private currentState: WorkflowState;
  private record: WorkflowStateRecord;
  
  constructor(record: WorkflowStateRecord) {
    this.record = record;
    this.currentState = record.state;
  }
  
  async transition(to: WorkflowState, checkpoint?: Partial<WorkflowCheckpointData>): Promise<void> {
    if (!this.isValidTransition(this.currentState, to)) {
      throw new Error(`Invalid state transition: ${this.currentState} -> ${to}`);
    }
    
    this.currentState = to;
    await this.persist(checkpoint);
  }
  
  private isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
    const validTransitions: Record<WorkflowState, WorkflowState[]> = {
      pending: ['running'],
      running: ['paused', 'failed', 'completed'],
      paused: ['running', 'failed', 'cancelled'],
      failed: ['pending'], // Allow reset
      completed: [],
      cancelled: [],
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
  
  private async persist(checkpoint?: Partial<WorkflowCheckpointData>): Promise<void> {
    // Update PostgreSQL record
    // Update Neo4j relationship if needed
  }
  
  async checkpoint(data: Partial<WorkflowCheckpointData>): Promise<void> {
    // Save current state to PostgreSQL
    // Create immutable checkpoint
  }
  
  async resume(): Promise<void> {
    if (this.currentState !== 'paused') {
      throw new Error('Can only resume from paused state');
    }
    
    await this.transition('running');
  }
}
```

---

## Integration Points

### Agent Runtime Hook

```typescript
// Agent execution lifecycle with WorkflowState

export async function executeAgent(workflowId: string, agentId: string, groupId: string) {
  const stateMachine = await WorkflowStateMachine.load(workflowId);
  
  // Validate group_id
  validateGroupId(groupId);
  
  // Initialize if pending
  if (stateMachine.state === 'pending') {
    await stateMachine.transition('running');
  }
  
  // Execute turns
  for (const turn of agentTurns) {
    await stateMachine.checkpoint({ last_turn: turn.number });
    
    try {
      await executeTurn(turn);
    } catch (error) {
      if (isRecoverable(error)) {
        await stateMachine.transition('paused');
        throw new PauseError(error);
      } else {
        await stateMachine.transition('failed', { error_message: error.message });
        throw error;
      }
    }
  }
  
  await stateMachine.transition('completed');
}
```

---

## Recovery Behavior

### Crash Recovery

On agent restart:
1. Load `workflow_states` for agent_id
2. Find most recent `running` or `paused` state
3. Load `checkpoint_data`
4. Resume from `last_turn`
5. Restore context from memory_pointers

### Example Recovery Flow

```typescript
async function recoverWorkflow(workflowId: string): Promise<void> {
  const record = await loadWorkflowState(workflowId);
  
  if (record.state === 'running' || record.state === 'paused') {
    const stateMachine = new WorkflowStateMachine(record);
    
    // Restore context
    const context = await restoreContext(record.checkpoint_data.memory_pointers);
    
    // Resume from last checkpoint
    await stateMachine.resume();
    await executeAgent(workflowId, record.agent_id, record.group_id);
  }
}
```

---

## Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| `WS-001` | Invalid state transition | Log, alert |
| `WS-002` | Checkpoint failed | Retry with exponential backoff |
| `WS-003` | Recovery failed | Escalate to human |
| `WS-004` | State machine corrupted | Rebuild from PostgreSQL traces |
| `WS-005` | Concurrent state modification | Lock acquisition, retry |

---

## Open Questions

1. **Max checkpoint frequency?** — Need rate limiting to prevent storage explosion
2. **Concurrent agent access?** — Need locking strategy for shared workflows
3. **Checkpoint retention policy?** — How long to keep historical checkpoints?
4. **Cross-agent coordination?** — How to handle multi-agent shared state?

---

## Implementation Order

1. [ ] Create PostgreSQL migration for `workflow_states` table
2. [ ] Implement `WorkflowStateMachine` class
3. [ ] Add checkpoint persistence
4. [ ] Add crash recovery logic
5. [ ] Integrate with agent runtime hooks
6. [ ] Add state transition logging
7. [ ] Write unit tests for state transitions
8. [ ] Write integration tests for crash recovery

---

## References

- [PRD v2 — WorkflowState](../planning-artifacts/prd-v2.md)
- [Architectural Brief](../planning-artifacts/architectural-brief.md)
- [Data Dictionary](./data-dictionary.md)