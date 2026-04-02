# roninmemory Solution Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Content has not yet been fully reviewed. This is a working design reference.

## 1. Components & Execution Surface

### Core Components
| Component | Responsibility | Technology |
|-----------|---------------|------------|
| OpenClaw | AI reasoning controller; task execution; MCP tool runtime | OpenClaw / Paperclip |
| PostgreSQL | Raw trace store; agent registry; promotion queue | Postgres 16 |
| Neo4j | Persistent semantic memory graph | Neo4j 5, Bolt port 7687 |
| Curator | 2-phase promotion cron; Notion mirror | Node.js 20 ESM, node-cron |
| ADAS Orchestrator | Meta-agent design search; evolutionary SearchLoop | Node.js 20, Dockerode |
| OllamaClient | HTTP client for Ollama API | TypeScript |
| DinD Sidecar | Blast-radius-bounded candidate execution | docker:26-dind |
| Mission Control | Agent spawn; monitoring; Aegis gate UI | OpenClaw Mission Control |

### API Surface
roninmemory has no external REST API. All integration is via:

| Method | Channel | Used By |
|--------|---------|---------|
| `before_prompt_build` hook | OpenClaw plugin | Context load on session start |
| `after_tool_call` hook | OpenClaw plugin | Heartbeat + cost tracking |
| `memory_write` tool | OpenClaw MCP tool | Agent-initiated graph writes |
| ADAS CLI | Terminal | Standalone evolutionary search |
| Bolt (port 7687) | Neo4j driver | Curator, context-loader |
| Postgres TCP | pg client | Curator, ADAS, heartbeat hook |
| Notion REST API | HTTPS | Curator mirror |
| Mission Control | OpenClaw internal | Agent spawn, Aegis gate |

---

## 2. Logical Topologies

### 2.1 Overall Component Topology
```mermaid
graph TD
  Sabir([Sabir / Operator]) -->|voice/text/task| OC[OpenClaw]
  OC -->|read context on session start| N4J[(Neo4j)]
  OC -->|write traces + heartbeat| PG[(PostgreSQL)]
  PG -->|v_curator_pending| CUR[Curator]
  CUR -->|Phase 1 write| N4J
  CUR -->|Phase 2 commit| PG
  CUR -->|mirror| NOT[Notion]
  NOT -->|Aegis sign-off| MC[Mission Control]
  MC -->|spawn approved agent| OC
  ADAS[ADAS Orchestrator] -->|run candidate| DIND[DinD Sandbox]
  DIND -->|fitness_score| PG
  ADAS -->|evaluate via| OC2[OllamaClient]
  OC2 -->|cloud models| OLLAMA_CLOUD[Ollama Cloud]
  OC2 -->|local models| OLLAMA_LOCAL[Ollama Local]
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
  N --> O[Human Aegis review]
```

### 2.3 ADAS Execution Flow
```mermaid
flowchart TD
  Start([CLI invoked]) --> Config[Load domain + models]
  Config --> Init[Initialize population]
  Init --> Eval[Evaluate all candidates]
  Eval --> Rank[Rank by composite score]
  Rank --> Check{Success threshold?}
  Check -->|yes| Promote[Generate PromotionProposal]
  Check -->|no| Mutate[Mutate + crossover]
  Mutate --> Next[Next iteration]
  Next --> Eval
  Promote --> Human{Human review}
  Human -->|approve| Done[Return best design]
  Human -->|reject| Done
```

### 2.4 Evaluation Sequence
```mermaid
sequenceDiagram
    participant CLI
    participant EH as EvaluationHarness
    participant OC as OllamaClient
    participant SC as Sandbox
    participant PG as PostgreSQL

    CLI->>EH: evaluateCandidate(design, forwardFn)
    EH->>SC: validate(design)
    SC-->>EH: valid
    loop for each ground truth case
        EH->>OC: complete(input, model)
        OC-->>EH: response text
        EH->>EH: compare(output, expected)
    end
    EH->>PG: insert trace events
    EH-->>CLI: EvaluationResult
```
