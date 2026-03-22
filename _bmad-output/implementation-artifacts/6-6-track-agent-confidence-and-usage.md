# Story 6.6: Track Agent Confidence and Usage

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.2 (COMPLETE)

## User Story

As an AI engineer,
I want agents to accumulate confidence scores based on usage,
So that high-performing agents are prioritized.

## Acceptance Criteria

### Given an agent executes tasks
When tasks complete successfully
Then confidence_score increases based on:
- Success rate (0-1)
- Usage frequency (log scale)
- Human feedback (thumbs up/down)
- Time since last failure (decay factor)
And confidence is recalculated weekly

## Technical Specification

### Confidence Formula

```
confidence = (success_rate * 0.5) + (usage_factor * 0.3) + (feedback_factor * 0.2)

where:
  success_rate = successful_executions / total_executions
  usage_factor = min(total_executions / 100, 1.0)
  feedback_factor = (avg_feedback + 1) / 2  // Normalize -1..1 to 0..1
```

### TypeScript Implementation

```typescript
// src/lib/agents/confidence.ts

export class AgentConfidence {
  async recordExecution(agentId: string, success: boolean, feedback?: number): Promise<void>;
  async calculateConfidence(agentId: string): Promise<number>;
  async recalculateAllConfidence(): Promise<void>;
  async getConfidenceHistory(agentId: string): Promise<ConfidenceRecord[]>;
}
```

## Definition of Done

- [ ] Confidence calculation implemented
- [ ] Execution tracking working
- [ ] Feedback recording working
- [ ] Auto-recalculation scheduled
- [ ] Tests pass: `npm test -- agent-confidence`
- [ ] Code review approved
- [ ] Memory log updated

---

*Story 6.6 - Track Agent Confidence and Usage*
*Epic 6 - Agent Persistence and Lifecycle Management*