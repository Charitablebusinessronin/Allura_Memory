# OpenCode Agent Directory

**Frederick P. Brooks Jr. Surgical Team Architecture** — RoninMemory Unified AI Brain

---

## Directory Structure

```
.opencode/agent/
├── core/                          # Primary Surgical Team agents (7)
│   ├── openagent.md               # MemoryOrchestrator (chief surgeon)
│   ├── MemoryArchitect.md         # First Assistant (design)
│   ├── MemoryBuilder.md           # Builder (implementation)
│   ├── MemoryAnalyst.md           # Analyst (metrics)
│   └── memory-builder-focus.md    # Focus mode variant
├── subagents/
│   ├── core/                      # Core subagents (discovery, docs)
│   │   ├── contextscout.md        # MemoryScout (approval exempt)
│   │   ├── documentation.md       # MemoryChronicler
│   │   ├── context-retriever.md   # Context Retriever
│   │   ├── externalscout.md       # MemoryArchivist (external docs)
│   │   └── task-manager.md        # MemoryCurator (task decomposition)
│   ├── code/                      # Code subagents (validation, build)
│   │   ├── reviewer.md            # MemoryGuardian (inspector)
│   │   ├── coder-agent.md         # MemoryBuilder (implementation)
│   │   ├── build-agent.md         # MemoryValidator (build/typecheck)
│   │   └── test-engineer.md       # MemoryTester (test engineering)
│   ├── system-builder/            # System construction agents
│   │   ├── agent-generator.md     # AgentGenerator
│   │   ├── command-creator.md     # CommandCreator
│   │   ├── context-organizer.md   # MemoryOrganizer
│   │   ├── domain-analyzer.md     # DomainAnalyzer
│   │   └── workflow-designer.md   # WorkflowDesigner
│   └── utility/                   # Utility agents
│       └── eval-runner.md         # Evaluation harness (DO NOT USE DIRECTLY)
├── archive/                       # Archived agents (inactive)
├── content/                       # Content agents
├── data/                          # Data agents
├── meta/                          # Meta-system agents
└── schema/                        # Schema definitions
```

---

## Model Assignment — Cost-Aware Tiers

All agents run on Ollama Cloud. Models assigned by task complexity to balance capability and cost.

| Tier | Model | Agents |
|------|-------|--------|
| 🏎️ **V8** — Heavy agentic | `ollama/glm-5:cloud` | MemoryOrchestrator |
| 🚙 **SUV** — Deep reasoning | `ollama/gpt-oss:120b-cloud` | MemoryArchitect, AgentGenerator, DomainAnalyzer, WorkflowDesigner |
| 🚗 **Sedan** — Balanced | `ollama/kimi-k2.5:cloud` | MemoryCurator |
| ⚡ **EV** — Code-optimized | `ollama/qwen3.5-coder:cloud` | MemoryBuilder ×2, MemoryTester, MemoryValidator |
| 🛻 **Pickup** — Docs/creative | `ollama/gemma4:31b-cloud` | MemoryChronicler, CommandCreator, MemoryOrganizer |
| 🛵 **Scooter** — Fast/cheap | `ollama/gemma4:e4b-cloud` | MemoryAnalyst, MemoryScout, MemoryGuardian, MemoryArchivist, Context Retriever |

**Rule:** Don't start GLM-5's engine unless the task needs multi-step agentic reasoning. Everything else runs on the right fuel for the job.

---

## The Surgical Team (7 Primary Agents)

Brooks's surgical team model: **one chief surgeon coordinates, specialists execute.**

### 1. MemoryOrchestrator (Chief Surgeon)
**Path**: `core/openagent.md`
**Model**: `ollama/glm-5:cloud`
**Role**: Brooks-bound architect — preserves conceptual integrity
**Invoke**: `@memory-orchestrator`

**Responsibilities**:
- Stage 1: Analyze request (conversational vs task)
- Stage 2: Discover context (dispatch MemoryScout)
- Stage 3: Approve approach (present proposal, wait for user approval)
- Stage 4: Execute (delegate to appropriate subagent)
- Stage 5: Validate and record (write to Postgres/Neo4j)

**Dispatches to**: Architect, Builder, Guardian, Scout, Analyst, Chronicler

---

### 2. MemoryArchitect (First Assistant)
**Path**: `core/MemoryArchitect.md`
**Model**: `ollama/gpt-oss:120b-cloud`
**Role**: System design and ADRs
**Invoke**: `@memory-architect`

**Best for**: Architecture decisions, interface contracts, ADR creation

---

### 3. MemoryBuilder (Builder)
**Path**: `core/MemoryBuilder.md`
**Model**: `ollama/qwen3.5-coder:cloud`
**Role**: Neo4j writes, Postgres inserts, schema work
**Invoke**: `@memory-builder`

**Permissions**: Bash=allow, Edit=allow, Write=allow

---

### 4. MemoryGuardian (Inspector)
**Path**: `subagents/code/reviewer.md`
**Model**: `ollama/gemma4:e4b-cloud`
**Role**: Validation and quality gates
**Invoke**: `@memory-guardian`

