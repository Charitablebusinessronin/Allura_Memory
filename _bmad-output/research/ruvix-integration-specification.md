# RuVix Cognition Kernel Integration Specification
## Memory Project - Sidecar Architecture

**Document ID:** SPEC-RUVIX-001  
**Version:** 1.0  
**Date:** 2026-03-22  
**Status:** Draft  
**Author:** AI Agent (Sisyphus)  

---

## Executive Summary

This specification defines the integration of **RuVix Cognition Kernel** as a **sidecar proof/witness layer** within the Memory project's existing PostgreSQL + Neo4j architecture. The integration establishes a hardened governance boundary between raw execution traces and promoted semantic insights, satisfying enterprise-grade auditability requirements.

### Key Objectives

| Objective | Description | Priority |
|-----------|-------------|----------|
| **Auditability** | Cryptographic witness logs for 12+ month decision trails | P0 |
| **Proof-Gated Mutations** | No data mutation without cryptographic verification | P0 |
| **Deterministic Replay** | Restore any previous system state from checkpoint + witness log | P1 |
| **Steel Frame Compliance** | Enforce immutable Insights with SUPERSEDES versioning | P0 |
| **Tenant Isolation** | `group_id` enforcement at the kernel boundary | P0 |

---

## 1. Architecture Overview

### 1.1 Current State (Without RuVix)

```
┌─────────────────────────────────────────────────────────────┐
│                     Memory Application                       │
│              (Next.js + TypeScript + Zustand)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────┐    ┌─────────────────────┐
│    PostgreSQL       │    │       Neo4j         │
│   (Raw Traces)      │    │  (Knowledge Graph)  │
│                     │    │                     │
│ • Events            │───►│ • Insights          │
│ • Outcomes          │    │ • Agents            │
│ • Decisions         │    │ • Policies          │
└─────────────────────┘    └─────────────────────┘
```

### 1.2 Target State (With RuVix Sidecar)

```
┌─────────────────────────────────────────────────────────────┐
│                     Memory Application                       │
│              (Next.js + TypeScript + Zustand)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (IPC/Queue)
┌─────────────────────────────────────────────────────────────┐
│                 RuVix Cognition Kernel                       │
│                    (Rust Sidecar)                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Proof Engine│  │ Witness Log │  │ Capability Mgr   │   │
│  │ (3 tiers)   │  │ (Immutable) │  │ (Token-based)    │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
│         │                │                   │              │
│         └────────────────┴───────────────────┘              │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                      │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Vector Store    │  │  Graph Store     │                │
│  │  (HNSW kernel)   │  │  (RVF native)    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │    Neo4j      │    │  Checkpoint   │
│ (Raw Traces)  │    │ (Insights)    │    │   Storage     │
│               │    │               │    │               │
│ • Events +    │    │ • Insights +  │    │ • State       │
│   Witness     │    │   Proofs      │    │   Snapshots   │
│   Refs        │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 1.3 Integration Rationale

| Concern | Without RuVix | With RuVix |
|---------|---------------|------------|
| **Audit Trail** | Application-level logging | Cryptographic witness logs |
| **Mutation Verification** | Zod runtime validation | Proof verification (<10µs) |
| **Permission Model** | Role-based (RBAC) | Capability tokens (unforgeable) |
| **Insight Versioning** | Neo4j SUPERSEDES edges | Kernel-enforced immutability |
| **Replay Capability** | Manual database dumps | Deterministic checkpoint replay |
| **Compliance** | Self-reported | Tamper-evident cryptographic proof |

---

## 2. System Components

### 2.1 RuVix Kernel Primitives

RuVix provides exactly **6 primitives** and **12 syscalls**:

| Primitive | Purpose | Memory Project Mapping |
|-----------|---------|------------------------|
| **Task** | Unit of execution with capability set | Agent sessions, tool invocations |
| **Capability** | Unforgeable access token | `group_id`-scoped permissions |
| **Region** | Memory with policy (immutable/append-only/slab) | Trace buffers, insight caches |
| **Queue** | Typed IPC ring buffer | Agent↔Kernel communication |
| **Timer** | Deadline-driven scheduling | Budget enforcement, timeouts |
| **Proof** | Cryptographic attestation | Mutation authorization |

### 2.2 Syscall Interface

Only **3 syscalls** require proof for the Memory integration:

| Syscall | Proof Required | Use Case |
|---------|---------------|----------|
| `VectorPutProved` | ✅ Yes | Store agent decision vectors |
| `GraphApplyProved` | ✅ Yes | Apply insight graph mutations |
| `RvfMount` | ✅ Yes | Mount new agent definitions |
| `AttestEmit` | ✅ Yes | Emit attestation records |
| `TaskSpawn` | ❌ No | Create agent tasks |
| `CapGrant` | ❌ No | Grant permissions |
| `QueueSend` / `QueueRecv` | ❌ No | IPC communication |

### 2.3 Proof Tiers

| Tier | Latency | Use Case | Memory Project Application |
|------|---------|----------|---------------------------|
| **Reflex** | <10µs | Real-time hotpath | High-frequency trace logging |
| **Standard** | ~100µs | Normal operations | Insight promotion |
| **Deep** | ~1ms | Security-critical | Agent activation, policy changes |

---

## 3. Data Flow Integration

### 3.1 Event Recording Flow (Raw Traces)

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent   │────►│   RuVix      │────►│ PostgreSQL  │────►│  Witness    │
│  Action  │     │  Sidecar      │     │  (Events)   │     │   Log       │
└──────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                      │
                      │ 1. Generate proof
                      │ 2. Verify proof (Reflex tier)
                      │ 3. Store event + witness ref
                      ▼
               ┌──────────────┐
               │  VectorPut   │
               │  Proved      │
               └──────────────┘
```

