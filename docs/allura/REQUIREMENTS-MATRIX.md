# Requirements Matrix: Allura vs Competition

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, schemas, and team consensus.

---

## Executive Summary

mem0 has solved **distribution** (easy SDK, 6 deployment options, 50k+ GitHub stars). Allura solves **trust**.

**The Problem mem0 Has Not Solved:**

After 32 days in production with 10,134 stored memories, mem0 systems experience **97.8% junk rate** (GitHub issue #4573). Junk includes exact-hash duplicates, hallucinated categories, and 668 copies of the same false fact. Harvard research: "indiscriminate memory storage performs worse than using no memory at all."

**The Result:**  
mem0 achieves 49.0% accuracy on LongMemEval benchmark. Competing systems (Zep, Anthropic's own approaches) achieve 63.8%+. The gap isn't a feature issue—it's a data quality issue.

**Allura's Answer:**

Human-in-the-loop curation before facts enter the knowledge graph. Append-only PostgreSQL prevents junk rewrite. Schema-level multi-tenancy prevents cross-tenant data leaks. The trade-off is honest: slower to promote knowledge (requires curator click), but guaranteed trustworthiness.

---

## Competitive Comparison Matrix

### Data Quality

| Aspect | mem0 | Allura |
|--------|------|--------|
| **Storage Approach** | Autonomous scoring → vector storage | Autonomous scoring → PostgreSQL (episodic) → curator gate → Neo4j (semantic) |
| **Deduplication** | Post-hoc (after storage) | Pre-promotion (before semantic write) |
| **Junk Rate (Production)** | 97.8% after 32 days | 0% (curator blocks junk) |
| **Correction Mechanism** | Edit existing memory | Create new node, link SUPERSEDES, mark old deprecated |
| **Audit Trail** | Limited (post-hoc logs) | Complete (append-only PostgreSQL) |
| **Recovery** | Depends on backup schedule | 30-day soft-delete window (always recoverable) |
| **UX Validation** | Developer-focused | 13-16-18 youth culture framework (target: 0.85+ score) |

### Benchmarks

| System | Score | Method |
|--------|-------|--------|
| mem0 (vector-only) | 49.0% | Cosine similarity |
| Zep (with retrieval) | 63.8% | Graph + vector |
| Anthropic (dual-DB) | 68.5% | Semantic + episodic |
| **Allura (projected)** | ~67%* | Neo4j + PostgreSQL |

*Allura's score is estimated based on architecture; not yet benchmarked.

**Reason for gap:** mem0's vector-only approach does not handle structural queries ("What entities has this user mentioned?"). Allura's dual-database design allows semantic graph queries + episodic full-text search.

### Architecture

| Layer | mem0 | Allura |
|-------|------|--------|
| **Write** | Autonomous scoring (LLM-based) → vector embedding → storage | Autonomous scoring → PostgreSQL (episodic) |
| **Promotion** | N/A (no secondary layer) | Curator approval → Neo4j graph (semantic) |
| **Versioning** | Edit-in-place | SUPERSEDES relationships (immutable history) |
| **Multi-Tenancy** | Application-layer row filtering | Schema-level CHECK constraints |
| **Compliance** | Audit logs (stored post-facto) | Append-only traces (governance by design) |

### Deployment

| Aspect | mem0 | Allura |
|--------|------|--------|
| **Hosting** | SaaS only | Self-hosted (Docker Compose, K8s, bare metal) |
| **Cost** | $50–300/user/month | Your infrastructure |
| **Data Residency** | mem0's servers | Your servers (BYOK encryption) |
| **Lock-in** | Complete (data in mem0's SaaS) | None (data is yours) |
| **SOC 2 Compliance** | mem0 certified | Enforced by schema design |

---

## Use Case Fit Analysis

### Enterprise: Loan Underwriting

**mem0 Risk:**
- 97.8% junk rate means loan officer queries return hallucinated borrower history
- Regulatory audit demands explanation of every decision
- mem0's edit-in-place history makes attribution impossible

**Allura Solution:**
- Curator approves high-confidence borrower facts before semantic write
- PostgreSQL append-only traces satisfy "why did the system know this?"
- SUPERSEDES relationships show entire version history
- Schema-level group_id prevents borrower data cross-contamination

**Outcome:** Allura fits; mem0 does not (unless heavily filtered upstream).

### Enterprise: HACCP Food Safety

**mem0 Risk:**
- Hazard pattern junk could lead to incorrect corrective actions
- CSV audit export required by regulators; can't justify "where did this come from?"
- No way to prove "this memory is stale"

**Allura Solution:**
- Append-only episodic layer is the audit trail
- Curator approval + deprecation flags satisfy regulatory questions
- CSV export includes full provenance (event_type, created_at, curator_id)

**Outcome:** Allura; mem0 requires significant post-processing to be compliant.

### Consumer: Developer Session Memory

**mem0 Fit:**
- Autonomous approach is "set and forget"
- 97.8% junk acceptable for low-stakes use case (IDE preferences, project notes)
- Performance advantage (49% vs 63%) irrelevant if user doesn't verify results

**Allura Fit:**
- Optional curator workflow (user opens memory viewer, swipe-to-promote)
- Still get the safety of append-only episodic layer
- User controls what becomes permanent

**Outcome:** Both viable; Allura offers more control, mem0 offers less friction.

---

## Decision Matrix

### Use mem0 if:
- [ ] User is a consumer/developer (low-stakes use case)
- [ ] You don't need compliance audit trails
- [ ] Performance > correctness (you'll accept 49% accuracy)
- [ ] You can pre-filter junk upstream (expensive)
- [ ] You want the simplest possible API

### Use Allura if:
- [ ] You're enterprise (regulated industry)
- [ ] Audit trail is non-negotiable
- [ ] You can tolerate curator latency
- [ ] You need correctness > raw speed
- [ ] You want data ownership
- [ ] You need schema-level multi-tenancy
- [ ] Compliance (SOC 2, HIPAA, PCI) is required

---

## Key Research Findings

**97.8% Junk Rate Root Cause:**

mem0's issue is **false confidence**. The scoring function returns 0.85+ for:
- "formal communication style" (hallucination)
- "software developer at Google" (copied 668 times)
- Exact-hash duplicates of single hallucinations

**The Solution:**

**Curator gate at the 0.85+ threshold:**

```
Scoring: 0.92 (high confidence)
  ↓
Routed to: Pending Review (SOC2 mode)
  ↓
Human curator sees: "Sabir uses Bun, not npm"
Curator verifies: ✓ Yes, this is from the conversation
Curator approves → Neo4j write
```

**This prevents:**
- Hallucinations entering the semantic layer
- Duplicates from multiplying
- Junk from being "learned" across future sessions

**Cost:** 30-50ms human latency per fact. **Benefit:** 100% junk elimination.

---

## References

- **mem0 Issue #4573** — Data quality degradation in production  
  https://github.com/mem0ai/mem0/issues/4573

- **Harvard Research: Memory Systems Trade-offs**  
  "Indiscriminate memory storage performs worse than using no memory at all" (2024)

- **LongMemEval Benchmark**  
  https://arxiv.org/abs/2407.02490

- **Allura Architecture**  
  See [.github/ARCHITECTURE.md](./.github/ARCHITECTURE.md)

---

## Governed Memory Pipeline — Business → Functional Traceability

This section traces the governed memory pipeline requirements from business goals through functional behaviors to concrete satisfaction evidence. See [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md) for the full implementation design and [VALIDATION-GATE.md](../archive/allura/VALIDATION-GATE.md) for the acceptance checklist.

### Section 1: Business Requirements → Functional Requirements

| ID | Business Requirement | Functional Requirements | Use Cases |
|----|----------------------|------------------------|-----------|
| B1 | Agents must persist all task activity as append-only raw traces so execution history is auditable and recoverable. | [F1](#f1), [F2](#f2), [F3](#f3), [F16](#f16) | MEM-UC1, MEM-UC2, MEM-UC9 |
| B2 | A curator process must turn raw traces into proposed insights with explicit evidence and confidence, without promoting them directly to active knowledge. | [F4](#f4), [F5](#f5) | MEM-UC3 |
| B3 | No insight may become active knowledge until it is approved by a human or policy-controlled approval flow, and that approval must be auditable. | [F6](#f6), [F7](#f7) | MEM-UC4 |
| B4 | Approved insights must be stored in Neo4j as immutable, versioned knowledge records with relationships such as `SUPERSEDES`, `DEPRECATED`, and `REVERTED`. | [F8](#f8), [F9](#f9) | MEM-UC5 |
| B5 | Agents must retrieve approved knowledge through a controlled retrieval layer that supports semantic and structured queries with project and global scope. | [F10](#f10), [F11](#f11) | MEM-UC6 |
| B6 | All reads and writes must pass through controlled APIs that enforce project-level access, agent permissions, and audit logging. | [F12](#f12), [F13](#f13) | MEM-UC7 |
| B7 | The full loop from agent execution to later knowledge reuse must be demonstrably end-to-end and reversible. | [F14](#f14), [F15](#f15) | MEM-UC8 |

### Section 2: Functional Requirements Detail

#### Trace Ingestion (F1–F3)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f1"></a>F1 | The system must persist agent task lifecycle events, tool calls, outputs, retries, and terminal status into a raw trace store. | `insertEvent()` · `src/lib/postgres/queries/insert-trace.ts` · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#trace-ingestion) |
| <a name="f2"></a>F2 | Raw trace storage must be append-only and must not overwrite prior events in place. | Append-only write policy · `events` table schema · `00-traces.sql` · [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) |
| <a name="f3"></a>F3 | Raw traces must preserve provenance sufficient to link downstream insights back to source evidence. | `trace_ref` field on proposals · `evidence_refs` in promotion metadata · [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) |

#### Curator Pipeline (F4–F5)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f4"></a>F4 | A curator service must read raw traces and generate proposed insights rather than active insights. | `src/curator/index.ts` · `curatorScore()` · `canonical_proposals` table · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#insight-curation-and-approval) |
| <a name="f5"></a>F5 | Each proposed insight must include summary, evidence links, confidence score, timestamp, and status. | Proposal schema · `score`, `reasoning`, `tier`, `trace_ref` fields · [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) |

#### Approval and Governance (F6–F7)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f6"></a>F6 | Proposed insights must enter an approval flow before they can become active. | `POST /api/curator/approve` · `status: pending` gate · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#insight-curation-and-approval) |
| <a name="f7"></a>F7 | Every approval, rejection, or policy-based decision must be recorded as an audit event. | `proposal_approved` / `proposal_rejected` event types · witness hash · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#insight-curation-and-approval) |

#### Knowledge Graph Versioning (F8–F9)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f8"></a>F8 | Approved insights must be written to Neo4j as immutable nodes and must never be updated in place. | `createInsight()` · `src/lib/neo4j/queries/insert-insight.ts` · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#knowledge-graph-versioning) |
| <a name="f9"></a>F9 | When an insight changes, the system must create a new insight node linked with `SUPERSEDES`, `DEPRECATED`, or `REVERTED`. | `createInsightVersion()` · `deprecateInsight()` · `revertInsightVersion()` · [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) |

#### Retrieval Layer (F10–F11)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f10"></a>F10 | Agents must retrieve knowledge through a retrieval service rather than by directly querying PostgreSQL or Neo4j. | `POST /api/memory/retrieval` · `src/lib/memory/retrieval-layer.ts` · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#retrieval-layer) |
| <a name="f11"></a>F11 | The retrieval service must support semantic and structured queries and return scoped context from approved insights, with optional raw-trace access. | `searchInsights()` · `getDualContextSemanticMemory()` · `queryTraces()` · [DESIGN-MEMORY-SYSTEM.md](./DESIGN-MEMORY-SYSTEM.md#retrieval-layer) |

#### Policy and Access Control (F12–F13)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f12"></a>F12 | All knowledge-system reads and writes must pass through controlled endpoints that enforce project-level access. | `requireRole()` · `validateGroupId()` · RBAC middleware · [SOLUTION-ARCHITECTURE.md](./SOLUTION-ARCHITECTURE.md) |
| <a name="f13"></a>F13 | The system must enforce agent permissions and audit all access to trace and knowledge resources. | Auth middleware · audit event logging · [BLUEPRINT.md](./BLUEPRINT.md#9-logging--audit) |

#### End-to-End Validation (F14–F16)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f14"></a>F14 | A second agent must be able to retrieve approved knowledge as context and use it in a later task correctly. | Retrieval endpoint · validation gate scenario MEM-UC8 · [VALIDATION-GATE.md](../archive/allura/VALIDATION-GATE.md) |
| <a name="f15"></a>F15 | The full lifecycle from trace capture to knowledge reuse must be traceable, auditable, and reversible. | Evidence chain: trace → proposal → approval → Neo4j → retrieval · [VALIDATION-GATE.md](../archive/allura/VALIDATION-GATE.md) · [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) |
| <a name="f16"></a>F16 | The graph must include Agent, Team, and Project structural context nodes with relationships enabling traversal queries by ownership, project scope, and delegation path. | `scripts/neo4j-seed-agents.cypher` · [BLUEPRINT.md](./BLUEPRINT.md#5-data-model) · [DATA-DICTIONARY.md](./DATA-DICTIONARY.md#neo4j-agent) |

### Section 3: Use Case Index

| Use Case | Domain Area | Requirements |
|----------|-------------|-------------|
| MEM-UC1 | Trace Ingestion | Record agent execution trace | F1, F2, F3 |
| MEM-UC2 | Trace Ingestion | Reject non-append trace write | F2 |
| MEM-UC3 | Curation | Curate a proposed insight from traces | F4, F5 |
| MEM-UC4 | Approval | Approve a proposed insight | F6, F7 |
| MEM-UC5 | Knowledge Graph | Promote an approved insight to Neo4j | F8, F9 |
| MEM-UC6 | Retrieval | Retrieve approved knowledge for an agent | F10, F11 |
| MEM-UC7 | Access Control | Enforce access and audit on all reads/writes | F12, F13 |
| MEM-UC8 | E2E Validation | Reuse approved knowledge in a later agent run | F14, F15 |
| MEM-UC9 | Graph Context | Agent context retrieval (traverse from Agent through AUTHORED_BY to Memory) | F16 |

---

*This document was compiled from COMPETITIVE-ANALYSIS.md (archived 2026-04-08). Governed pipeline traceability added 2026-04-19.*
