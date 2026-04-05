# 🧩 Claude Code Plugin Spec

> **Canonical specification for Claude Code plugin implementation.**
> **Status:** 🟡 Partial (1 agent, 1 skill)
> **Location:** `claude-plugin-allura/`

---

## Overview

The Claude Code plugin provides **Allura Agent-OS functionality for Claude Desktop users**. It uses the `.claude-plugin/` format which Claude Code can load as an extension.

### Key Insight

**Same functionality, different format:**
- Agents, skills, and MCP configuration are identical to OpenCode
- Plugin format follows Claude Code conventions (`.claude-plugin/`)
- Can be installed from npm or local directory

---

## Plugin Architecture

### Directory Structure

```
claude-plugin-allura/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
│
├── agents/                       # Agent definitions
│   ├── memory-orchestrator.md    # Primary orchestrator (Winston)
│   ├── memory-architect.md       # System design lead (Winston)
│   ├── memory-builder.md         # Implementation (Amelia)
│   ├── memory-guardian.md        # Validation (Winston)
│   ├── memory-scout.md           # Discovery (fast context)
│   ├── memory-analyst.md         # Metrics (Quinn)
│   ├── memory-chronicler.md      # Documentation (Paige)
│   └── README.md                 # Agent documentation
│
├── skills/                       # Skill definitions
│   ├── roninmemory-context/
│   │   └── SKILL.md              # Session initialization
│   ├── bmad-create-prd/
│   │   └── SKILL.md              # PRD creation workflow
│   ├── bmad-create-architecture/
│   │   └── SKILL.md              # Architecture design
│   └── ...                       # Additional skills
│
├── .mcp.json                     # MCP server configuration
├── settings.json                 # Default agent setting
└── README.md                     # Plugin documentation
```

---

## Plugin Manifest

### `.claude-plugin/plugin.json`

```json
{
  "name": "allura-agent-os",
  "version": "1.0.0",
  "description": "Allura Agent-OS: Governed memory system with dual persistence",
  "namespace": "allura-agent-os",
  "author": "ronin704",
  "license": "MIT",
  "repository": "https://github.com/ronin704/roninmemory",
  "keywords": [
    "allura",
    "agent-os",
    "memory",
    "neo4j",
    "postgresql",
    "bmad"
  ],
  "engines": {
    "claude-code": ">=1.0.0"
  }
}
```

---

## Agent Definitions

### Agent Format

Agents are defined in Markdown files with frontmatter:

```markdown
---
id: memory-orchestrator
name: MemoryOrchestrator
model: glm-5-cloud
---

# MemoryOrchestrator

> Brooks-bound primary orchestrator. Manages workflow coordination and approval gates.

## Responsibilities

1. Coordinate all BMad workflows
2. Enforce conceptual integrity
3. Manage approval gates
4. Delegate to specialized subagents

## Capabilities

- BMad workflow coordination
- Approval gate management
- Subagent delegation
- Memory system governance

## Memory Integration

Each agent has a Neo4j node:

CREATE (a:Agent {
  id: 'agent.memory-orchestrator',
  name: 'MemoryOrchestrator',
  group_id: 'allura-default',
  model: 'glm-5-cloud',
  confidence: 0.0
})
```

### Agent Mapping

| OpenCode | Claude Code | Model |
|----------|-------------|-------|
| MemoryOrchestrator.md | memory-orchestrator.md | glm-5-cloud |
| MemoryArchitect.md | memory-architect.md | glm-5-cloud |
| MemoryBuilder.md | memory-builder.md | kimi-k2.5-cloud |
| MemoryGuardian.md | memory-guardian.md | glm-5-cloud |
| MemoryScout.md | memory-scout.md | ministral-3:8b-cloud |
| MemoryAnalyst.md | memory-analyst.md | glm-5-cloud |
| MemoryChronicler.md | memory-chronicler.md | glm-5-cloud |

---

## Skill Definitions

### Skill Format

Skills are defined in `SKILL.md` files:

