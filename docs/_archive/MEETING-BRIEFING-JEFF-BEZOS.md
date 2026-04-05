# roninmemory Executive Briefing
**Preparation for Meeting with Jeff Bezos**
**Date:** April 4, 2026
**Prepared by:** Frederick P. Brooks Jr. (AI Assistant)

---

## Executive Summary

**roninmemory** is the dual-database memory engine for the Allura Agent-OS — a unified AI engineering brain that separates raw execution traces (PostgreSQL) from curated knowledge (Neo4j). The system provides persistent, tenant-isolated, human-governed knowledge accumulation across all agent sessions.

**Key Statistics:**
- ✅ 1,854 tests passing
- ✅ 16/16 business requirements implemented
- ✅ 7/7 agent nodes created in Neo4j
- 🚧 1 critical blocker: ARCH-001 (groupIdEnforcer.ts)
- 🚀 First production workflow: Bank-auditor (`allura-audits`)
- 🧩 3 plugin formats: OpenCode (primary), Claude Code (partial), OpenClaw (not started)
- 📚 100+ skills across all plugins

---

## The Problem We're Solving

**AI Agents Have Amnesia**
- Agents wake up with no memory of past missions
- They repeat mistakes across sessions
- They build zero ongoing knowledge
- No audit trail for decision reconstruction

**Current Market Gap**
- No standardized memory layer for multi-agent systems
- No tenant isolation for multi-organization deployments
- No human-in-the-loop governance for behavior-changing knowledge
- No regulator-grade audit trails for compliance

---

