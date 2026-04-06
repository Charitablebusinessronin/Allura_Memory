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
│   │   ├── context-retriever.md   # Context retrieval
│   │   ├── externalscout.md       # External discovery
│   │   └── task-manager.md        # Task coordination
│   ├── code/                      # Code subagents (validation, build)
│   │   ├── reviewer.md            # MemoryGuardian (inspector)
│   │   ├── coder-agent.md         # Code implementation
│   │   ├── build-agent.md         # Build automation
│   │   └── test-engineer.md       # Test engineering
│   └── utility/                   # Utility agents
│       └── eval-runner.md         # Evaluation harness
├── archive/                       # Archived agents (inactive)
├── content/                       # Content agents
├── data/                          # Data agents
├── meta/                          # Meta-system agents
└── schema/                        # Schema definitions
```

---

## The Surgical Team (7 Primary Agents)

Brooks's surgical team model: **one chief surgeon coordinates, specialists execute.**

### 1. MemoryOrchestrator (Chief Surgeon)
**Path**: `.opencode/agent/core/openagent.md`
**Role**: Brooks-bound architect — preserves conceptual integrity
**Persona**: Frederick P. Brooks Jr. (author of *The Mythical Man-Month*)
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
**Path**: `.opencode/agent/core/MemoryArchitect.md`
**Role**: System design and ADRs
**Persona**: Winston (design)
**Invoke**: `@memory-architect`

**Best for**:
- Architecture decisions
- Interface contracts
- Technical design documents
- ADR creation

**Dependencies**: `bmad-create-architecture`, `mcp-docker`

---

### 3. MemoryBuilder (Builder)
**Path**: `.opencode/agent/core/MemoryBuilder.md`
**Role**: Implementation and infrastructure
**Persona**: Amelia (implementation)
**Invoke**: `@memory-builder`

**Best for**:
- Code implementation
- Schema work
- Database writes
- Infrastructure setup

**Permissions**: Bash=allow, Edit=allow, Write=allow

---

### 4. MemoryGuardian (Inspector)
**Path**: `.opencode/agent/subagents/code/reviewer.md`
**Role**: Validation and quality gates
**Persona**: Quinn (validation)
**Invoke**: `@memory-guardian`

**Best for**:
- Code review
- Invariant enforcement
- HITL gate validation
- Security audit

**Permissions**: Read-only (bash=deny, edit=deny, write=deny)

---

### 5. MemoryScout (Scout) ⭐
**Path**: `.opencode/agent/subagents/core/contextscout.md`
**Role**: Context discovery and research
**Persona**: Discovery agent
**Invoke**: `@memory-scout`

**Exemption**: **Approval gate exempt** — can be called anytime for discovery

**Best for**:
- Finding standards
- Discovering patterns
- Context retrieval
- Research

**Dependencies**: `skill:mcp-docker`, `tool:mcp-docker`

---

### 6. MemoryAnalyst (Analyst)
**Path**: `.opencode/agent/core/MemoryAnalyst.md`
**Role**: Memory system metrics and graph health
**Persona**: Metrics agent (read-only)
**Invoke**: `@memory-analyst`

**Best for**:
- Trace analysis
- Graph health checks
- Memory metrics
- Usage reports

**Permissions**: Read-only

---

### 7. MemoryChronicler (Chronicler)
**Path**: `.opencode/agent/subagents/core/documentation.md`
**Role**: Documentation and specification
**Persona**: Paige (documentation)
**Invoke**: `@memory-chronicler`

**Best for**:
- Documentation generation
- Spec updates
- Changelogs
- Knowledge capture

**Permissions**: Edit=allow, Write=allow

---

## Dispatch Protocol

**Quick Reference**: `.opencode/context/dispatch-protocol.md`
**Full Mapping**: `.opencode/config/agent-mapping.yaml`
**Menu Commands**: `.opencode/config/menu.yaml`

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

> **Crystal Clear Distinction**

### OpenCode CLI Agents (`.opencode/agent/`)
- **Runtime**: Terminal / OpenCode CLI
- **Naming**: `Memory{Role}`
- **Count**: 7 primary + subagents
- **Purpose**: How Winston works

### Org/Business Agents (Paperclip)
- **Runtime**: Paperclip dashboard
- **Naming**: `{org}-agent`
- **Examples**: `faithmeats-agent`, `audits-agent`, `crm-agent`
- **Purpose**: What works FOR clients/orgs

**Never confuse these worlds.** OpenCode agents are Winston's hands. Org agents are digital employees.

---

## Memory System (All Agents)

All 7 Surgical Team agents share:

| Property | Value |
|----------|-------|
| PostgreSQL | Raw traces (`DATABASE_URL`) |
| Neo4j | Curated knowledge (`NEO4J_URI`) |
| Steel Frame | Enabled (`SUPERSEDES` pattern) |
| HITL | Required for knowledge promotion |
| behavior_lock | `"UNPROMOTED"` sentinel |
| group_id | Mandatory on every node |

**Bootstrap**: Each agent runs bootstrap protocol connecting to Postgres + Neo4j before work.

---

## Archived Agents

| Agent | Reason |
|-------|--------|
| MemoryCopywriter | Consolidated into MemoryChronicler |
| MemoryRepoManager | Git handled by MemoryBuilder |
| MemoryScribe | Consolidated into MemoryChronicler |

**Location**: `.opencode/agent/archive/`

---

## Config Files

| File | Location | Purpose |
|------|----------|---------|
| agent-metadata.json | `.opencode/config/` | Agent registry (paths, roles, deps) |
| agent-mapping.yaml | `.opencode/config/` | Full dispatch mapping |
| menu.yaml | `.opencode/config/` | Menu commands |
| dispatch-protocol.md | `.opencode/context/` | Quick reference |
| bmad-integration.md | `.opencode/context/project/` | BMad routing guide |

---

## Common Workflows

### Standard Task
```
1. Scout → Discover context (approval exempt)
2. Orchestrator → Approve plan
3. Architect → Design (if architecture)
4. Builder → Implement
5. Guardian → Validate
6. Chronicler → Document
```

### External Library Integration
```
1. Scout → Find project standards
2. Archivist → Fetch current docs (skill: context7)
3. Builder → Implement with current docs
4. Guardian → Validate
```

---

## Critical Rules (Brooksian)

1. **Conceptual integrity above all** — one mind, one vision
2. **Scout is approval exempt** — discover anytime
3. **No execution without approval** — Stage 3 gate is mandatory
4. **Log every decision** — Postgres traces, Neo4j wisdom
5. **Group ID on every node** — tenant isolation is non-negotiable
6. **HITL for promotion** — no autonomous Neo4j/Notion writes

---

## Source of Truth

- **Agent paths**: `.opencode/config/agent-metadata.json`
- **BMad routing**: `.opencode/context/project/bmad-integration.md`
- **Skills**: `.opencode/skills/*/SKILL.md`
- **BMad workflows**: `_bmad/*/`

---

*Last Updated: 2026-04-06*
*Version: 2.0.0*
*Architecture: Brooks Surgical Team*