# Story 6.5: Implement Agent Lifecycle State Machine

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.2, 6.3 (COMPLETE)

## User Story

As a system owner,
I want agents to progress through defined lifecycle states,
So that only tested, approved agents are used in production.

## Acceptance Criteria

### Given an agent in Draft state
When it passes initial tests
Then it transitions to Testing state
And when confidence >= 0.7 and human approves
Then it transitions to Active state
And when superseded by v2
Then v1 transitions to Deprecated
And after 90 days in Deprecated
Then it transitions to Archived

## Technical Specification

### State Machine

```
Draft → Testing → Active → Deprecated → Archived
   ↑                    ↓
   └──── Rejection ─────┘
```

### Transitions

| From | To | Condition |
|------|----|-----------|
| Draft | Testing | First successful test |
| Testing | Active | confidence >= 0.7 + human approval |
| Testing | Draft | Test failure or rejection |
| Active | Deprecated | Superseded by new version |
| Deprecated | Archived | 90 days elapsed |

### TypeScript Implementation

```typescript
// src/lib/agents/lifecycle.ts

export type AgentState = 'Draft' | 'Testing' | 'Active' | 'Deprecated' | 'Archived';

export class AgentLifecycle {
  async transition(agentId: string, targetState: AgentState, reason: string): Promise<AgentRecord>;
  async canTransition(agentId: string, targetState: AgentState): Promise<boolean>;
  async getTransitionHistory(agentId: string): Promise<TransitionRecord[]>;
  async checkAutoTransition(agentId: string): Promise<AgentState | null>;
}
```

## Definition of Done

- [ ] State machine implemented
- [ ] Transition validation complete
- [ ] History logging working
- [ ] Auto-transition for confidence threshold
- [ ] Tests pass: `npm test -- agent-lifecycle`
- [ ] Code review approved
- [ ] Memory log updated

---

*Story 6.5 - Implement Agent Lifecycle State Machine*
*Epic 6 - Agent Persistence and Lifecycle Management*