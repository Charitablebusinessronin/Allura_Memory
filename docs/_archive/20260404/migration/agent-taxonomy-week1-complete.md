# Agent Taxonomy Migration - Week 1 Complete

## Overview

This document details the Week 1 migration of the roninmemory agent taxonomy from mixed naming conventions to a unified `Memory{Role}`, `Memory{Role}Sub`, `Memory{Role}Meta` pattern following Brooksian architectural principles.

## Migration Date
2026-04-04

## Scope Completed

### ✅ Top-Level Agents Migrated (7 agents)

All top-level agents have been unified to `Memory{Role}` naming pattern:

| Old Name | New Name | Location |
|----------|----------|-----------|
| `Memory-Orchestrator` | `MemoryOrchestrator` | `.opencode/agent/MemoryOrchestrator.md` |
| `MemoryArchitect` (keep) | `MemoryArchitect` | `.opencode/agent/MemoryArchitect.md` |
| `OpenCopywriter` | `MemoryCopywriter` | `.opencode/agent/MemoryCopywriter.md` |
| `OpenDataAnalyst` | `MemoryAnalyst` | `.opencode/agent/MemoryAnalyst.md` |
| `OpenRepoManager` | `MemoryRepoManager` | `.opencode/agent/MemoryRepoManager.md` |
| `OpenSystemBuilder` | `MemoryBuilder` | `.opencode/agent/MemoryBuilder.md` |
| `OpenTechnicalWriter` | `MemoryScribe` | `.opencode/agent/MemoryScribe.md` |

### ✅ Domain-Scoped Subagents Created

New subagent structure organized by `group_id`:

```
.opencode/subagents/
├── faith-meats/           # group_id: roninclaw-faith-meats
│   └── MemoryFaithMeatsSub.md
├── shared/                # Cross-org utilities
│   ├── MemorySyncSub.md
│   └── MemoryPayloadSub.md
├── crm/                   # Placeholder for Week 2
└── nonprofit/             # Placeholder for Week 2
```

### ✅ YAML Frontmatter Added

All migrated agents now include:

```yaml
---
name: Memory{Role}
tier: agent | subagent | meta
group_id: {domain}
behavior_intent: Clear description of agent purpose
behavior_lock: "UNPROMOTED"  # Sentinel value
memory_bootstrap: true
steps: [1,2,3,4,5,6,7,8,9]
description: "Full description"
mode: primary | subagent
temperature: 0.1-0.3
---
```

## Key Architectural Decisions

### 1. Migration Strategy: Hybrid (C)
- **Migrated now**: 7 top-level agents (safe, no blockers)
- **Created new**: Domain-scoped subagents (nothing to migrate)
- **Deferred**: Meta governance agents (blocked on `groupIdEnforcer.ts`)

### 2. Subagent Organization: Domain-grouped (C)
- Organized by `group_id` boundary, not function type
- Mirrors Postgres/Neo4j tenant partitioning
- Enables clear access control and data isolation

### 3. Behavior Locks: Sentinel Value (A)
- Used `"UNPROMOTED"` sentinel string
- Rejected by future `MemoryKernelMeta` in production
- No fake hashes that could pass lax validators

## Memory Bootstrap Protocol

All agents now follow the 9-step bootstrap protocol:

1. **Connect Neo4j** - Wisdom (promoted insights)
2. **Connect PostgreSQL** - Chronicle (event logs)
3. **Log session_start** - Audit trail begins
4. **Retrieve context** - Memory patterns loaded
5. **Initialize workspace** - Session directory created
6. **Load standards** - Code quality, documentation patterns
7. **Verify connections** - System health check
8. **Lock behavior** - Governance enforcement (future)
9. **Signal ready** - Begin execution

## Deferred to Week 2+ (Blocked)

### Blocked on `groupIdEnforcer.ts` fix:
- `audits/` subagents (GLBA-protected data)
- `meta/` governance agents:
  - `MemoryKernelMeta` - groupId enforcement, BehaviorSpec validator
  - `MemoryPromoterMeta` - HITL promotion: Bronze → Silver → Gold
  - `MemorySentinelMeta` - Semantic firewall, PII redaction
  - `MemoryAuditorMeta` - Merkle hash-chain audit trail

## Validation Results

```bash
# Git status check
$ git status --short | grep -E "(Memory|subagents)"
?? .opencode/agent/MemoryAnalyst.md
?? .opencode/agent/MemoryArchitect.md
?? .opencode/agent/MemoryBuilder.md
?? .opencode/agent/MemoryCopywriter.md
?? .opencode/agent/MemoryOrchestrator.md
?? .opencode/agent/MemoryRepoManager.md
?? .opencode/agent/MemoryScribe.md
?? .opencode/subagents/

# Agent count
$ ls -1 .opencode/agent/Memory*.md | wc -l
7

# Subagent count
$ find .opencode/subagents -name "*.md" | wc -l
3
```

## Brooksian Principles Applied

### Conceptual Integrity
One consistent naming scheme (`Memory{Role}`) replaces mixed conventions.

### Separation of Architecture from Implementation
- **Top-level agents** define *what* (architecture, coordination)
- **Subagents** implement *how* (execution, domain operations)

### Fewer Interfaces, Stronger Contracts
- Clear `group_id` boundaries
- Explicit behavior intents
- Sentinel values for governance

### The Surgical Team
- **MemoryOrchestrator** - Chief surgeon
- **MemoryArchitect** - Lead architect
- **Memory{Role}Sub** - Specialized surgical team

## Next Steps

### Week 2 (After groupIdEnlector fix):
1. Fix `groupIdEnforcer.ts` validation
2. Create `audits/` subagents with GLBA protections
3. Implement `meta/` governance agents
4. Enable HITL promotion workflow

### Never (Until Enforcer Live):
- `MemoryAuditsSub` touching real mortgage data
- `MemoryKernelMeta` governance enforcement

## References

- [Memory Bootstrap Protocol](https://www.notion.so/3381d9be65b381a5a582c6ce763d6723)
- Brooks, F.P. (1975). *The Mythical Man-Month*
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

*"The bearing of a child takes nine months, no matter how many women are assigned."* — Frederick P. Brooks Jr.

**Week 1 Migration: Complete ✅**