**Permissions**: Read-only (bash=deny, edit=deny, write=deny)

---

### 5. MemoryScout (Scout) ⭐
**Path**: `subagents/core/contextscout.md`
**Model**: `ollama/gemma4:e4b-cloud`
**Role**: Context discovery and research
**Invoke**: `@memory-scout`

**Exemption**: **Approval gate exempt** — can be called anytime for discovery

---

### 6. MemoryAnalyst (Analyst)
**Path**: `core/MemoryAnalyst.md`
**Model**: `ollama/gemma4:e4b-cloud`
**Role**: Memory system metrics and graph health
**Invoke**: `@memory-analyst`

**Permissions**: Read-only

---

### 7. MemoryChronicler (Chronicler)
**Path**: `subagents/core/documentation.md`
**Model**: `ollama/gemma4:31b-cloud`
**Role**: Documentation and specification
**Invoke**: `@memory-chronicler`

**Permissions**: Edit=allow, Write=allow

---

## Subagents Registry (8 Additional)

All registered in `.opencode/config/agent-metadata.json`.

| Agent | File | Model | Role |
|-------|------|-------|------|
| MemoryCurator | `core/task-manager.md` | `kimi-k2.5:cloud` | Task decomposition |
| MemoryArchivist | `core/externalscout.md` | `gemma4:e4b-cloud` | External docs via context7 |
| Context Retriever | `core/context-retriever.md` | `gemma4:e4b-cloud` | Generic context search |
| MemoryBuilder (coder) | `code/coder-agent.md` | `qwen3.5-coder:cloud` | Code implementation |
| MemoryValidator | `code/build-agent.md` | `qwen3.5-coder:cloud` | Build/typecheck validation |
| MemoryTester | `code/test-engineer.md` | `qwen3.5-coder:cloud` | Test engineering |
| AgentGenerator | `system-builder/agent-generator.md` | `gpt-oss:120b-cloud` | Generates new agent files |
| CommandCreator | `system-builder/command-creator.md` | `gemma4:31b-cloud` | Creates slash commands |
| MemoryOrganizer | `system-builder/context-organizer.md` | `gemma4:31b-cloud` | Structures context |
| DomainAnalyzer | `system-builder/domain-analyzer.md` | `gpt-oss:120b-cloud` | Domain concept extraction |
| WorkflowDesigner | `system-builder/workflow-designer.md` | `gpt-oss:120b-cloud` | Workflow design |

---

## Dispatch Protocol

**Quick Reference**: `.opencode/context/dispatch-protocol.md`
**Full Mapping**: `.opencode/config/agent-mapping.yaml`
**Registry**: `.opencode/config/agent-metadata.json`

### Sequence (Brooks's Law)

```
1. Scout    → Discover context (approval exempt)
2. Architect → Design approach
3. Orchestrator → Approve plan
4. Builder  → Implement
5. Guardian → Validate
6. Chronicler → Document
```

**Communication overhead grows as n(n-1)/2.** Do not spawn subagents indiscriminately.

---

## Two Worlds Model

### OpenCode CLI Agents (`.opencode/agent/`)
- **Runtime**: Terminal / OpenCode CLI
- **Naming**: `Memory{Role}`
- **Count**: 7 primary + 11 subagents
- **Purpose**: How Winston works (engineering brain)

### Org/Business Agents (Paperclip)
- **Runtime**: Paperclip dashboard
- **Naming**: `{org}-agent`
- **Examples**: `faithmeats-agent`, `audits-agent`, `crm-agent`
- **Purpose**: What works FOR clients/orgs

**Never confuse these worlds.** OpenCode agents are Winston's hands. Org agents are digital employees.

---

## Memory System (All Agents)

All Surgical Team agents share:

| Property | Value |
|----------|-------|
| PostgreSQL | Raw traces (`DATABASE_URL`) |
| Neo4j | Curated knowledge (`NEO4J_URI`) |
| Steel Frame | Enabled (`SUPERSEDES` pattern) |
| HITL | Required for knowledge promotion |
| group_id | `allura-roninmemory` (mandatory on every node) |
| Notion | `mcp__MCP_DOCKER__notion-*` tools (no Smithery) |

---

## Archived Agents

| Agent | Reason |
|-------|--------|
| MemoryCopywriter | Consolidated into MemoryChronicler |
| MemoryRepoManager | Git handled by MemoryBuilder |
| MemoryScribe | Consolidated into MemoryChronicler |

**Location**: `archive/`

---

## Config Files

| File | Location | Purpose |
|------|----------|---------|
| `agent-metadata.json` | `.opencode/config/` | Agent registry (paths, roles, models, deps) |
| `agent-mapping.yaml` | `.opencode/config/` | Full dispatch mapping |
| `menu.yaml` | `.opencode/config/` | Menu commands |
| `opencode.json` | `.opencode/` | Brain config (plugins, models, memory stores) |

---

*Last Updated: 2026-04-06*
*Version: 3.0.0*
*Architecture: Brooks Surgical Team + Cost-Aware Model Tiers*