```markdown
---
name: roninmemory-context
description: Session initialization for Allura Agent-OS project
trigger: "Use this skill FIRST when starting any session"
priority: critical
---

# Session Initialization

Load all context before starting work:

1. Read memory-bank/activeContext.md
2. Read memory-bank/progress.md
3. Read memory-bank/systemPatterns.md
4. Read _bmad-output/planning-artifacts/source-of-truth.md
5. Review .github/copilot-instructions.md

## Display Required

- Neo4j connection status
- PostgreSQL connection status
- Current session context
- Blockers and critical path
```

### Priority Skills to Migrate

| Skill | Priority | Notes |
|-------|----------|-------|
| `roninmemory-context` | ✅ Done | Session initialization |
| `bmad-create-prd` | High | PRD creation workflow |
| `bmad-create-architecture` | High | Architecture design |
| `bmad-dev-story` | High | Story implementation |
| `mcp-docker` | High | MCP integration |

---

## MCP Configuration

### `.mcp.json`

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

## Default Agent

### `settings.json`

```json
{
  "defaultAgent": "memory-orchestrator"
}
```

---

## Installation

### From npm (Published)

```bash
# Install globally with Bun
bun add -g allura-agent-os

# Install in project
bun add allura-agent-os --dev
```

### From Local Directory

```bash
# Clone repository
git clone https://github.com/ronin704/roninmemory.git

# Install dependencies with Bun
bun install

# Link plugin
ln -s roninmemory/claude-plugin-allura ~/.claude/plugins/allura-agent-os
```

### Claude Desktop Configuration

Add to Claude Desktop config:

```json
{
  "plugins": [
    "allura-agent-os"
  ]
}
```

---

## Usage

### Activate Session Context

```
/skill roninmemory-context
```

### Use BMad Workflows

```
/skill bmad-create-prd
/skill bmad-create-architecture
/skill bmad-dev-story
```

### Memory Operations

```
MCP_DOCKER_search_nodes({query: "allura architecture"})
MCP_DOCKER_create_entities({entities: [...]})
MCP_DOCKER_read_graph()
```

---

## Migration from OpenCode

### What to Migrate

| Source | Target | Notes |
|--------|--------|-------|
| `.opencode/agent/*.md` | `agents/*.md` | Lowercase filenames |
| `.opencode/SKILL.md` | `skills/*/SKILL.md` | Each skill in own directory |
| `.opencode/opencode.json` | `.claude-plugin/plugin.json` | Convert format |
| `.opencode/.mcp.json` | `.mcp.json` | Same format |
| `.opencode/config/*` | `config/` | Shared config files |

### What NOT to Migrate

- `.opencode/command/` — Commands are OpenCode-specific
- `.opencode/context/` — Context files remain in OpenCode
- BMad skill files — Migrate only priority skills

---

## OpenClaw Bundle Mode

OpenClaw can load Claude Code plugin format directly via **bundle mode**:

```
openclaw --bundle claude-plugin-allura
```

This allows shared plugin structure between Claude Code and OpenClaw users.

---

## Current Status

### Completed

- ✅ Plugin manifest (`.claude-plugin/plugin.json`)
- ✅ MemoryOrchestrator agent (`agents/memory-orchestrator.md`)
- ✅ roninmemory-context skill (`skills/roninmemory-context/SKILL.md`)
- ✅ MCP configuration (`.mcp.json`)
- ✅ Default agent (`settings.json`)
- ✅ README documentation

### Pending

- ⏳ Remaining 6 agent definitions
- ⏳ BMad workflow skills
- ⏳ MCP Docker skill
- ⏳ Testing with Claude Desktop
- ⏳ npm package publishing

---

## See Also

- [OpenCode Plugin Spec](./opencode-plugin-spec.md)
- [OpenClaw Plugin Spec](./openclaw-plugin-spec.md)
- [Agent Memory Architecture](./architectural-brief.md)
- [MCP Docker Integration](./mcp-docker-integration.md)