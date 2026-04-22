---
name: allura-memory-skill
description: Use when working with Allura Brain governed memory through MCP — storing, retrieving, curating, promoting, and governing memories with dual-layer PostgreSQL + Neo4j architecture.
allowed-tools: allura-brain_memory_add, allura-brain_memory_search, allura-brain_memory_get, allura-brain_memory_list, allura-brain_memory_update, allura-brain_memory_delete, allura-brain_memory_promote, allura-brain_memory_export, allura-brain_memory_restore, MCP_DOCKER_execute_sql, MCP_DOCKER_neo4j-memory, MCP_DOCKER_neo4j-cypher
---

# Allura Memory Skill

This skill teaches an AI agent how to use Allura Brain's governed memory system through MCP.
It covers persistent memory workflows — not just one-off queries.

## When to use

Use this skill when:

- A user wants the agent to remember important facts across sessions
- A workflow needs semantic search over prior events, outcomes, insights, or entities
- The agent must store new memories after a task completes
- The agent needs to retrieve relevant project or user context before acting
- The agent must distinguish raw episodic traces from curated semantic knowledge
- The agent needs to promote, supersede, deprecate, or revoke a memory
- The agent needs to understand the dual-layer architecture (PG episodic + Neo4j semantic)

## Core architecture

Allura Brain is a **dual-layer governed memory system**:

1. **Episodic layer (PostgreSQL)**
   - Append-only event traces
   - Vector embeddings via RuVector (qwen3-embedding:8b, 4096d)
   - Every `memory_add` writes here first
   - Never treat raw traces as final truth

2. **Semantic layer (Neo4j)**
   - Curated, versioned knowledge nodes
   - Graph relationships (SUPERSEDES, AUTHORED_BY, CONTRIBUTES_TO)
   - Only populated via curator promotion after policy checks
   - This is the canonical truth layer

3. **Governance (RuVix kernel)**
   - Promotion gating — raw → curated requires approval
   - Policy enforcement on every operation
   - Budget enforcement and circuit breakers
   - Agent identity tracking on all writes

## Memory operating model

Treat memory as multiple layers:

1. **Raw trace** — Store session events, observations, and evidence. Append-only. Never treat as final truth.
2. **Curated insight** — Promote only after policy checks. Use versioning instead of mutating in place. Prefer SUPERSEDES / deprecated / reverted relationships.
3. **Retrieval context** — Load both project-specific and global memories. Prefer the smallest useful context window.

## Tenant model

- `group_id` is the hard namespace boundary. Every read and write MUST include a valid `group_id` matching `^allura-`.
- Default tenant: `allura-system`
- Cross-tenant access is impossible by schema constraint
- Always specify `group_id` explicitly — never assume

## Agent identity

- Every `memory_add` must include your agent persona as `user_id` (e.g., `brooks-architect`, `woz-builder`)
- Generic IDs like `system` or `default` are only for bootstrap/system-level entries
- Your agent identity creates provenance and audit trails

## Instructions

When a user asks for memory-related work:

1. **Identify the intent**
   - Store a new memory
   - Search memory
   - Summarize memory state
   - Promote raw trace into insight
   - Revoke or deprecate memory
   - Troubleshoot memory server/runtime

2. **Retrieve before writing**
   - Call `memory_search` for existing related memories first
   - Avoid duplicate inserts
   - Check whether a candidate memory already exists in similar form

3. **Classify the memory**
   - Raw event / session trace
   - Outcome / result
   - Insight / learned pattern
   - Entity fact
   - Decision / ADR
   - Relationship between entities

4. **Apply write discipline**
   - Raw traces: use `memory_add` directly
   - Insights: write as raw, then call `memory_promote` if it passes policy
   - If updating prior truth: use `memory_update` (creates SUPERSEDES lineage, never overwrites)

5. **Store evidence with memory**
   - Capture source, timestamp, task context, and confidence
   - Do not write unsupported claims as durable truth

6. **Use retrieval discipline**
   - Fetch project-local memory first when task scope is narrow
   - Add global memory only when it improves reasoning
   - Return concise relevant context, not a dump

7. **Handle conflicts safely**
   - If two memories disagree, preserve lineage
   - Mark one as superseded or disputed instead of deleting
   - Prefer explicit status edges over destructive edits

8. **Troubleshoot systematically**
   - Is the MCP server reachable? (allura-memory-mcp container)
   - Is PostgreSQL accepting connections? (knowledge-postgres:5432)
   - Is Neo4j reachable? (knowledge-neo4j:7687)
   - Are credentials and group_id correct?
   - Is the embedding service (Ollama) running on host?

## Guardrails

- Do not confuse raw logs with validated knowledge
- Do not mutate canonical insights in place — always use `memory_update`
- Do not promote memories without evidence or policy support
- Do not create duplicate nodes when a SUPERSEDES relationship is more appropriate
- Do not return stale memory without checking timestamps and status
- Always use `group_id: allura-system` unless explicitly told otherwise
- Always identify yourself as the calling agent in `user_id`

## Quick reference

| Operation | MCP Tool | When |
|-----------|----------|------|
| Store new memory | `memory_add` | Any new observation, event, or fact |
| Search memories | `memory_search` | Before writing, before acting, on user request |
| Get single memory | `memory_get` | When you have an ID and need full detail |
| List user memories | `memory_list` | Browse all memories for a user |
| Update memory | `memory_update` | Correct or supersede an existing memory |
| Delete memory | `memory_delete` | Soft-delete (30-day recovery window) |
| Promote to canonical | `memory_promote` | Raw trace → curated insight |
| Export memories | `memory_export` | Bulk export for audit or backup |
| Restore deleted | `memory_restore` | Undo accidental deletion within 30 days |

## Recommended references

- `references/allura-memory-model.md`
- `references/allura-promotion-policy.md`
- `references/allura-dual-context-retrieval.md`
- `references/allura-troubleshooting.md`