**TypeScript Interface:**
```typescript
// src/lib/ruvix/bridge.ts
interface EventRecordRequest {
  event_type: string;
  agent_id: string;
  group_id: string;           // Enforced at kernel boundary
  workflow_id?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

interface ProofConfig {
  tier: 'reflex' | 'standard' | 'deep';
  witness_required: boolean;
}

async function recordEvent(
  event: EventRecordRequest,
  proof: ProofConfig
): Promise<{
  event_id: string;
  witness_ref: string;
  proof_verified: boolean;
}>;
```

### 3.2 Insight Promotion Flow (Knowledge Graph)

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  Curator │────►│   RuVix      │────►│    Neo4j    │────►│   Notion    │
│  Service │     │  Sidecar      │     │  (Insights) │     │ (Approval)  │
└──────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                      │
                      │ 1. Validate group_id
                      │ 2. Check capabilities
                      │ 3. Deep proof verification
                      │ 4. Create SUPERSEDES edge
                      ▼
               ┌──────────────┐
               │ GraphApply   │
               │ Proved       │
               └──────────────┘
```

**Invariant: HITL Gate**
```typescript
// src/lib/ruvix/policy.ts
async function promoteInsight(insight: Insight): Promise<void> {
  // RuVix enforces: Human approval REQUIRED
  const approval = await checkNotionApproval(insight.id);
  
  if (!approval.ai_accessible) {
    throw new KernelPolicyError(
      `Insight ${insight.id} requires human approval before promotion`
    );
  }
  
  // Generate Deep-tier proof
  const proof = await ruvix.createProof({
    hash: hashInsight(insight),
    tier: 'deep',
    requiredCapabilities: ['insight.promote']
  });
  
  // Kernel verifies proof before mutation
  await ruvix.graphApplyProved({
    operation: 'CREATE_INSIGHT',
    data: insight,
    proof
  });
}
```

### 3.3 Query Flow (Dual Context)

```
User Query
    │
    ▼
┌─────────────────┐
│  RuVix Router   │
│                 │
│ • Project scope │──► PostgreSQL (episodic)
│ • Global scope  │──► Neo4j (semantic)
│ • Combined      │──► Both + merge
└─────────────────┘
```

---

## 4. Policy Invariants (Enforceable Rules)

### 4.1 Mandatory Policy Checks

| Invariant | Enforcement Point | Failure Mode |
|-----------|-------------------|--------------|
| **Every mutation has proof** | RuVix syscall entry | Syscall rejected |
| **Every node has group_id** | Neo4j schema constraint | Create rejected |
| **HITL before promotion** | RuVix policy module | Policy violation |
| **Append-only events** | PostgreSQL permissions + RuVix | Write rejected |
| **SUPERSEDES for updates** | Neo4j trigger + RuVix | Update rejected |
| **Capability-gated access** | RuVix capability manager | Permission denied |

### 4.2 Capability Model

```rust
// RuVix capability tokens
enum MemoryCapability {
    // Event operations
    EventCreate { group_id: String },
    EventRead { group_id: String },
    
    // Insight operations  
    InsightCreate { group_id: String },
    InsightPromote { group_id: String },  // Requires HITL
    InsightSupersede { group_id: String },
    
    // Administrative
    SystemCheckpoint,
    SystemReplay,
    PolicyModify,  // Requires Deep proof
}
```

**Delegation Chain:**
```
Root Capability
    └─► Project Admin (faith-meats, difference-driven, etc.)
            └─► Agent Runtime
                    └─► Specific Operations
