# Product Evolution Analysis — Unified Memory Architecture

**ID:** ANL-001  
**Type:** Architecture Redesign  
**Date:** 2026-04-04  
**Status:** Analysis Complete

---

## Executive Summary

**The Vision:** One shared memory service (Allura/roninmemory) serving multiple agent runtimes (OpenCode, OpenClaw) through a single MCP contract — not separate memory systems per runtime.

**Current Problem:** The system risks becoming "memory duplicated inside two tools" rather than "one brain, multiple hands."

**Target State:** OpenCode and OpenClaw as two operator surfaces on the same governed memory substrate.

---

## Product Snapshot — Current State

**Implementation status:** Present in codebase, but not fully verified; the repo currently has typecheck failures outside the main architecture modules.

### What Exists

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Memory Backend** | PostgreSQL + Neo4j | Dual-store: raw traces + curated knowledge |
| **Memory Service** | roninmemory / Allura | Shared memory service exposing MCP interface |
| **Agent Runtime 1** | OpenCode | Primary development environment |
| **Agent Runtime 2** | OpenClaw | Secondary agent runtime (emerging) |
| **Contract Layer** | MCP | Memory read/write interface |

### Architecture Currently in Place

```
OpenCode ──────┐
               ├──► MCP ──► roninmemory ──► PostgreSQL (traces)
OpenClaw ──────┘                         └──► Neo4j (knowledge)
```

### What Works

1. **Dual-store pattern** — PostgreSQL for raw traces, Neo4j for curated knowledge
2. **`group_id` enforcement** — Tenant/project isolation boundary established
3. **HITL governance** — Human approval for behavior-changing promotions
4. **MCP exposure** — Memory tools exposed through MCP interface
5. **Append-only traces** — Audit reconstruction possible

### What Is Present But Still Needs Cleanup

1. **Runtime alignment support** — Concept exists, but validation wiring is still being scoped
2. **Shared adapter completeness** — Modules exist, but thin adapter behavior is not yet uniform
3. **Type safety** — Several existing files fail `npm run typecheck`

### What Needs Improvement

1. **Memory logic fragmentation** — Risk of diverging memory patterns per runtime
2. **No unified lifecycle hooks** — Each runtime may implement hydration/logging differently
3. **Cross-runtime continuity undefined** — No spec for agent resuming work started in another runtime
4. **Storage responsibilities unclear to consumers** — Run times may not respect dual-store separation

---

## Improvement Targets (Prioritized)

| # | Target | Impact | Effort | Priority |
|---|--------|--------|-------|----------|
| 1 | **Define unified memory API contract** | High — foundation for everything else | Medium | **P0** |
| 2 | **Build thin OpenCode adapter** | High — enables OpenCode as proper client | Medium | **P0** |
| 3 | **Build thin OpenClaw adapter** | High — enables OpenClaw as proper client | Medium | **P0** |
| 4 | **Standardize lifecycle hooks** | Medium — ensures consistent behavior | Low | **P1** |
| 5 | **Test cross-runtime continuity** | Medium — validates the architecture | Medium | **P2** |

---

## Selected Target for This Cycle

**Target #1: Define Unified Memory API Contract**

### Rationale

Without a shared contract, OpenCode and OpenClaw will inevitably diverge. The contract is the load-bearing specification that ensures:
- Both runtimes read/write through the same MCP interface
- `group_id` is consistently enforced
- Storage responsibilities remain separated
- Lifecycle hooks behave identically

### What the Contract Must Specify

```typescript
// Core contract elements
interface MemoryContract {
  // Identity
  group_id: string;           // Mandatory — tenant/project isolation

  // Read operations
  memory_read(query: string, group_id: string): Promise<MemoryResult>;
  memory_search(query: string, group_id: string): Promise<MemoryResult[]>;

  // Write operations
  memory_append(event: MemoryEvent, group_id: string): Promise<void>;
  memory_promote(insight: Insight, group_id: string): Promise<PromotionResult>;  // HITL required

  // Lifecycle hooks (both runtimes must implement)
  before_work: () => Promise<void>;   // Hydrate context
  during_work: (event: WorkEvent) => void;   // Log decisions, events, blockers
  after_work: (outcome: Outcome) => Promise<void>;   // Persist outcome + next actions

  // Storage contract (must not be bypassed)
  raw_traces: PostgreSQL;     // Append-only, never mutate
  curated_knowledge: Neo4j;   // Promoted insights only
}
```

