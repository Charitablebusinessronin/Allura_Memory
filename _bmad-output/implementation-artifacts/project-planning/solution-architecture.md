# Solution Architecture — roninmemory

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Promoted from archive `roninmemory/SOLUTION-ARCHITECTURE.md`. Updated to Allura v2 naming (`allura-*` namespace, `Memory{Role}` agents).

---

## Table of Contents

- [1. Components & Execution Surface](#1-components--execution-surface)
- [2. Logical Topologies](#2-logical-topologies)
- [3. Key Architectural Constraints](#3-key-architectural-constraints)
- [4. Interface Catalogue](#4-interface-catalogue)
- [5. Risk-Architecture Traceability](#5-risk-architecture-traceability)

---

## 1. Components & Execution Surface

### Core Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **MemoryOrchestrator** | Brooks-bound primary orchestrator; governs all memory operations; enforces dual logging and tenant boundaries | OpenCode Agent |
| **Memory{Role} agents** | Specialized execution: Architect, Builder, Analyst, Scribe, Copywriter, RepoManager | OpenCode Subagents |
| **OpenClaw** | AI reasoning controller; task execution; MCP tool runtime; human communication gateway | Ubuntu (local only) |
| **PostgreSQL 16** | Raw trace store; agent registry; promotion queue; event audit trail | Docker |
| **Neo4j 5.26 + APOC** | Persistent semantic memory graph; versioned insights with `SUPERSEDES` | Docker |
| **Curator** | 2-phase promotion cron; Notion mirror | Node.js / Bun, node-cron |
| **ADAS Orchestrator** | Meta-agent design search; evolutionary SearchLoop | Bun, Dockerode |
| **OllamaClient** | HTTP client for Ollama API — local + cloud routing | TypeScript |
| **DinD Sidecar** | Blast-radius-bounded ADAS candidate execution | docker:26-dind |
| **Paperclip** | Multi-tenant governance dashboard; agent spawn; budget monitoring; Aegis gate UI | Docker |
| **RuVix Kernel** | L1 proof-gated mutation kernel; 6 primitives, 12 syscalls | Docker |

### Agent Orchestration Topology

```mermaid
graph TD
    MO[MemoryOrchestrator<br/>Brooks Persona] -->|delegates to| MA[MemoryArchitect]
    MO -->|delegates to| MB[MemoryBuilder]
    MO -->|delegates to| MAN[MemoryAnalyst]
    MO -->|delegates to| MS[MemoryScribe]
    MO -->|delegates to| MC[MemoryCopywriter]
    MO -->|delegates to| MR[MemoryRepoManager]

    MA -->|designs + ADRs| DOCS[_bmad-output/planning-artifacts]
    MB -->|implements| SRC[src/]
    MAN -->|metrics + drift| PG[(PostgreSQL)]
    MS -->|documentation| IMPL[_bmad-output/implementation-artifacts]
    MC -->|agent prompts| AGENTS[.opencode/agent/]
    MR -->|git ops| REPO[git]

    MO -->|enforces dual logging| PG
    MO -->|enforces dual logging| N4J[(Neo4j)]
    MO -->|tenant isolation| GRP[group_id: allura-*]
```

### API Surface

roninmemory has no external REST API. All integration is via:

| Method | Channel | Used By |
|--------|---------|---------|
| `before_prompt_build` hook | OpenCode / OpenClaw plugin | Context load on session start |
| `after_tool_call` hook | OpenCode / OpenClaw plugin | Heartbeat + cost tracking |
| `memory_write` tool | MCP tool | Agent-initiated graph writes |
| ADAS CLI | Terminal | Standalone evolutionary search |
| Bolt (port 7687) | Neo4j driver | Curator, context-loader |
| Postgres TCP | pg client | Curator, ADAS, heartbeat hook |
| Notion REST API | HTTPS | Curator mirror |
| MCP_DOCKER tools | Docker network | All DB operations (never `docker exec`) |
| Paperclip | Docker | Agent spawn, Aegis gate, budget monitoring |

---

## 2. Logical Topologies

### 2.1 Overall Component Topology

```mermaid
graph TD
  Operator([Operator / Sabir]) -->|voice/text/task| OC[OpenClaw / OpenCode]
  OC -->|read context on session start| N4J[(Neo4j)]
  OC -->|write traces + heartbeat| PG[(PostgreSQL)]
  PG -->|v_curator_pending| CUR[Curator]
  CUR -->|Phase 1 write| N4J
  CUR -->|Phase 2 commit| PG
  CUR -->|mirror| NOT[Notion]
  NOT -->|Aegis sign-off| PP[Paperclip]
  PP -->|spawn approved agent| OC
  ADAS[ADAS Orchestrator] -->|run candidate| DIND[DinD Sandbox]
  DIND -->|fitness_score| PG
  ADAS -->|evaluate via| OLLAMA[OllamaClient]
  OLLAMA -->|cloud models| OLLAMA_CLOUD[Ollama Cloud]
  OLLAMA -->|local models| OLLAMA_LOCAL[Ollama Local]
```

### 2.2 Memory Session Flow

```mermaid
flowchart TD
  A[Session starts] --> B[before_prompt_build fires]
  B --> C[Dual-context Neo4j query]
  C --> D[Inject into system prompt]
  D --> E[Agent executes task]
  E --> F[after_tool_call: heartbeat upsert]
  E --> G{memory_write called?}
  G -->|confidence < 0.5| H[Postgres only]
  G -->|confidence >= 0.5| I[Neo4j node + SUPERSEDES]
  H --> J{fitness >= 0.7?}
  J -->|Yes| K[trg_auto_enqueue fires]
  K --> L[Curator Phase 1 → Neo4j]
  L --> M[Curator Phase 2 → Postgres]
  M --> N[Mirror to Notion]
  N --> O[Human Aegis review in Paperclip]
```

### 2.3 ADAS Evolutionary Search Flow

```mermaid
flowchart TD
  Start([CLI invoked]) --> Config[Load domain + models]
  Config --> Init[Initialize population]
  Init --> Eval[Evaluate all candidates]
  Eval --> Rank[Rank by composite score]
  Rank --> Check{Success threshold met?}
  Check -->|yes| Propose[Generate PromotionProposal]
  Check -->|no| Mutate[Mutate + crossover]
  Mutate --> Next[Next iteration]
  Next --> Eval
  Propose --> Human{Human Aegis review}
  Human -->|approve| Live[Agent goes live]
  Human -->|reject| Archive[Design archived]
```

### 2.4 ADAS Evaluation Sequence

```mermaid
sequenceDiagram
    participant CLI
    participant EH as EvaluationHarness
    participant OC as OllamaClient
    participant SC as DinD Sandbox
    participant PG as PostgreSQL

    CLI->>EH: evaluateCandidate(design, forwardFn)
    EH->>SC: validate(design)
    SC-->>EH: valid
    loop for each ground truth case
        EH->>OC: complete(input, model)
        OC-->>EH: response text
        EH->>EH: compare(output, expected)
    end
    EH->>PG: insert adas_trace_events
    EH-->>CLI: EvaluationResult {fitness_score}
```

### 2.5 Cross-Tenant Promotion Flow

```mermaid
flowchart TD
  A[Operational Agent tags insight<br/>status = proposed_promotion] --> B[Curator stages ProposedKnowledge]
  B --> C[Strips group_id, agent_id, PII]
  C --> D[Writes ProposedKnowledge node<br/>group_id = allura-platform]
  D --> E[Syncs to Notion Changes DB]
  E --> F{Human review}
  F -->|Approve| G[Overseer sets promoted = true]
  G --> H[PromotionAudit written to Postgres]
  H --> I[Published to allura-platform namespace]
  F -->|Reject| J[status = rejected on proposal + source]
```

---

## 3. Key Architectural Constraints

| Constraint | Rationale |
|---|---|
| `group_id` MUST be present on every DB read/write | Tenant isolation — missing it causes schema constraint failure |
| PostgreSQL traces MUST be append-only | Audit integrity — no UPDATE/DELETE on trace rows ever |
| Neo4j mutations MUST use `SUPERSEDES` | History preservation — never edit existing nodes |
| HITL approval MUST precede any promotion to Neo4j | Governance invariant — agents cannot self-promote |
| All DB access MUST use MCP_DOCKER tools | Auditability — `docker exec` bypasses MCP layer |
| Bun MUST be the only package manager | Supply chain security — npm postinstall hooks are banned |
| All execution MUST run in Docker | Reproducibility and blast radius containment |
| `group_id` format MUST match `allura-{org}` | Drift prevention — `roninclaw-*` is deprecated |

---

## 4. Interface Catalogue

| Interface | Direction | Channel | Payload / Contract | Risk / Decision |
|---|---|---|---|---|
| OpenCode / OpenClaw plugin | Inbound | Hook callbacks | `before_prompt_build`, `after_tool_call` | AD-14 |
| MCP memory tools | Inbound | MCP protocol | `memory_write`, `read_graph`, `search_memories` | AD-16 |
| Notion API | Outbound | HTTPS REST | Curator mirror, HITL proposals, Aegis gate | AD-04, RK-03 |
| Ollama (local) | Outbound | HTTP | Model inference, no auth | AD-08 |
| Ollama (cloud) | Outbound | HTTPS | Model inference, Bearer auth | AD-08 |
| Neo4j Bolt | Outbound | TCP 7687 | Cypher queries — Curator, context-loader | AD-02, AD-16 |
| PostgreSQL | Outbound | TCP 5432 | SQL — Curator, ADAS, heartbeat | AD-10, AD-16 |
| DinD Sandbox | Outbound | Docker API | ADAS candidate execution | AD-05 |

---

## 5. Risk-Architecture Traceability

| Section | Risks and Decisions Addressed |
|---|---|
| §2.1 Overall Component Topology | AD-06, AD-14, AD-16 |
| §2.2 Memory Session Flow | AD-02, AD-03, AD-16, RK-04, RK-10 |
| §2.3 ADAS Evolutionary Search | AD-07, AD-09, AD-11, RK-05, RK-07 |
| §2.4 ADAS Evaluation Sequence | AD-05, AD-08, AD-10, RK-06 |
| §2.5 Cross-Tenant Promotion | AD-15, RK-04, RK-10 |

---

## See Also

- [`_bmad-output/planning-artifacts/architectural-brief.md`](../planning-artifacts/architectural-brief.md) — 5-layer Allura architecture
- [`_bmad-output/planning-artifacts/architectural-decisions.md`](../planning-artifacts/architectural-decisions.md) — AD-01 to AD-16, RK-01 to RK-10
- [`_bmad-output/planning-artifacts/requirements-matrix.md`](../planning-artifacts/requirements-matrix.md) — B1-B16, F1-F33
- [`_bmad-output/implementation-artifacts/data-dictionary.md`](./data-dictionary.md) — full schema definitions
