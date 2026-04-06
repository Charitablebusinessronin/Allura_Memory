# Story 3.1: Paperclip Dashboard Foundation

Status: review

## Story

As a **human curator**,
I want **a governance dashboard for HITL approvals**,
so that **I can review, approve, or reject agent knowledge promotions before they affect system behavior**.

## Acceptance Criteria

1. [x] Organization management UI — Dashboard overview with KPIs
2. [ ] HITL approval queue — View all pending approval requests with filtering
3. [ ] Token budget monitoring — Track usage across workspaces
4. [ ] Audit log viewer — Historical record of all approval actions

---

## Tasks / Subtasks

- [x] **Task 1: Connect Approval Queue to Real Data** (AC: #2)
  - [x] Update `src/app/(main)/dashboard/paperclip/approvals/page.tsx` to fetch from `/api/approvals/pending`
  - [x] Replace static placeholder data with dynamic server-side query
  - [x] Add group_id validation using ARCH-001 pattern
  - [x] Display pending approvals with confidence scores, workspace, agent details

- [x] **Task 2: Create Server Actions for Mutations** (AC: #2)
  - [x] Create `src/app/actions/approvals.ts` with approve/reject server actions
  - [x] Implement `approveAction(formData)` with revalidation
  - [x] Implement `rejectAction(formData)` with rejection reason
  - [x] Handle success/error states with toast notifications (sonner)

- [x] **Task 3: Extract Reusable Approval Card Component** (AC: #2)
  - [x] Create `src/app/(main)/dashboard/paperclip/approvals/_components/approval-card.tsx`
  - [x] Component shows: agent_name, confidence_score, workspace, requested_at
  - [x] Include action buttons (Approve/Reject/View Details)
  - [x] Use shadcn Card, Badge, Button components

- [ ] **Task 4: Add Zustand Store for Approval State** (AC: #2)
  - [ ] Create `src/stores/approvals/approvals-store.ts`
  - [ ] Store: pendingApprovals[], selectedIds[], filters{}
  - [ ] Actions: fetchApprovals, setFilters, toggleSelection, batchApprove

- [x] **Task 5: Implement Approval Detail Dialog** (AC: #2)
  - [x] Create dialog component using shadcn Dialog
  - [x] Show full AER (Agent Execution Record)
  - [x] Add rejection reason textarea
  - [x] Wire approve/reject buttons to server actions

- [ ] **Task 6: Update Dashboard Overview Page** (AC: #1)
  - [ ] Connect `src/app/(main)/dashboard/paperclip/page.tsx` to real data
  - [ ] Show KPIs: pending count, approved today, rejected today, avg confidence
  - [ ] Add quick actions for approval queue

- [ ] **Task 7: Add Filter Controls** (AC: #2)
  - [ ] Workspace dropdown filter
  - [ ] Confidence range slider
  - [ ] Agent type dropdown
  - [ ] Date range picker (optional - Phase 2)

- [ ] **Task 8: Create Audit Log Viewer Page** (AC: #4)
  - [ ] Update `src/app/(main)/dashboard/paperclip/audit-logs/page.tsx`
  - [ ] Query approval_history table from PostgreSQL
  - [ ] Display: timestamp, actor, action, agent_id, outcome
  - [ ] Add filtering by actor, action type, date range

---

## Dev Notes

### Architecture Compliance

**Critical from ARCH-001:**
- ALL database queries MUST filter by `group_id`
- Use `validateGroupId()` from `src/lib/validation/group-id.ts` before any DB write
- Tenant naming: `allura-*` convention (not legacy `roninclaw-*`)

**From Memory Bank:**
- HITL governance rule: **Agents CANNOT autonomously promote to Neo4j**
- Human approval REQUIRED for behavior-changing knowledge
- Flow: PostgreSQL (Traces) → Curator (Proposes) → Auditor (Approves) → Neo4j (Knowledge)

### Backend Services (READY TO CONSUME)

**AgentApproval Class** (`src/lib/agents/approval.ts`):
- `requestApproval(agentId, requestedBy)` — Create approval request
- `approve(agentId, reviewedBy, feedback?)` — Approve and transition to Active
- `reject(agentId, reviewedBy, reason)` — Reject and transition back to Draft
- `getPendingApprovals()` — All pending approvals
- `getApprovalHistory(agentId)` — Approval history for agent
- `getApprovalStats()` — Stats (pending, approved, rejected, avg time)

**API Endpoint** (`src/app/api/approvals/pending/route.ts`):
- `GET /api/approvals/pending` — Fetch pending approvals
- `POST /api/approvals/pending` — Create approval request
- `PATCH /api/approvals/pending` — Approve/reject

### UI Components Available

**shadcn/ui (55+ components):**
- Containers: `Card`, `Tabs`, `Sheet`, `Dialog`
- Forms: `Button`, `Input`, `Select`, `Textarea`
- Data: `Table`, `Badge`, `Progress`, `Chart`
- Feedback: `Alert`, `Spinner`, `Sonner` (toast)

### State Management Pattern

**Follow existing pattern:** `src/stores/preferences/preferences-store.ts`

```typescript
// Zustand store structure for approvals
interface ApprovalState {
  pendingApprovals: Approval[];
  selectedIds: string[];
  filters: {
    workspace?: string;
    agentType?: string;
    confidenceThreshold?: number;
  };
  // Actions
  fetchApprovals: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason: string) => Promise<void>;
  setFilters: (filters: Partial<Filters>) => void;
  toggleSelection: (id: string) => void;
}
```

### Data Flow Pattern

```
Server Component (fetch initial data)
         ↓
Client Component (Zustand store)
         ↓
UI Components (shadcn/ui)
         ↓
Server Actions (mutations)
         ↓
API Routes (POST/PATCH)
         ↓
AgentApproval class
         ↓
PostgreSQL (agent_approvals table)
```

### Previous Story Intelligence

**Epic 1 Completed (2026-04-06):**
- All 7 stories done
- Multi-tenant enforcement (ARCH-001) complete
- Session stability infrastructure in place
- TraceMiddleware for MCP calls implemented

**Key Lessons:**
- Always enforce `group_id` before ANY database write
- Use `validateGroupId()` pattern consistently
- Test enforcement with verification scripts
- Log to PostgreSQL events table for audit trail

### Git Intelligence (Recent Commits)

```
25a411d - feat(ruvix-kernel): implement L1 kernel with proof-gated mutation
4a85f2b - feat(session-stability): encoding validator, state hydrator, checkpoint manager
10579e07 - feat(traces): evidence & confidence columns added to events table
```

**Patterns:** Test-first approach, kernel-backed mutation, checkpoint-based recovery

---

## Latest Tech Information

### Next.js 15+ App Router Pattern

**Server Components (Default):**
```tsx
// page.tsx - Server Component
export default async function ApprovalsPage() {
  const approvals = await getPendingApprovals(groupId);
  return <ApprovalsQueue initialData={approvals} />;
}
```

**Client Components (Interactivity):**
```tsx
// approvals-queue.tsx - Client Component
'use client';
export function ApprovalsQueue({ initialData }: Props) {
  const [approvals, setApprovals] = useState(initialData);

  const handleApprove = async (id: string) => {
    await approveAction(id); // Server action
    toast.success('Approved!');
    // Remove from local state or refetch
  };
}
```

### shadcn/ui Data Table

**Use TanStack Table (already in package.json):**
```tsx
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

const columns: ColumnDef<Approval>[] = [
  { accessorKey: 'agent_name', header: 'Agent' },
  { accessorKey: 'confidence_score', header: 'Confidence' },
  { accessorKey: 'workspace', header: 'Workspace' },
  { accessorKey: 'status', header: 'Status' },
];
```

### Server Actions Pattern

```typescript
// src/app/actions/approvals.ts
'use server';

import { revalidatePath } from 'next/cache';
import { AgentApproval } from '@/lib/agents/approval';

export async function approveAction(formData: FormData) {
  const agentId = formData.get('agentId') as string;
  const reviewerNotes = formData.get('notes') as string;
  const groupId = formData.get('groupId') as string;

  // Validate group_id (ARCH-001)
  const validatedGroupId = validateGroupId(groupId);

  // Business logic
  const approval = new AgentApproval();
  await approval.approve(agentId, 'curator', reviewerNotes);

  // Revalidate cache
  revalidatePath('/dashboard/paperclip/approvals');

  return { success: true };
}
```

---

## Testing Requirements

### Unit Tests

- [ ] `approval-card.test.tsx` — Component renders with correct props
- [ ] `approvals-store.test.ts` — Zustand store actions work correctly
- [ ] `approval-actions.test.ts` — Server actions validate and mutate correctly

### Integration Tests

- [ ] E2E: Curator can view pending approvals
- [ ] E2E: Curator can approve request → status changes
- [ ] E2E: Curator can reject request → status changes with reason
- [ ] E2E: Group ID isolation enforced (cross-tenant access denied)

### Test Commands

```bash
bun vitest run src/app/(main)/dashboard/paperclip/approvals/
bun vitest run src/stores/approvals/
bun vitest run --e2e approvals
```

---

## File Structure Requirements

**Create:**
```
src/app/(main)/dashboard/paperclip/
├── approvals/
│   ├── _components/
│   │   ├── approval-card.tsx
│   │   ├── approval-detail-dialog.tsx
│   │   └── approval-filters.tsx
│   └── page.tsx (UPDATE)

src/app/actions/
└── approvals.ts (NEW)

src/stores/approvals/
└── approvals-store.ts (NEW)

src/lib/paperclip/
├── approval-client.ts (NEW)
└── types.ts (NEW)
```

**Update:**
- `src/app/(main)/dashboard/paperclip/page.tsx` — Connect to real KPIs
- `src/app/(main)/dashboard/paperclip/audit-logs/page.tsx` — Connect to history

---

## Project Context Reference

- **Documentation Canon:** `_bmad-output/planning-artifacts/source-of-truth.md`
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **Agent Primitive Audit:** `_bmad-output/planning-artifacts/agent-primitives-audit.md`
- **RuVix Kernel:** `src/kernel/` — L1 proof-gated mutation (use for audit trail)
- **Session Stability:** `.opencode/skills/session-stability/SKILL.md`

---

## Completion Definition

- [ ] All 4 acceptance criteria met
- [ ] All 8 tasks completed
- [ ] Unit tests passing (coverage ≥ 80%)
- [ ] Integration tests passing
- [ ] ARCH-001 group_id enforcement verified
- [ ] Code review passed
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Lint passes: `bun run lint`

---

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

### Completion Notes List

**Iteration 1 (2026-04-06):**
- Tasks 1, 2, 3, 5 completed
- Server actions implemented with group_id enforcement
- ApprovalCard component created with approve/reject dialogs
- Server-side data fetching with approval-utils.ts
- Code review: APPROVE with TODO comments added
- Known limitations documented for Phase 2:
  - Hardcoded `DEFAULT_GROUP_ID` (needs session auth)
  - Hardcoded reviewer `'curator'` (needs user context)
  - Client-side pagination (needs DB-level filtering)
- Tasks 4, 6, 7, 8 deferred to Phase 2 per story scope

### File List

- `src/app/(main)/dashboard/paperclip/approvals/page.tsx` - Server component for approval queue
- `src/app/(main)/dashboard/paperclip/approvals/approvals-client.tsx` - Client component for interactivity
- `src/app/(main)/dashboard/paperclip/approvals/approval-utils.ts` - Server-side utilities
- `src/app/(main)/dashboard/paperclip/approvals/approval-utils.test.ts` - Unit tests
- `src/app/(main)/dashboard/paperclip/approvals/_components/approval-card.tsx` - Reusable component
- `src/app/actions/approvals.ts` - Server actions for mutations