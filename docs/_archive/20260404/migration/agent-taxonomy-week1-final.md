# Agent Taxonomy Migration - Week 1 Complete

## Overview

This document details the Week 1 migration of the roninmemory agent taxonomy from mixed naming conventions to a unified `Memory{Role}`, `Memory{Role}Sub` pattern following Brooksian architectural principles.

**Scope**: Memory system agents only (not business domain agents like Faith Meats, CRM, Audits).

## Migration Date
2026-04-04

## Scope Completed

### ✅ Top-Level Memory Agents Migrated (5 agents)

All top-level memory system agents have been unified to `Memory{Role}` naming pattern:

| Old Name | New Name | Location |
|----------|----------|-----------|
| `Memory-Orchestrator` | `MemoryOrchestrator` | `.opencode/agent/MemoryOrchestrator.md` |
| `MemoryArchitect` (keep) | `MemoryArchitect` | `.opencode/agent/MemoryArchitect.md` |
| `OpenRepoManager` | `MemoryRepoManager` | `.opencode/agent/MemoryRepoManager.md` |
| `OpenSystemBuilder` | `MemoryBuilder` | `.opencode/agent/MemoryBuilder.md` |
| `OpenTechnicalWriter` | `MemoryScribe` | `.opencode/agent/MemoryScribe.md` |

### ✅ Core Memory Subagents Created (8 agents)

New subagent structure organized by function (not domain):

```
.opencode/subagents/
├── core/                      # Core memory operations
│   ├── MemoryScoutSub.md      # Context discovery (read-only)
│   ├── MemoryArchivistSub.md  # External knowledge fetcher
│   ├── MemoryCuratorSub.md    # Task breakdown & planning
│   └── MemoryChroniclerSub.md # Documentation & ADRs
├── code/                      # Implementation & validation
│   ├── MemoryBuilderSub.md    # Code implementation mason
│   ├── MemoryTesterSub.md     # Test coverage inspector
│   ├── MemoryGuardianSub.md   # Code review & security
│   └── MemoryValidatorSub.md  # Build & type validation
└── shared/                    # Cross-system utilities
    ├── MemorySyncSub.md       # Neo4j ↔ Notion sync
    └── MemoryPayloadSub.md    # Payload CMS operations
```

### ✅ YAML Frontmatter Added

All migrated agents now include:

```yaml
---
name: Memory{Role}[Sub]
tier: agent | subagent | meta
group_id: roninmemory-system
behavior_intent: Clear description of agent purpose
behavior_lock: "UNPROMOTED"  # Sentinel value
memory_bootstrap: true
steps: [1,2,3,4,5,6,7,8,9]
description: "Full description"
mode: primary | subagent
temperature: 0.0-0.3
---
```

## Key Architectural Decisions

### 1. Corrected Scope: Memory System Only
- **Excluded**: Business domain agents (Faith Meats, CRM, Audits, Nonprofit)
- **Included**: Only roninmemory system agents
- **Reason**: Business domains managed separately via Paperclip/Overflowing Paperclip

### 2. Migration Strategy: Hybrid (C)
- **Migrated now**: 5 top-level memory agents
- **Created new**: 10 memory system subagents
- **Deferred**: Meta governance agents (blocked on `groupIdEnforcer.ts`)

### 3. Subagent Organization: Functional (B)
- Organized by function (core, code, shared), not by `group_id`
- Maintains categorical organization for discovery
- Shared utilities for cross-system operations

### 4. Behavior Locks: Sentinel Value (A)
- Used `"UNPROMOTED"` sentinel string
- Clear signal for future governance enforcement
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
- `meta/` governance agents:
  - `MemoryKernelMeta` - groupId enforcement, BehaviorSpec validator
  - `MemoryPromoterMeta` - HITL promotion: Bronze → Silver → Gold
  - `MemorySentinelMeta` - Semantic firewall, PII redaction
  - `MemoryAuditorMeta` - Merkle hash-chain audit trail

### Business Domain Agents (Not In Scope):
- Faith Meats product agents
- CRM lead management agents
- Audit/GLBA compliance agents
- Nonprofit grant research agents

## Validation Results

```bash
# Top-level memory agents
$ ls -1 .opencode/agent/Memory*.md
.opencode/agent/MemoryArchitect.md
.opencode/agent/MemoryBuilder.md
.opencode/agent/MemoryOrchestrator.md
.opencode/agent/MemoryRepoManager.md
.opencode/agent/MemoryScribe.md

# Memory system subagents
$ find .opencode/subagents -name "Memory*.md" | wc -l
10

# Directory structure
$ tree -L 2 .opencode/subagents/
.opencode/subagents/
├── code/
│   ├── MemoryBuilderSub.md
│   ├── MemoryGuardianSub.md
│   ├── MemoryTesterSub.md
│   └── MemoryValidatorSub.md
├── core/
│   ├── MemoryArchivistSub.md
│   ├── MemoryChroniclerSub.md
│   ├── MemoryCuratorSub.md
│   └── MemoryScoutSub.md
└── shared/
    ├── MemoryPayloadSub.md
    └── MemorySyncSub.md
```

## Brooksian Principles Applied

### Conceptual Integrity
One consistent naming scheme (`Memory{Role}`, `Memory{Role}Sub`) replaces mixed conventions.

### Separation of Architecture from Implementation
- **Top-level agents** define *what* (architecture, coordination)
- **Subagents** implement *how* (execution, domain operations)

### Fewer Interfaces, Stronger Contracts
- Clear functional boundaries (core, code, shared)
- Explicit behavior intents
- Sentinel values for governance

### The Surgical Team
- **MemoryOrchestrator** - Chief surgeon (coordination)
- **MemoryArchitect** - Lead architect (design)
- **MemoryBuilderSub** - Mason (implementation)
- **MemoryTesterSub** - Inspector (validation)
- **MemoryGuardianSub** - Reviewer (quality)
- **MemoryValidatorSub** - Final checkpoint

## Next Steps

### Week 2 (After groupIdEnlector fix):
1. Fix `groupIdEnforcer.ts` validation
2. Implement `meta/` governance agents
3. Enable HITL promotion workflow
4. Test full memory bootstrap protocol

## References

- [Memory Bootstrap Protocol](https://www.notion.so/3381d9be65b381a5a582c6ce763d6723)
- Brooks, F.P. (1975). *The Mythical Man-Month*
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

*"The bearing of a child takes nine months, no matter how many women are assigned."* — Frederick P. Brooks Jr.

**Week 1 Migration: Complete ✅**