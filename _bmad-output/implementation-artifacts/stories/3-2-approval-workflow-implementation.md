# Story 3.2: Approval Workflow Implementation

Status: backlog  # ⏸️ UNINSTALLED — Implementation removed from codebase

## ⚠️ Decision Log

**Date:** 2026-04-06  
**Decision:** Uninstalled all Paperclip-related code including approval workflows  
**Reason:** Part of complete Paperclip removal due to persistent UI failures  
**Note:** Core promotion workflow logic (`src/lib/promotions/`) remains in codebase and is functional.

## Story

As a **system curator**,
I want **a complete approval workflow with state transitions and audit trail**,
so that **knowledge promotions are properly tracked and governed through HITL gates**.

## Acceptance Criteria

1. [ ] Propose insight for promotion - Create promotion proposal with evidence
2. [ ] Curator review interface - Display proposal with full context
3. [ ] Approval/rejection workflow - State transitions with notifications
4. [ ] Audit trail for approvals - Complete history with timestamps

---

## Tasks / Subtasks

- [x] **Task 1: Create Promotion Proposal Entity** (AC: #1)
  - [x] Define `PromotionProposal` type in types.ts
  - [x] Add `ProposalStatus` enum with valid transitions
  - [x] Create types/test.ts with validation tests
  - [x] Wire to AgentApproval workflow

- [x] **Task 2: Implement Proposal Creation Flow** (AC: #1)
  - [x] Create `PromotionProposalManager` class
  - [x] Create proposal, submitForReview, approve, reject, supersede methods
  - [x] Add tests in proposal.test.ts
  - [x] Include group_id enforcement throughout

- [ ] **Task 3: Build Curator Review Interface** (AC: #2)
  - [ ] Create `/dashboard/paperclip/reviews/[id]/page.tsx`
  - [ ] Display proposal details: agent, confidence, evidence
  - [ ] Show agent execution record (AER) summary
  - [ ] Add context from related traces

- [x] **Task 4: Implement State Transitions** (AC: #3)
  - [x] Add `transitionState()` private method
  - [x] Validate transition validity via VALID_PROPOSAL_TRANSITIONS
  - [x] Insert audit trail on each transition
  - [x] Update proposal status atomically

- [x] **Task 5: Create Notification System** (AC: #3)
  - [x] Define `NotificationEvent` type in types.ts
  - [x] Create `NotificationService` class in notifications.ts
  - [x] Store notifications in `approval_notifications` table
  - [x] Include sendNotification and getNotifications methods

- [x] **Task 6: Build Audit Trail Viewer** (AC: #4)
  - [x] Create audit-log.ts with queryAuditLog, getAuditEntry, getEntityAuditSummary
  - [x] Create `/dashboard/paperclip/audit-logs/page.tsx`
  - [x] Create `audit-client.tsx` with filtering
  - [x] Display: timestamp, actor, action, entity_id, outcome

---

## Dev Notes

### Research Context (From 3 Parallel Agents)

**State Machine Pattern (Existing):**
- `WorkflowStateMachine` in `src/lib/workflow/state-machine.ts`
- Append-only state transitions
- Valid states: planned, discovering, approved, executing, validating, complete, failed
- Human approval gate at 'approved' state

**Approval-Specific States (Recommended):**
```typescript
type ApprovalState = 'draft' | 'pending' | 'approved' | 'rejected' | 'superseded' | 'revoked';
```

**Audit Trail Design:**
- Append-only `approval_transitions` table
- Columns: id, group_id, entity_type, entity_id, from_state, to_state, actor_id, actor_type, reason, metadata
- Immutable history with JSONB metadata

**Notification Pattern (Existing):**
- `EscalationService.notificationHandlers` - multi-channel registry
- Channels: in_app, email, slack, webhook
- `NotificationRecord` interface with channel, recipient, sent_at, success

### Existing Infrastructure (Ready to Reuse)

**From Story 3-1:**
- `AgentApproval` class with approve/reject methods
- `AgentApproval.getPendingApprovals()` 
- Server actions in `src/app/actions/approvals.ts`

**From ADAS (Story 2-4):**
- `ApprovalWorkflowManager` in `src/lib/adas/approval-workflow.ts`
- `approval_history` table in PostgreSQL
- `PromotionProposalManager.createProposal()`

**Gap Analysis:**
- No notification queue service
- No approver notification hook
- No notification status tracking
- No retry mechanism for failed notifications

### Implementation Architecture

```
┌────────────────────────┐
│  Review Page (NEW)     │
│  /reviews/[id]/page.tsx│
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐     ┌─────────────────────┐
│  ApprovalWorkflowManager│────▶│ NotificationService │
│  (EXISTING + extend)    │     │ (NEW)               │
└───────────┬────────────┘     └─────────────────────┘
            │                           │
            ▼                           ▼
┌────────────────────────┐     ┌─────────────────────┐
│ approval_transitions    │     │ approval_notifications│
│ (NEW)                   │     │ (NEW)                │
└────────────────────────┘     └─────────────────────┘
            │
            ▼
┌────────────────────────┐
│ Audit Log Viewer (NEW) │
│ /audit-logs/page.tsx   │
└────────────────────────┘
```

### File Structure

```
src/app/(main)/dashboard/paperclip/
├── reviews/
│   └── [id]/
│       └── page.tsx                # Review details page
├── audit-logs/
│   └── page.tsx                    # Audit log viewer
└── approvals/                       # From Story 3-1

src/lib/promotions/
├── proposal.ts                     # PromotionProposal class
├── types.ts                        # Type definitions
└── notifications.ts                # Notification service

src/app/api/promotions/
├── proposals/
│   └── route.ts                    # Proposals API
└── notifications/
    └── route.ts                    # Notifications API
```

### Database Schema

```sql
-- Approval transitions (append-only)
CREATE TABLE approval_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,
  transition_id UUID REFERENCES approval_transitions(id),
  channel VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb
);
```

### ARCH-001 Compliance

- ALL queries MUST include `group_id` filter
- Use `validateGroupId()` before any DB write
- Tenant naming: `allura-*`

---

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### File List

(To be populated during implementation)