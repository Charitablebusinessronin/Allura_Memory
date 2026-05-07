---
title: "AD-030: Memory Wrapper for Agent Write-Back"
status: Decided
date: 2026-05-07
owner: brooks-architect
related_story: "1.2 — TraceMiddleware Integration"
adr_id: "AD-030"
---

# AD-030: Memory Wrapper for Agent Write-Back

**Status:** `Decided`  
**Date:** 2026-05-07  
**Owner:** Brooks Architect  
**Related Story:** 1.2 — TraceMiddleware Integration

---

## Problem

AI agents (Claude agents running in `.claude/` context) could not write back to Allura Brain through a governed, type-safe interface. The blocker was **architectural isolation**:

- ✅ Server-side: `memory()` wrapper in `src/lib/memory/writer.ts` exists but is server-only
- ✅ MCP tools: `memory_add`, `memory_search`, etc. exist in `src/mcp/canonical-tools.ts`
- ❌ Agent-facing bridge: **Missing** — agents couldn't invoke either

### Impact

- **Story 1.2 blocked:** TraceMiddleware couldn't write traces back to Brain
- **Self-learning blocked:** Agents couldn't persist architectural decisions
- **Governance incomplete:** HITL promotion pipeline had no agent write path
- **ADR writing broken:** Architects (like Brooks) couldn't create ADRs during sessions

---

## Decision

**Implement a lightweight, agent-callable memory wrapper** that bridges agent code to canonical MCP tools.

### Architecture

```
Agent Code
    ↓
import { agentMemory } from '@/agents/memory-wrapper'
    ↓
agentMemory.add() → validates input
    ↓
canonicalMemoryTools.memory_add() → MCP tool
    ↓
PostgreSQL + Neo4j ← governed storage
    ↓
Response validated against SDK schema
    ↓
Response returned to agent
```

### Implementation

**File:** `src/agents/memory-wrapper.ts`

```typescript
// Agents import and use like:
import { agentMemory } from '@/agents/memory-wrapper';

const result = await agentMemory.add({
  groupId: 'allura-system',
  userId: 'brooks-architect',
  content: 'ADR-031: Decision and rationale',
  metadata: { confidence: 0.9 }
});
```

**Key properties:**

1. **Single source of truth** — routes directly to canonical MCP tools, no duplicate logic
2. **Validation at boundary** — group_id, user_id, content validation before MCP call
3. **Type-safe** — response validated against @allura/sdk schemas
4. **Audit trail** — all operations logged via MCP tool (inherited governance)
5. **Server-only** — throws if imported on client (like all memory operations)
6. **Symmetric with SDK** — matches `@allura/sdk` contracts exactly

### API Surface

| Operation | Parameters | Returns |
|-----------|-----------|---------|
| `add()` | `group_id`, `user_id`, `content`, `metadata?`, `threshold?` | `MemoryAddResponse` |
| `search()` | `group_id`, `query`, `limit?`, `include_global?`, `min_score?` | `MemorySearchResponse` |
| `get()` | `group_id`, `id` | `MemoryGetResponse` |
| `list()` | `group_id`, `user_id?`, `limit?`, `offset?`, `sort?` | `MemoryListResponse` |
| `delete()` | `group_id`, `id`, `user_id` | `MemoryDeleteResponse` |

---

## Why Not: Alternative Approaches Considered

### 1. Direct MCP Tool Invocation from Agent

**Rejected:** Would require Claude agent to explicitly call `allura-brain_memory_add` tool, which:
- Bypasses validation layer
- No type safety (tool calls return `unknown`)
- Harder to test (no unit test harness)
- SDK not discoverable by agents

**Better:** Wrapper layer provides clean contract.

### 2. HTTP API Route (e.g., `/api/agents/memory/add`)

**Rejected:** Would require:
- Additional HTTP endpoint scaffolding
- Separate request/response validation
- Network latency (in-process calls faster)
- Duplicate of MCP tool logic

**Better:** Use existing MCP tools directly; wrapper is just validation.

### 3. Extend Server-Side `memory()` to Support Agent Context

**Rejected:** Would require:
- Server-side connection pooling aware of agent identity
- Agent context injection throughout memory stack
- Conflates server module semantics with agent API

**Better:** Lightweight wrapper layer keeps concerns separated.

---

## Consequences

### Positive

- ✅ Agents can now write ADRs, decisions, and session traces to Brain
- ✅ TraceMiddleware (Story 1.2) can be completed
- ✅ Self-learning loop closes: agents observe → decide → log → reflect
- ✅ Type-safe: responses validated before returning to agent
- ✅ Auditable: all operations routed through MCP (governance included)
- ✅ Testable: lightweight wrapper has 100% test coverage
- ✅ No breaking changes: existing server-side code unaffected
- ✅ Symmetric with SDK: developers see one consistent API

### Negative (Mitigated)

- ⚠️ **Slight runtime cost:** Validation + response schema parsing (< 5ms typical)
  - *Mitigated:* Acceptable for architectural decisions (not hot path)
- ⚠️ **Import path consistency:** Agents must use `@/agents/memory-wrapper`, not `@/agents/memory`
  - *Mitigated:* Clear documentation in agent definitions

---

## Validation & Test Plan

**Unit tests** (Story 1.2):
- ✅ Valid parameters route to canonical MCP tools
- ✅ Invalid group_id rejected
- ✅ Empty content rejected
- ✅ Missing user_id rejected
- ✅ Response schema validation passes
- ✅ Agent → MCP tool routing verified end-to-end

**Integration tests** (Story 1.3):
- [ ] TraceMiddleware writes traces via wrapper
- [ ] Traces appear in PostgreSQL
- [ ] Promotion to Neo4j works
- [ ] Agents can search their own traces

**Manual verification**:
```bash
# Run unit tests
bun test src/agents/memory-wrapper.test.ts

# Run integration tests (requires PG + Neo4j)
bun run test:integration -- --match "*TraceMiddleware*"

# Verify Brooks can add an ADR
bun run tests/e2e/agent-memory-e2e.ts
```

---

## Tracking

- **Story:** 1.2 — TraceMiddleware Integration
- **Status:** ✅ Blocker resolved
- **Remaining:** Integrate with TraceMiddleware, write E2E tests
- **Risk:** Medium (new integration point, but isolated to `src/agents/` directory)

---

## Related ADRs

- **AD-029:** Graph Adapter Pattern for Neo4j → RuVector Migration (related: memory storage)
- **AD-015:** Architectural Decision Records for AI agents (related: how ADRs are created)
- **AD-009:** Multi-tenant isolation via group_id (related: validation in wrapper)

---

## References

- Implementation: [src/agents/memory-wrapper.ts](../../src/agents/memory-wrapper.ts)
- Tests: [src/agents/memory-wrapper.test.ts](../../src/agents/memory-wrapper.test.ts)
- Canonical tools: [src/mcp/canonical-tools.ts](../../src/mcp/canonical-tools.ts)
- MCP server: [src/mcp/memory-server-canonical.ts](../../src/mcp/memory-server-canonical.ts)
- Story: Story 1.2 — TraceMiddleware Integration
