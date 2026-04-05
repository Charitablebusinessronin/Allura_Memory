# Phase 1.1: Session Persistence Implementation Plan

> **Created:** 2026-04-05
> **Priority:** P1 (Keystone - everything else depends on this)
> **Depends on:** Nothing (foundational)

---

## Overview

Session persistence enables crash recovery for agent executions. When an agent session crashes, it can resume from the last checkpoint instead of starting from scratch.

**Key behaviors:**
- Save session state to `.opencode/state/session-{id}.json` on every event
- Load state on session start
- Archive on session end
- Non-blocking async writes (don't block loop execution)
- Crash recovery: resume from last checkpoint

---

## Tasks

### Task 1: Create Session Types

**File:** `src/lib/session/types.ts`

**Requirements:**
1. Define `SessionState` interface with:
   - `session_id: string` (UUID)
   - `agent_id: string`
   - `group_id: string` (tenant isolation)
   - `workflow_stage: 'planned' | 'discovering' | 'approved' | 'executing' | 'validating' | 'complete'`
   - `token_usage: { input: number; output: number; turns: number }`
   - `permissions_granted: string[]`
   - `subagent_results: Record<string, unknown>`
   - `checkpoint_data: unknown` (flexible, for workflow-specific data)
   - `created_at: string` (ISO timestamp)
   - `updated_at: string` (ISO timestamp)

2. Define `SessionCheckpoint` interface for RalphLoop integration:
   - `iteration: number`
   - `phase: 'perceive' | 'plan' | 'act' | 'check' | 'adapt'`
   - `last_output: unknown`
   - `last_error: unknown`
   - `timestamp: string`

3. Define `SessionStatus` type:
   - `'idle' | 'running' | 'paused' | 'completed' | 'failed'`

4. Export all types from `types.ts`

**Acceptance Criteria:**
- All interfaces have correct TypeScript types
- Types are exported for use in other modules
- `group_id` is required (tenant isolation)
- No `any` types - use `unknown` where flexibility needed

**Context:**
- This is the foundation for Phase 1.2 (Workflow State Machine)
- Must match the checkpoint format used by RalphLoop in `src/lib/ralph/types.ts`
- Must integrate with existing `group_id` enforcement patterns

---

### Task 2: Create Session Persistence Module

**File:** `src/lib/session/persistence.ts`

**Requirements:**
1. Implement `saveSession(state: SessionState): Promise<void>`:
   - Write JSON to `.opencode/state/session-{id}.json`
   - Create directory if it doesn't exist
   - Non-blocking (async)
   - Atomic write (write to temp, then rename)
   - Validate `group_id` before save

2. Implement `loadSession(sessionId: string, groupId: string): Promise<SessionState | null>`:
   - Read from `.opencode/state/session-{id}.json`
   - Return `null` if file doesn't exist (first run)
   - Validate `group_id` matches
   - Throw if `group_id` mismatch

3. Implement `archiveSession(sessionId: string, groupId: string): Promise<void>`:
   - Move from `.opencode/state/session-{id}.json` to `.opencode/state/archive/session-{id}-{timestamp}.json`
   - Create archive directory if needed
   - Validate `group_id` before archive

4. Implement `listSessions(groupId: string): Promise<SessionMeta[]>`:
   - List all sessions for a tenant
   - Return metadata (id, status, created_at, updated_at)

5. Implement `deleteSession(sessionId: string, groupId: string): Promise<void>`:
   - Delete session file
   - Validate `group_id` first

**Error handling:**
- Throw typed errors: `SessionNotFoundError`, `SessionGroupIdMismatchError`, `SessionWriteError`
- Wrap file system errors with context

**Acceptance Criteria:**
- All functions are async and non-blocking
- Group ID validation on every operation
- Atomic writes (no corrupted files on crash mid-write)
- Proper error types
- Works with both Bun and Node.js file APIs

**Context:**
- Directory: `.opencode/state/` (already used by OpenCode for other state)
- Pattern: Atomic write via temp file + rename
- Follow existing patterns from `src/lib/postgres/connection.ts` for error wrapping

---

### Task 3: Create RalphLoop Integration

**File:** `src/lib/session/ralph-integration.ts`

**Requirements:**
1. Create `createSessionCallbacks(options): RalphCallbacks`:
   - Returns `onProgress` callback that saves checkpoint
   - Returns `onError` callback that saves error state
   - Returns `onCompletion` callback that archives session
   - Returns `onHalt` callback that saves halted state

2. Create `recoverFromCheckpoint(sessionId: string, groupId: string): Promise<RalphState | null>`:
   - Load session from persistence
   - Convert `SessionCheckpoint` to `RalphState`
   - Return `null` if no recovery possible
   - Prepare state for RalphLoop.resume()

3. Create `startSessionWithRecovery(groupId: string): Promise<{ sessionId: string; state: RalphState }>`:
   - Check for existing session in `paused` or `running` state
   - If found, offer recovery
   - If not found or recovery declined, start fresh

**Acceptance Criteria:**
- Progress callback saves iteration and phase
- Error callback saves error classification
- Completion callback archives session
- Recovery restores all RalphState fields
- `group_id` enforced on all operations

**Context:**
- RalphLoop callbacks defined in `src/lib/ralph/types.ts`
- Must import from `../ralph/types`
- Use existing `validateGroupId` from `src/lib/validation/group-id`

---

### Task 4: Create Unit Tests

**File:** `src/lib/session/persistence.test.ts`

**Requirements:**
1. Test `saveSession`:
   - Creates file correctly
   - Creates directory if missing
   - Validates group_id
   - Atomic write works

2. Test `loadSession`:
   - Returns null for missing file
   - Loads correctly when exists
   - Validates group_id
   - Throws on mismatch

3. Test `archiveSession`:
   - Moves file correctly
   - Creates archive directory
   - Validates group_id

4. Test `listSessions`:
   - Lists only matching group_id
   - Returns metadata only

5. Test `deleteSession`:
   - Removes file
   - Validates group_id

6. Integration test for RalphLoop callbacks:
   - Progress saves checkpoint
   - Completion archives
   - Halt saves state

**Acceptance Criteria:**
- 100% line coverage for persistence.ts
- Tests use temp directory (cleanup after each test)
- Group ID enforcement tested
- Error cases covered

---

## File Structure

```
src/lib/session/
├── types.ts           # SessionState, SessionCheckpoint, SessionStatus
├── persistence.ts     # saveSession, loadSession, archiveSession, etc.
├── ralph-integration.ts # RalphLoop callback factories
├── persistence.test.ts # Unit tests
└── index.ts           # Public exports
```

---

## Integration Points

| Module | How it integrates |
|--------|-------------------|
| `src/lib/ralph/loop.ts` | Uses `createSessionCallbacks` for persistence |
| `src/lib/validation/group-id.ts` | Uses `validateGroupId` for enforcement |
| `.opencode/state/` | Directory for session files |
| PostgreSQL `workflow_states` | Phase 1.2 will use this |

---

## Dependencies

- `src/lib/ralph/types.ts` (already exists)
- `src/lib/validation/group-id.ts` (already exists)
- Bun/Node.js `fs` module with promisify
- `uuid` for session ID generation

---

## Risks

| Risk | Mitigation |
|------|------------|
| File corruption on crash | Atomic writes (temp + rename) |
| Group ID bypass | Validate on every public function |
| Session file growth | Archive old sessions, implement cleanup |
| Parallel writes | Add write lock per session |

---

## Success Metrics

- All 4 tasks complete with passing tests
- No `any` types
- Group ID enforced on every operation
- Atomic writes verified
- RalphLoop integration tested