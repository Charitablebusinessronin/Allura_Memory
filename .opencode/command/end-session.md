---
description: "Session finalization - run at the end of every session to persist context and verify"
argument-hint: "<summary>"
allowed-tools: ["read", "write", "grep", "bash"]
skill: mcp-docker
global: false
---

# Session End Protocol

Run at the end of every session. Persists a durable session reflection and verifies write success.

Run at the end of every session. Persists a durable session reflection and verifies write success.

## Usage

```bash
/end-session Completed harness cleanup and documentation alignment.
```

## Required Steps

1. Ensure memory backend is available (when configured)

2. Create a session reflection record scoped to your project's `group_id`

3. Read back to prove durability

## Session Reflection Template

When memory is available, persist a session reflection:

```javascript
// Step 1: Create reflection record
// Use your configured memory backend (Allura Brain, file-based, etc.)
// Include: group_id, agent_id, event_type, status, timestamp, summary

// Step 2: Verify by searching or reading back
// Confirm the record was written correctly
```

When memory is not available, write a summary to `memory-bank/progress.md` (if using memory-bank convention).

## Success Criteria

- Session reflection is persisted (to memory backend or file)
- Record can be read back or verified
- Summary includes what changed + why

## Alternative: Append to Progress File

If memory backend is not available, append to the project progress file:

```markdown
## 2026-04-18: Session Complete

- Completed harness cleanup and documentation alignment
- Key changes: [summary]
```

## Never Do This

❌ Skip the reflection step entirely

❌ Use raw database queries directly (use memory tools or file writes)

## Always Do This

✅ Persist a session summary somewhere durable

✅ Verify the write succeeded

✅ Include timestamp and project context in the record