## The Solution: Dual-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  POSTGRESQL 16                    NEO4J 5.26 + APOC     │
│  ┌─────────────┐                ┌─────────────────┐     │
│  │ Raw Traces  │ ──Curator──▶  │    Insights     │     │
│  │  (Noise)    │   (HITL)      │    (Signal)     │     │
│  └─────────────┘                └─────────────────┘     │
│  System of Record               System of Reason        │
│  FOR THE PRESENT              FOR DECISIONS            │
└─────────────────────────────────────────────────────────┘
```

### PostgreSQL Layer (The Present)
- **Append-only** event traces (never UPDATE, never DELETE)
- Every agent action, tool call, heartbeat logged
- 6-12 month audit trail for compliance
- Raw execution evidence for promotion review

### Neo4j Layer (Decisions)
- Curated knowledge graph with relationships
- **Immutable nodes** — never mutated in place
- **Versioned via SUPERSEDES** — old truth marked `deprecated`
- Agents can reason about "what was true then" vs "what is true now"

---

## The 5-Layer Allura Agent-OS

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **L1** | RuVix Kernel | 6 primitives, 12 syscalls, proof-gated mutation |
| **L2** | PostgreSQL + Neo4j | Dual persistence: raw events + curated knowledge |
| **L3** | Agent Runtime | Agent Contracts (ABI), lifecycle management |
| **L4** | Workflow & Orchestration | DAGs, A2A bus, HITL gates |
| **L5** | Paperclip + OpenClaw | Human interfaces, governance dashboard |

**Governance Rule:** Allura governs. Runtimes execute. Curators promote.

---

## Current Status

### Completed (2026-04-05)
- ✅ Created 7 Agent nodes in Neo4j knowledge graph
- ✅ Synced 7 Agent records to PostgreSQL `agents` table
- ✅ Established AgentGroup with INCLUDES relationships
- ✅ Documented relationship schemas (CONTRIBUTED, LEARNED, DECIDED, COLLABORATED_WITH, SUPERSEDES)
- ✅ Established documentation canon (`_bmad-output/planning-artifacts/source-of-truth.md`)
- ✅ Fixed tenant naming (`roninclaw-*` → `allura-*`)
- ✅ Updated all MCP configs to use `bunx` instead of `npx`
- ✅ Added security notes to AGENTS.md, techContext.md, copilot-instructions.md

### Critical Blocker
- 🔴 **ARCH-001**: `groupIdEnforcer.ts` is broken — blocks ALL multi-tenant features
  - Must validate `group_id` format matches `allura-{org}` pattern
  - Must enforce `group_id` on all PostgreSQL and Neo4j queries
  - Must prevent cross-tenant data leakage
  - **Risk**: High (security boundary)

### In Progress
- Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory
- Epic 2: Multi-Organization Plugin Architecture (planned)

---

## Plugin Architecture

We've built a **multi-platform plugin system** that delivers the same Allura Agent-OS functionality across different AI agent frameworks.

### OpenCode Plugin (Primary Implementation)

**Status:** ✅ Implemented  
**Location:** `.opencode/`  
**Purpose:** Primary implementation for OpenCode runtime

**Directory Structure:**
```
.opencode/
├── agent/                        # 8 Memory{Role} Agents
│   ├── MemoryOrchestrator.md     # Primary orchestrator (Winston)
│   ├── MemoryArchitect.md        # System design lead (Winston)
│   ├── MemoryBuilder.md          # Infrastructure implementation (Amelia)
│   ├── MemoryAnalyst.md          # Memory system metrics (Quinn)
│   ├── MemoryCopywriter.md       # Agent prompt writing (Paige)
│   ├── MemoryRepoManager.md      # Git operations (Winston)
│   ├── MemoryScribe.md           # Documentation/specs (Paige)
│   └── menu.yaml                 # Agent selection menu
├── skills/                       # 100+ Skills
│   ├── roninmemory-context/      # Session initialization
│   ├── bmad-*/                   # BMad workflow skills (40+)
│   ├── mcp-docker/               # MCP Docker integration
│   └── ... (100+ skills total)
├── command/                      # Slash commands
├── config/                       # Configuration
└── context/                      # Context files
```

**Agent Roles:**
| Agent | Model | Purpose |
|-------|-------|---------|
| MemoryOrchestrator | glm-5-cloud | Brooks-bound primary orchestrator, enforces conceptual integrity |
| MemoryArchitect | glm-5-cloud | System design, architecture decisions, pattern enforcement |
| MemoryBuilder | kimi-k2.5-cloud | Code implementation, infrastructure deployment, tool building |
| MemoryGuardian | glm-5-cloud | Code review, standard enforcement, security validation |
| MemoryScout | ministral-3:8b-cloud | Fast context discovery, file finding, information retrieval |
| MemoryAnalyst | glm-5-cloud | Performance analysis, metric tracking, status reporting |
| MemoryScribe | glm-5-cloud | Documentation writing, specification creation, ADR maintenance |

**Skill Categories:**
- **BMad Workflows** (40+): PRD creation, architecture design, sprint planning, story implementation
- **MCP Integration** (2): MCP Docker discovery, session initialization
- **Development** (5+): Superpowers, writing plans, verification gates

---

### Claude Code Plugin (Alternative Implementation)

**Status:** 🟡 Partial (1 agent, 1 skill)  
**Location:** `claude-plugin-allura/`  
**Purpose:** Allura Agent-OS for Claude Desktop users

**Key Insight:** Same functionality, different format. Uses `.claude-plugin/` directory structure.

**Directory Structure:**
```
claude-plugin-allura/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── agents/                       # 7 Memory{Role} Agents
│   ├── memory-orchestrator.md
│   ├── memory-architect.md
│   ├── memory-builder.md
│   ├── memory-guardian.md
│   ├── memory-scout.md
│   ├── memory-analyst.md
│   ├── memory-chronicler.md
│   └── README.md
├── skills/                       # BMad workflow skills
├── .mcp.json                     # MCP server configuration
├── settings.json                 # Default agent setting
└── README.md                     # Plugin documentation
```

**Agent Mapping:**
| OpenCode | Claude Code | Model |
|----------|-------------|-------|
| MemoryOrchestrator | memory-orchestrator | glm-5-cloud |
| MemoryArchitect | memory-architect | glm-5-cloud |
| MemoryBuilder | memory-builder | kimi-k2.5-cloud |
| MemoryGuardian | memory-guardian | glm-5-cloud |
| MemoryScout | memory-scout | ministral-3:8b-cloud |
| MemoryAnalyst | memory-analyst | glm-5-cloud |
| MemoryChronicler | memory-chronicler | glm-5-cloud |

**Installation Options:**
- **From npm:** `bun add -g allura-agent-os`
- **From local:** Clone repo, link plugin directory

---

### OpenClaw Plugin (Ubuntu Gateway)

**Status:** ❌ Not started  
**Location:** `openclaw-plugin-allura/`  
**Purpose:** Allura Agent-OS for OpenClaw runtime (Ubuntu gateway)

**Two Format Options:**

**Option 1: Native Format**
```
openclaw-plugin-allura/
├── openclaw.plugin.json         # Plugin manifest
├── src/
│   └── index.ts                 # register(api) entry point
├── agents/
│   └── *.ts                     # Agent implementations
├── skills/
│   └── *.ts                     # Skill implementations
├── mcp.json                     # MCP server configuration
└── README.md                    # Plugin documentation
```

**Option 2: Bundle Mode (Recommended)**
```
openclaw-plugin-allura/
├── bundle.json                  # Bundle manifest
├── .claude-plugin/
│   └── plugin.json              # Claude Code plugin
├── agents/
│   └── *.md                    # Agent definitions (Claude Code format)
├── skills/
│   └── */SKILL.md              # Skill definitions (Claude Code format)
├── .mcp.json                    # MCP server configuration
└── README.md                    # Plugin documentation
```

**Key Insight:** Bundle mode allows shared structure with Claude Code plugin — same agents and skills, just packaged differently.

---

### MCP Integration (All Plugins)

**MCP Servers Configured:**
| Server | Purpose | Security |
|--------|---------|----------|
| memory | Knowledge graph queries | Bun-only |
| neo4j-cypher | Neo4j graph queries | Environment variables |
| database-server | PostgreSQL queries | Environment variables |
| perplexity-ask | Perplexity web research | API key |
| github-official | GitHub API integration | Personal access token |
| sequa | Copilot context integration | API key |

**Security Note:** All plugins use `bunx` instead of `npx` to eliminate npm supply chain attack vectors.

---

## MCP Server Configuration

We use **Model Context Protocol (MCP)** servers to integrate external tools and services into our agent framework. All MCP servers run in Docker containers for security and reproducibility.

### Current MCP Servers

| Server | Purpose | Configuration |
|--------|---------|---------------|
| **memory** | Knowledge graph queries | `MEMORY_FILE_PATH` environment variable |
| **neo4j-cypher** | Neo4j graph queries | `NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` |
| **postgres** | PostgreSQL queries | `DATABASE_URL` environment variable |
| **perplexity-ask** | Perplexity web research | `perplexity-ask.api_key` |
| **github-official** | GitHub API integration | `github.personal_access_token` |
| **sequa** | Copilot context integration | `sequa.api_key` |

### MCP Server Configuration File

**Location:** `claude-plugin-allura/.mcp.json`

```json
{
  "mcpServers": {
    "memory": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE_PATH": "/tmp/allura-memory.json"
      }
    },
    "neo4j-cypher": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-neo4j-cypher"],
      "env": {
        "NEO4J_URL": "${NEO4J_URI}",
        "NEO4J_USERNAME": "${NEO4J_USER}",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}"
      }
    },
    "postgres": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "perplexity-ask": {
      "command": "bunx",
      "args": ["@perplexity/mcp-server"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}"
      }
    },
    "github-official": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "sequa": {
      "command": "bunx",
      "args": ["@sequa/mcp-server"],
      "env": {
        "SEQUA_API_KEY": "${SEQUA_API_KEY}"
      }
    }
  }
}
```

### MCP Server Security

- **Bun-only execution** — All MCP servers run via `bunx` to eliminate npm supply chain risks
- **Environment variables** — All sensitive credentials passed via environment variables
- **Docker isolation** — MCP servers run in Docker containers with network restrictions
- **API key management** — Keys stored in `.env.local` (never committed to Git)

### MCP Server Discovery

Use `mcp_mcp_docker_mcp-find` to discover available MCP servers:

```bash
# Find all MCP servers
mcp_mcp_docker_mcp-find(query: "memory")