```

---

## 5. Implementation Phases

### Phase 1: Sidecar Bootstrap (Week 1-2)

**Goal:** RuVix kernel running alongside Memory app

| Task | Deliverable | Test |
|------|-------------|------|
| Compile ruvix-nucleus | `ruvix-kernel` binary | `cargo test --workspace` passes |
| IPC bridge | TypeScript ↔ Rust queue | Latency < 1ms |
| Health check endpoint | `/health/ruvix` | Returns 200 |

**Code Structure:**
```
src/
├── lib/
│   └── ruvix/
│       ├── bridge.ts          # IPC communication
│       ├── types.ts           # TypeScript interfaces
│       ├── policy.ts          # Invariant enforcement
│       └── kernel/
│           └── Cargo.toml     # Rust sidecar
```

### Phase 2: Proof Integration (Week 3-4)

**Goal:** Every mutation verified

| Task | Deliverable | Test |
|------|-------------|------|
| Reflex proof for events | `recordEvent()` with proof | 10µs latency |
| Standard proof for insights | `createInsight()` with proof | 100µs latency |
| Witness logging | Witness table in PostgreSQL | Deterministic replay |

### Phase 3: Capability System (Week 5-6)

**Goal:** Fine-grained permission model

| Task | Deliverable | Test |
|------|-------------|------|
| Capability tokens | Token generation/validation | Unforgeable proof |
| group_id enforcement | Cross-tenant isolation | Boundary test |
| Role migration | RBAC → Capabilities | Backward compat |

### Phase 4: Deterministic Replay (Week 7-8)

**Goal:** Full system state restoration

| Task | Deliverable | Test |
|------|-------------|------|
| Checkpoint creation | `createCheckpoint()` API | State captured |
| Witness log replay | `replay(checkpoint)` | State restored |
| Event sourcing | PostgreSQL event table | Audit trail complete |

---

## 6. Migration Path

### 6.1 Backward Compatibility

```typescript
// src/lib/ruvix/compat.ts
// Gradual migration: allow old paths during transition

export async function recordEventCompat(event: Event) {
  if (process.env.RUVIX_ENABLED === 'true') {
    // New path: proof-gated
    return ruvix.recordEvent(event, { tier: 'reflex' });
  } else {
    // Old path: direct PostgreSQL
    return postgres.insertEvent(event);
  }
}
```

### 6.2 Rollback Strategy

| Scenario | Action | Recovery |
|----------|--------|----------|
| RuVix failure | Fallback to direct DB writes | Re-enable when stable |
| Proof timeout | Degrade to Standard tier | Retry with Reflex |
| Corruption | Replay from last checkpoint | Restore state |

---

## 7. Performance Targets

| Metric | Target | Current (PostgreSQL only) |
|--------|--------|---------------------------|
| Event latency | < 500µs | ~2ms |
| Insight promotion | < 5ms | ~10ms |
| Query dual context | < 50ms | ~30ms |
| Checkpoint creation | < 100ms | N/A |
| Witness log growth | < 1GB/day | N/A |

---

## 8. Security Considerations

### 8.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Event tampering | Cryptographic witness logs |
| Unauthorized promotion | Capability + HITL gate |
| Cross-tenant access | group_id enforcement at kernel |
| Replay attacks | Proof nonces + timestamps |
| Sidecar compromise | Minimal attack surface (12 syscalls) |

### 8.2 Compliance Mapping

| Requirement | RuVix Feature |
|-------------|---------------|
| SOC 2 Type II | Witness logs, deterministic replay |
| GDPR Art. 5 | Append-only, audit trail |
| HIPAA | Proof-gated mutations, capability tokens |

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| **Proof** | Cryptographic attestation gating state mutation |
| **Witness Log** | Tamper-evident log of all mutations |
| **Capability** | Unforgeable typed token granting resource access |
| **HITL** | Human-In-The-Loop approval |
| **Steel Frame** | Immutable versioning pattern (SUPERSEDES edges) |

### 9.2 References

- [RuVix README](https://github.com/ruvnet/RuVector/tree/main/crates/ruvix)
- [ADR-087: RuVix Cognition Kernel](https://github.com/ruvnet/RuVector/blob/main/docs/adr/ADR-087-ruvix-cognition-kernel.md)
- [Memory Project AGENTS.md](/home/ronin704/dev/projects/memory/AGENTS.md)
- [Memory Bank System](/home/ronin704/dev/projects/memory/.github/copilot-instructions.md)

### 9.3 Acceptance Criteria

- [ ] RuVix sidecar boots successfully
- [ ] All events recorded with Reflex proof (<10µs)
- [ ] All insights promoted with Standard proof (<100µs)
- [ ] HITL gate enforced before Neo4j promotion
- [ ] Deterministic replay from checkpoint works
- [ ] 100% backward compatibility during migration
- [ ] All 1000+ RuVix tests pass
- [ ] Memory project tests pass with RuVix enabled

---

*Document generated for Memory Project. Review before implementation.*
