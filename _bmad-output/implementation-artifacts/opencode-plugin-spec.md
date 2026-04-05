# 🧩 OpenCode Plugin Spec

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.


> **Canonical specification for OpenCode plugin implementation.**
> **Status:** ✅ Implemented
> **Location:** `.opencode/`

---

## Overview

The OpenCode plugin is the **primary implementation** of Allura Agent-OS. It provides:

- **8 Memory{Role} Agents** — Workflow orchestration, design, implementation, validation
- **100+ Skills** — BMad workflows, MCP Docker integration, development tools
- **Commands** — Slash commands for common operations
- **Context System** — Project-specific context loading

---

## Plugin Architecture

### Directory Structure

```
.opencode/
├── agent/                        # Agent definitions
│   ├── MemoryOrchestrator.md     # Primary orchestrator (Winston)
│   ├── MemoryArchitect.md        # System design lead (Winston)
│   ├── MemoryBuilder.md          # Infrastructure implementation (Amelia)
│   ├── MemoryAnalyst.md          # Memory system metrics (Quinn)
│   ├── MemoryCopywriter.md       # Agent prompt writing (Paige)
│   ├── MemoryRepoManager.md      # Git operations (Winston)
│   ├── MemoryScribe.md           # Documentation/specs (Paige)
│   ├── README.md                 # Agent menu reference
│   └── menu.yaml                 # Agent selection menu
│
├── skills/                       # Skill definitions
│   ├── roninmemory-context/      # Session initialization
│   │   └── SKILL.md
│   ├── bmad-*/                   # BMad workflow skills (40+)
│   ├── mcp-docker/               # MCP Docker integration
│   ├── qdrant-*/                 # Qdrant skills (10+)
│   ├── superpowers-*/           # Superpowers skills
│   ├── wds-*/                    # Web Design System skills
│   └── ... (100+ skills total)
│
├── command/                      # Slash commands
│   └── ralph-loop.md            # Ralph command
│
├── config/                       # Configuration
│   ├── agent-metadata.json      # Agent registry
│   └── memory-contract.md       # Memory policy
│
├── context/                      # Context files
│   ├── project/
│   │   └── bmad-integration.md  # BMad routing guide
│   ├── core/
│   │   ├── standards/           # Code quality standards
│   │   └── workflows/           # Workflow definitions
│   └── navigation.md            # Context index
│
└── opencode.json                # Plugin configuration
```

---

## Agent Definitions

### MemoryOrchestrator (Primary)

**Role:** Brooks-bound primary orchestrator
**Model:** `glm-5-cloud`
**Description:** Coordinates all BMad workflows, enforces conceptual integrity, manages approval gates

```yaml
id: memory-orchestrator
name: MemoryOrchestrator
model: glm-5-cloud
color: accent
capabilities:
  - BMad workflow coordination
  - Approval gate management
  - Subagent delegation
  - Memory system governance
```

### MemoryArchitect (Design)

**Role:** System design lead
**Model:** `glm-5-cloud`
**Description:** Handles essential complexity, maintains architecture integrity

```yaml
id: memory-architect
name: MemoryArchitect
model: glm-5-cloud
color: primary
capabilities:
  - System design
  - Architecture decisions
  - Technical specifications
  - Pattern enforcement
```

### MemoryBuilder (Implementation)

**Role:** Infrastructure implementation
**Model:** `kimi-k2.5-cloud` (coding-specialized)
**Description:** Implements code, infrastructure, and tooling

```yaml
id: memory-builder
name: MemoryBuilder
model: kimi-k2.5-cloud
color: success
capabilities:
  - Code implementation
  - Infrastructure deployment
  - Tool building
  - Test execution
```

### MemoryGuardian (Validation)

**Role:** Quality gates and validation
**Model:** `glm-5-cloud`
**Description:** Reviews code, enforces standards, validates outputs

```yaml
id: memory-guardian
name: MemoryGuardian
model: glm-5-cloud
color: warning
capabilities:
  - Code review
  - Standard enforcement
  - Security validation
  - Quality gates
```

### MemoryScout (Discovery)

**Role:** Context discovery
**Model:** `ministral-3:8b-cloud` (fast context)
**Description:** Finds context, discovers files, retrieves information

```yaml
id: memory-scout
name: MemoryScout
model: ministral-3:8b-cloud
color: secondary
capabilities:
  - File discovery
  - Context retrieval
  - Information gathering
  - Quick searches
```

### MemoryAnalyst (Metrics)

**Role:** Memory system metrics
**Model:** `glm-5-cloud`
**Description:** Analyzes system performance, tracks metrics, reports status

```yaml
id: memory-analyst
name: MemoryAnalyst
model: glm-5-cloud
color: info
capabilities:
  - Performance analysis
  - Metric tracking
  - Status reporting
  - Trend analysis
```

### MemoryChronicler (Documentation)

**Role:** Documentation and specs
**Model:** `glm-5-cloud`
**Description:** Creates documentation, maintains specs, writes ADRs