# Find specific servers
mcp_mcp_docker_mcp-find(query: "perplexity")
mcp_mcp_docker_mcp-find(query: "github")
mcp_mcp_docker_mcp-find(query: "copilot")
```

### MCP Server Activation

Use `mcp_mcp_docker_mcp-add` to activate MCP servers:

```bash
# Activate Perplexity
mcp_mcp_docker_mcp-add(name: "perplexity-ask")

# Activate GitHub
mcp_mcp_docker_mcp-add(name: "github-official")

# Activate Sequa (Copilot)
mcp_mcp_docker_mcp-add(name: "sequa")
```

### MCP Server Configuration

Use `mcp_mcp_docker_mcp-config-set` to configure MCP servers:

```bash
# Configure Perplexity
mcp_mcp_docker_mcp-config-set(
  server: "perplexity-ask",
  config: { api_key: "YOUR_API_KEY" }
)

# Configure Sequa
mcp_mcp_docker_mcp-config-set(
  server: "sequa",
  config: { api_key: "YOUR_API_KEY" }
)
```

---

## Technical Stack

### Runtime & Package Management
- **Bun** (exclusive) — Zero-trust supply chain policy
- **TypeScript 5.9** — strict mode
- **Next.js 16** + **React 19**

### Databases
- **PostgreSQL 16** — Raw event traces, agent registry, promotion queue
- **Neo4j 5.26 + APOC** — Knowledge graph, versioned insights

### Infrastructure
- **Docker** — All services run in containers (no local execution)
- **Docker-in-Docker (DinD)** — ADAS candidate sandbox execution
- **Ollama** — Local + cloud LLM routing

### Agent Framework
- **OpenCode** — Agent runtime with MCP integration
- **OpenClaw** — Ubuntu gateway for human communication
- **MemoryOrchestrator** — Brooks-bound primary orchestrator

---

## Key Architectural Decisions

| ID | Decision | Status | Rationale |
|----|----------|--------|-----------|
| AD-01 | 2-phase commit for Neo4j + Postgres promotion | ✅ Decided | Atomicity across transactional systems |
| AD-02 | Immutable Neo4j nodes with SUPERSEDES chain | ✅ Decided | Preserves audit trail and lineage |
| AD-03 | Trigger-based auto-enqueue at DB level | ✅ Decided | Guarantees consistency without polling |
| AD-04 | Notion mirror is async and non-fatal | ✅ Decided | Prevents Notion API failures from blocking core pipeline |
| AD-05 | DinD sandbox with --network=none | ✅ Decided | Blast radius containment for untrusted code |
| AD-06 | Docker-only execution | ✅ Decided | Reproducibility, environment consistency |
| AD-07 | Two-tier model selection (stable vs experimental) | ✅ Decided | Stable baselines for evolutionary search |
| AD-08 | Ollama routing by `:cloud` suffix | ✅ Decided | Simple, zero-config routing |
| AD-09 | HITL governance for agent promotion | ✅ Decided | Prevents autonomous self-modification |
| AD-10 | PostgreSQL for all ADAS state | ✅ Decided | ACID guarantees, relational querying |
| AD-11 | Single-harness-per-evaluation | ✅ Decided | Avoids constraint violations in parallel execution |
| AD-12 | Bun exclusive over npm | ✅ Decided | Eliminates npm supply chain attack vectors |
| AD-13 | MemFS self-editing layers | ✅ Decided | Enables private agent reflection |
| AD-14 | Brooks-bound orchestrator | ✅ Decided | Canonical agents for consistency |
| AD-15 | Single-tier tenant isolation | ✅ Decided | `allura-*` `group_id` enforcement |
| AD-16 | Dual logging policy | ✅ Decided | PostgreSQL + Neo4j separation of concerns |

---

## Tenant Isolation Model

**group_id** is the primary tenant isolation boundary. Every record carries it.

```
allura-faith-meats     🥩 Faith Meats (P1)
allura-creative        🎨 Creative Studio (P2)
allura-personal        👤 Personal Assistant (P2)
allura-nonprofit       🏛️ Nonprofit (P3)
allura-audits          🏦 Bank Audits (P3)
allura-haccp           🌡️ HACCP (P3)
allura-platform        🌐 Global fallback
```

**Legacy (`roninclaw-*`) is deprecated.**

---

## HITL Governance Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │────▶│   Curator    │────▶│   Auditor    │
│  (Traces)    │     │  (Proposes)  │     │  (Approves)  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────┐
                                          │    Neo4j     │
                                          │  (Knowledge) │
                                          └──────────────┘
```

