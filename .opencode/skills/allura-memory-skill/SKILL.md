---
name: allura-memory-skill
description: Use when working with persistent memory in Allura Brain, especially when storing, retrieving, curating, promoting, superseding, deprecating, exporting, or troubleshooting memory behavior across PostgreSQL and Neo4j. Trigger this whenever the user asks to remember something, search prior memory, recover context, promote insights, inspect memory lineage, or debug the memory system.
allowed-tools: ["Read", "Grep", "Bash", "allura-brain_*", "mcp__MCP_DOCKER__*"]
---

# Allura Memory Skill

This skill teaches an agent how to use **Allura Brain** correctly.

It is for persistent memory workflows, not just one-off SQL or Cypher queries.

## Use This Skill When

- The user wants the system to remember important facts across sessions.
- The workflow needs semantic retrieval over prior events, decisions, outcomes, entities, or insights.
- The agent must store a new memory after completing a task.
- The agent should retrieve project or user context before acting.
- The task must distinguish raw traces from curated knowledge.
- The agent needs to promote, supersede, deprecate, revoke, restore, or export memory.
- The memory system needs setup, verification, or troubleshooting.

## Core Contract

- **Allura Brain** is the canonical, governed memory surface for this repo.
- Use first-party `allura-brain_*` tools first.
- Use governed `MCP_DOCKER` access only when you need lower-level inspection, infrastructure bootstrapping, or database/graph diagnostics.
- **group_id** is required on every operation. In this repo, default to `allura-roninmemory`.
- PostgreSQL traces are append-only.
- Neo4j knowledge is versioned through lineage, never silently overwritten.

## Memory Operating Model

Treat memory as layers:

1. **Raw trace**
   - Store session events, observations, evidence, and operational breadcrumbs.
   - Append-only.
   - Never treat raw trace as final truth.

2. **Curated insight**
   - Promote only after evidence and policy checks.
   - Prefer versioning and lineage over in-place mutation.
   - Use `SUPERSEDES`, deprecation, or restoration semantics.

3. **Retrieval context**
   - Load the smallest useful context window.
   - Prefer project-local memory first, then broaden only if it helps.

## Workflow

### 1. Identify intent

Decide whether the task is to:

- store a new memory
- search memory
- summarize memory state
- promote raw trace into insight
- deprecate or revoke memory
- restore deleted memory
- export memory
- troubleshoot memory behavior

### 2. Retrieve before writing

Search first.

- Avoid duplicate inserts.
- Check whether the memory already exists in similar form.
- Compare candidate facts against recent and canonical memory.

### 3. Classify the memory

Classify before you write:

- raw event
- outcome
- insight
- entity fact
- decision / ADR
- relationship between entities

### 4. Apply write discipline

- Raw traces may be appended.
- Insights should be versioned, not silently overwritten.
- If a prior truth must change, create a new version and preserve lineage.
- Do not promote unsupported claims as durable truth.

### 5. Store evidence with memory

Capture:

- source
- timestamp
- task context
- confidence
- relevant IDs or references

### 6. Use retrieval discipline

- Fetch project-local memory first when scope is narrow.
- Add global memory only when it improves reasoning.
- Return concise relevant context, not a dump.

### 7. Handle conflicts safely

- Preserve lineage when memories disagree.
- Prefer explicit status/version semantics over deletion.
- Mark disputed, superseded, deprecated, or restored states clearly.

### 8. Troubleshoot systematically

- Check whether Allura Brain tools are available.
- Check whether the underlying PostgreSQL and Neo4j systems are reachable.
- Verify auth, database, transport, and tenant scope.
- Verify duplicate detection, promotion policy, and versioning assumptions.

## Tool Selection

### Canonical tools first

Use these first:

- `allura-brain_memory_search`
- `allura-brain_memory_add`
- `allura-brain_memory_get`
- `allura-brain_memory_list`
- `allura-brain_memory_update`
- `allura-brain_memory_promote`
- `allura-brain_memory_delete`
- `allura-brain_memory_restore`
- `allura-brain_memory_export`
- `allura-brain_memory_list_deleted`

### MCP_DOCKER only when needed

Use `MCP_DOCKER` for:

- infrastructure discovery/configuration
- lower-level Neo4j inspection
- lower-level PostgreSQL inspection
- server/tool activation
- memory-system diagnostics

If you need this path, load the detailed guidance from:

- `references/allura-troubleshooting.md`
- `references/allura-dual-context-retrieval.md`

## Guardrails

- Do not confuse raw logs with validated knowledge.
- Do not mutate canonical insights in place.
- Do not promote memories without evidence or policy support.
- Do not create duplicate insight nodes when a superseding relationship is more appropriate.
- Do not return stale memory without checking timestamps, status, and lineage.
- Do not use docs, comments, or local notes as memory authority when Allura Brain is available.

## Recommended References

- `references/allura-memory-model.md`
- `references/allura-promotion-policy.md`
- `references/allura-dual-context-retrieval.md`
- `references/allura-troubleshooting.md`

## Suggested Scripts

- `scripts/validate-env.sh` — quick environment/config validation
- `scripts/smoke-test-memory.sh` — smoke test for memory readiness

Use those scripts when the task is operational, repetitive, or needs deterministic verification.