### Contract Constraints

1. **One memory system, not two** — No runtime-specific memory logic
2. **Thin adapters only** — Plugin is authentication + group_id injection + command exposure
3. **Storage separation enforced** — Raw traces ≠ curated knowledge, even when consumed by runtimes
4. **`group_id` is load-bearing** — Every operation must carry it
5. **MCP tools for reads** — Use `mcp-neo4j` server for standard context retrieval (model-agnostic)
6. **Cypher for structural writes** — Use `MCP_DOCKER_write_neo4j_cypher` for graph edits (audited)

---

## The Neo4j Memory Standard

### Architecture Distinction

| Operation Type | Tool | Why |
|----------------|------|-----|
| **Read/Query** | `mcp-neo4j` server tools | Model-agnostic, standardized context retrieval |
| **Write/Restructure** | `MCP_DOCKER_write_neo4j_cypher` | Audited via Merkle Hash-Chain trail |

### Universal MCP_DOCKER Rule

| ❌ Forbidden | ✅ Required |
|------------|------------|
| `docker exec` for graph edits | Use `MCP_DOCKER_write_neo4j_cypher` for all structural changes |
| Manual Cypher without audit | Justify every edit against user intent |
| Raw cypher-shell bypass | All edits go through authorized MCP tools |

### Session Lifecycle Pattern

```
Session Start
    ├── Confirm `knowledge-neo4j` container running
    └── Run `bun run session:init` → Minimum Viable Context

During Work: Event → Outcome → Insight
    ├── Log Events → PostgreSQL (append-only) via `MCP_DOCKER_insert_data`
    └── Promote Insights → Neo4j via `MCP_DOCKER_write_neo4j_cypher`

After Work
    └── Runtime Alignment Validator intercepts high-impact operations
```

### Governance Contract

> **Failure to use MCP tools for memory operations violates the system's governance contract.**
> 
> If this rule is broken, the work must be **deleted and re-done** through the authorized MCP interface.

---

## Root Cause Analysis

### Why Does This Problem Exist?

**Historical context:** OpenCode was built first with roninmemory integration. OpenClaw is a newer runtime. Without explicit architectural guardrails, each could develop "its own view" of how memory works.

### What Caused This?

1. No explicit **shared memory contract** defined upfront
2. Each runtime developed its own **interpretation** of memory patterns
3. **Storage responsibilities** not explicitly communicated to runtime consumers
4. **Lifecycle hooks** not standardized across runtimes

### What Happens If We Don't Fix It?

- **Translation drift** — Decisions made in OpenCode won't be recoverable in OpenClaw
- **Duplicate memory logic** — Maintenance burden doubles
- **Inconsistent `group_id` enforcement** — Tenant isolation at risk
- **Broken audit trails** — Cannot reconstruct decisions across runtimes
- **Architectural entropy** — System becomes two partial memories, not one shared brain

---

## Hypothesis

**If** we define a unified memory API contract that both OpenCode and OpenClaw implement,

**Then** agents can start work in OpenCode, continue in OpenClaw, and recover the same project context, decisions, and audit trail without translation drift,

**Because** both runtimes will read/write through the same MCP interface, enforce `group_id` consistently, and implement identical lifecycle hooks.

---

## Next Steps

| Step | Action | Output |
|------|--------|--------|
| 1 | **Validate this analysis** | Confirm understanding of current gaps |
| 2 | **Proceed to [S] Scope** | Create detailed scenario for API contract |
| 3 | **Proceed to [D] Design** | Sketch the MCP interface specification |
| 4 | **Proceed to [I] Implement** | Build OpenCode adapter first |
| 5 | **Proceed to [T] Test** | Validate cross-runtime continuity |
| 6 | **Proceed to [P] Deploy** | Ship as architectural standard |

---

## References

- [PRD-Roninclaw-Custom-Agent-System](archive/notion-mapping.md) — OpenClaw system design
- [Allura Memory Control Center](archive/notion-mapping.md) — Backend architecture
- [OpenAgents teams Control for CLI](archive/notion-mapping.md) — CLI agent patterns