**Governance Rule:** Agents CANNOT autonomously promote to Neo4j/Notion. Human approval required.

---

## First Production Workflow: Bank-Auditor

**Workspace:** `allura-audits` (Faith Meats bank audit automation)
**Purpose:** Mortgage audit automation with regulator-grade audit trails
**Compliance:** GLBA for bank audits

---

## Success Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Memory persistence | 100% recovery after restart | ✅ Implemented |
| Tenant isolation | Zero cross-tenant leakage | 🚧 Blocked by ARCH-001 |
| Audit trail | 6-12 month reconstruction | ✅ Implemented |
| First workflow | Bank-auditor live | 🚧 Awaiting ARCH-001 fix |
| Tests passing | 1,854 tests | ✅ Achieved |
| Business requirements | 16/16 implemented | ✅ Achieved |

---

## Risks & Mitigations

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| RK-01 | groupIdEnforcer.ts broken | 🔴 Critical | Fix ARCH-001 before any other work |
| RK-02 | Cross-tenant data leakage | 🔴 Critical | Enforce group_id at schema level |
| RK-03 | Notion API rate limits | 🟡 High | Async, non-fatal mirror |
| RK-04 | Agent runaway spending | 🟡 High | Budget circuit breakers |
| RK-05 | DinD security breach | 🟡 High | --network=none, --cap-drop=ALL |
| RK-06 | Ollama cloud costs | 🟢 Low | Local models first, cloud opt-in |
| RK-07 | Model quality drift | 🟡 High | Two-tier model selection |
| RK-08 | Experimental model corruption | 🟡 High | Stable baselines only for ADAS |
| RK-09 | Supply chain attack | 🟡 High | Bun-only, no npm postinstall |
| RK-10 | Environment drift | 🟡 High | Docker-only execution |