```yaml
id: memory-chronicler
name: MemoryChronicler
model: glm-5-cloud
color: primary
capabilities:
  - Documentation writing
  - Specification creation
  - ADR maintenance
  - Knowledge curation
```

---

## Skill Categories

### BMad Workflow Skills (40+)

| Category | Skills | Purpose |
|----------|--------|---------|
| **Analysis** | `bmad-product-brief`, `bmad-market-research`, `bmad-domain-research` | Requirements discovery |
| **Planning** | `bmad-create-prd`, `bmad-create-architecture`, `bmad-create-ux-design` | Specification creation |
| **Solutioning** | `bmad-create-epics-and-stories`, `bmad-sprint-planning` | Sprint planning |
| **Implementation** | `bmad-dev-story`, `bmad-quick-dev` | Story execution |
| **Testing** | `bmad-testarch-*`, `bmad-qa-*` | Quality assurance |
| **Review** | `bmad-code-review`, `bmad-retrospective` | Process improvement |

### MCP Integration Skills

| Skill | Purpose |
|-------|---------|
| `mcp-docker` | Discover and manage MCP servers |
| `roninmemory-context` | Session initialization |

### Development Skills

| Skill | Purpose |
|-------|---------|
| `superpowers-*` | Enhanced development workflows |
| `writing-plans` | Implementation planning |
| `verification-before-completion` | Quality gates |

---

## Configuration

### Package Management

> **Security Note:** This project uses **Bun exclusively** for package management to avoid npm supply chain risks. Never use `npm` or `npx` commands.

### opencode.json

```json
{
  "defaultAgent": "MemoryOrchestrator",
  "providers": [
    {
      "name": "GLM-5",
      "type": "ollama-cloud",
      "models": ["glm-5-cloud"]
    },
    {
      "name": "Kimi",
      "type": "ollama-cloud",
      "models": ["kimi-k2.5-cloud"]
    },
    {
      "name": "Ministral",
      "type": "ollama-cloud",
      "models": ["ministral-3:8b-cloud"]
    }
  ],
  "agents": [
    {
      "id": "memory-orchestrator",
      "name": "MemoryOrchestrator",
      "model": "glm-5-cloud",
      "promptFile": ".opencode/agent/MemoryOrchestrator.md"
    }
  ]
}
```

### MCP Configuration

MCP servers are configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-memory"]
    },
    "neo4j-cypher": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-neo4j-cypher"],
      "env": {
        "NEO4J_URL": "${NEO4J_URI}",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}"
      }
    },
    "database-server": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

> **Note:** Use `bunx` instead of `npx` for better security and performance.

---

## Memory Integration

### Agent Memory Nodes

Each agent has a corresponding Neo4j node:

```cypher
CREATE (a:Agent {
  id: 'agent.memory-{role}',
  name: 'Memory{Role}',
  group_id: 'allura-default',
  created: datetime(),
  model: '{model_name}',
  confidence: 0.0
})
```

### Relationship Types

| Relationship | From → To | Purpose |
|--------------|-----------|---------|
| `CONTRIBUTED` | Agent → Insight | Agent created knowledge |
| `LEARNED` | Agent → Session | Agent gained context |
| `DECIDED` | Agent → Decision | Agent made governance decision |
| `COLLABORATED_WITH` | Agent → Agent | Agents worked together |
| `INCLUDES` | AgentGroup → Agent | Team membership |
| `KNOWS` | Agent → Agent | Awareness for handoffs |

---

## Usage

### Starting a Session

```bash
# Install dependencies with Bun
bun install

# Load project context
/skill roninmemory-context

# Activate default agent (MemoryOrchestrator)
@MemoryOrchestrator What did we do so far?
```

> **Security Note:** Always use `bun` and `bunx` commands. Never use `npm` or `npx`.

### Running BMad Workflows

```bash
# Create PRD
/skill bmad-create-prd

# Create architecture
/skill bmad-create-architecture

# Generate sprint plan
/skill bmad-sprint-planning

# Develop a story
/skill bmad-dev-story
```

### Memory Operations

```bash
# Search memory
MCP_DOCKER_search_nodes({query: "allura architecture"})

# Create entity
MCP_DOCKER_create_entities({entities: [...]})

# Read graph
MCP_DOCKER_read_graph()
```

---

## Integration with Other Plugins

| Client | Plugin | Compatibility |
|--------|--------|---------------|
| OpenCode | `.opencode/` | ✅ Native |
| Claude Code | `claude-plugin-allura/` | ✅ Compatible format |
| OpenClaw | `openclaw-plugin-allura/` | ✅ Bundle mode |

**Migration Path:**
1. OpenCode is the primary development environment
2. Export to Claude Code format for Claude Desktop users
3. Export to OpenClaw format for OpenClaw runtime users

---

## See Also

- [Claude Code Plugin Spec](./claude-code-plugin-spec.md)
- [OpenClaw Plugin Spec](./openclaw-plugin-spec.md)
- [Agent Memory Architecture](./architectural-brief.md)
- [MCP Docker Integration](./mcp-docker-integration.md)