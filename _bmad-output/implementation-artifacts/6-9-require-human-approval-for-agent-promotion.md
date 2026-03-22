# Story 6.9: Require Human Approval for Agent Promotion

**Epic:** Epic 6 - Agent Persistence and Lifecycle Management
**Status:** in-progress
**Created:** 2026-03-17
**Dependencies:** Story 6.5 (COMPLETE)

## User Story

As a compliance officer,
I want human approval required before agents go Active,
So that we maintain quality control.

## Acceptance Criteria

### Given an agent in Testing state with confidence >= 0.7
When the promotion pipeline runs
Then it creates approval request in Mission Control
And notifies designated approvers
And agent remains Testing until approved
And rejection returns agent to Draft with feedback

## Technical Specification

### Approval Model

```typescript
interface ApprovalRequest {
  id: string;
  agent_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: Date;
  feedback?: string;
  created_at: Date;
}
```

### TypeScript Implementation

```typescript
// src/lib/agents/approval.ts

export class AgentApproval {
  async requestApproval(agentId: string, requestedBy: string): Promise<ApprovalRequest>;
  async approve(agentId: string, reviewedBy: string, feedback?: string): Promise<void>;
  async reject(agentId: string, reviewedBy: string, reason: string): Promise<void>;
  async getPendingApprovals(): Promise<ApprovalRequest[]>;
}
```

## Definition of Done

- [ ] Approval request creation
- [ ] Approve/reject workflow
- [ ] State transitions
- [ ] Tests pass: `npm test -- agent-approval`
- [ ] Code review approved
- [ ] Memory log updated

---

*Story 6.9 - Require Human Approval for Agent Promotion*
*Epic 6 - Agent Persistence and Lifecycle Management*