---

## Meeting Preparation Questions

**For Jeff Bezos:**

1. **Strategic Alignment**
   - How does this align with Amazon's AI strategy?
   - What's the vision for AI agents at Amazon scale?
   - How do we measure success for this project?

2. **Resource Allocation**
   - What resources (engineering, compute, budget) are available?
   - What's the timeline for production deployment?
   - What's the approval process for key decisions?

3. **Technical Direction**
   - Should we consider AWS services (Bedrock, DynamoDB, etc.)?
   - What's the expectation for multi-tenancy at scale?
   - How should we handle compliance requirements?

4. **Governance**
   - What's the human oversight requirement for behavior-changing knowledge?
   - How should we balance autonomy vs. control?
   - What's the escalation path for critical issues?

---

## Next Steps

1. **Immediate (Before Meeting)**
   - Fix ARCH-001 (groupIdEnforcer.ts) — critical blocker
   - Complete Epic 1 stories (1.1-1.7)
   - Update documentation canon
   - Prepare live demo environment

2. **Short-Term (Post-Meeting)**
   - Implement approved architectural changes
   - Scale to production workloads
   - Add additional production workflows (Faith Meats, HACCP)
   - Complete Epic 2 (Plugin Architecture)

3. **Long-Term**
   - Epic 3: Human-in-the-Loop Governance
   - Epic 4: Cross-Organization Knowledge Sharing
   - Epic 5: Regulator-Grade Audit Trail
   - Epic 6: Production Workflows

---

## Appendix: Key Files & References

| File | Purpose |
|------|---------|
| `docs/BLUEPRINT.md` | Core architecture and data model |
| `docs/SOLUTION-ARCHITECTURE.md` | Component topology and API surface |
| `docs/REQUIREMENTS-MATRIX.md` | Business and functional requirements |
| `docs/DATA-DICTIONARY.md` | PostgreSQL tables and Neo4j schema |
| `docs/RISKS-AND-DECISIONS.md` | Architectural decisions and risks |
| `_bmad-output/planning-artifacts/` | Source of truth for planning |
| `_bmad-output/implementation-artifacts/` | Implementation specifications |
| `memory-bank/` | Session context and active work |

---

**Prepared by:** Frederick P. Brooks Jr. (AI Assistant)  
**Date:** April 4, 2026  
**Version:** 1.0  
**Status:** Draft — Awaiting Review
