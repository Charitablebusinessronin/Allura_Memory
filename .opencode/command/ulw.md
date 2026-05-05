---
description: "Allura ultrawork — governed Team RAM execution until validation passes"
allowed-tools: ["Read", "Grep", "Glob", "Task", "Bash", "Edit", "Write", "allura-brain_memory_search", "allura-brain_memory_add"]
---

# Allura Ultrawork (`ulw`)

`ulw` is governed persistence. It is not permission to activate every agent blindly.

## Execution chain

```text
IntentGate
  ↓
Scout recon + Brain search
  ↓
Skill resolver
  ↓
Brooks route
  ↓
Team RAM execution
  ↓
Validation
  ↓
Memory write-back
```

## Required gate

```json
{
  "context_loaded": true,
  "brain_memories_checked": true,
  "required_skills": [],
  "skills_loaded": [],
  "validation_commands": []
}
```

## Rules

- Scout-first is mandatory.
- `guidelines/AI-GUIDELINES.md` must be considered for docs, architecture, schema, API, and implementation work.
- MCP activation requires mcp-harness approval.
- Debugging requires root cause before fixes.
- Stop on destructive-risk, secret-risk, or unclear irreversible action.
- Done means validation passed or blockers are explicitly documented.
