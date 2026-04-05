# 🧩 OpenClaw Plugin Spec

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.


> **Canonical specification for OpenClaw plugin implementation.**
> **Status:** ❌ Not started
> **Location:** `openclaw-plugin-allura/`

---

## Overview

The OpenClaw plugin provides **Allura Agent-OS functionality for OpenClaw runtime users**. OpenClaw supports two plugin formats:

1. **Native format** — `openclaw.plugin.json` + TypeScript module
2. **Bundle mode** — Load `.claude-plugin/` format directly

### Key Insight

**Same functionality, different format:**
- Agents, skills, and MCP configuration are identical to OpenCode
- Plugin can be native TypeScript or Claude Code bundle
- Bundle mode allows shared structure with Claude Code plugin

---

## Plugin Architecture

### Option 1: Native Format

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

### Option 2: Bundle Mode (Recommended)

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

---

## Native Format: openclaw.plugin.json

### Plugin Manifest

```json
{
  "name": "allura-agent-os",
  "version": "1.0.0",
  "description": "Allura Agent-OS: Governed memory system with dual persistence",
  "author": "ronin704",
  "license": "MIT",
  "main": "src/index.ts",
  "openclaw": {
    "apiVersion": "1.0.0",
    "capabilities": [
      "agents",
      "skills",
      "mcp",
      "memory"
    ],
    "permissions": [
      "memory:read",
      "memory:write",
      "database:query",
      "database:mutate"
    ]
  }
}
```

### Entry Point: src/index.ts

```typescript
import type { OpenClawAPI } from 'openclaw';

export async function register(api: OpenClawAPI) {
  // Register agents
  api.registerAgent({
    id: 'allura.orchestrator',
    name: 'MemoryOrchestrator',
    description: 'Brooks-bound primary orchestrator',
    model: 'glm-5-cloud',
    handler: async (context) => {
      // Agent implementation
    }
  });

  // Register skills
  api.registerSkill({
    id: 'allura.roninmemory-context',
    name: 'roninmemory-context',
    description: 'Session initialization for Allura Agent-OS',
    handler: async (context) => {
      // Skill implementation
    }
  });

  // Register MCP providers
  api.registerMCPProvider({
    name: 'memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory']
  });

  // Register MCP providers with env
  api.registerMCPProvider({
    name: 'neo4j-cypher',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-server-neo4j-cypher'],
    env: {
      NEO4J_URL: process.env.NEO4J_URI,
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD
    }
  });
}
```

---

## Bundle Mode: bundle.json

### Bundle Manifest

```json
{
  "name": "allura-agent-os",
  "version": "1.0.0",
  "description": "Allura Agent-OS: Governed memory system with dual persistence",
  "format": "claude-plugin",
  "entry": ".claude-plugin/plugin.json",
  "agents": [
    "agents/memory-orchestrator.md",
    "agents/memory-architect.md",
    "agents/memory-builder.md",
    "agents/memory-guardian.md",
    "agents/memory-scout.md",
    "agents/memory-analyst.md",
    "agents/memory-chronicler.md"
  ],
  "skills": [
    "skills/roninmemory-context/SKILL.md"
  ]
}
```

---

## Agent Definitions

### Native Format: Agent Implementation

```typescript
// agents/orchestrator.ts
import type { AgentHandler } from 'openclaw';

export const orchestrator: AgentHandler = {
  id: 'allura.orchestrator',
  name: 'MemoryOrchestrator',
  description: 'Brooks-bound primary orchestrator',
  model: 'glm-5-cloud',

  async handle(context) {
    const { messages, tools, memory } = context;

    // Load session context
    const sessionContext = await memory.query({
      query: 'session-context',
      group_id: 'allura-default'
    });

    // Process messages with context
    // ...

    return {
      response: '...',
      memoryUpdates: [...]
    };
  }
};
```

### Bundle Format: Agent Definition

```markdown
---
id: memory-orchestrator
name: MemoryOrchestrator
model: glm-5-cloud
---

# MemoryOrchestrator

> Brooks-bound primary orchestrator. Manages workflow coordination and approval gates.

## Capabilities

- BMad workflow coordination
- Approval gate management
- Subagent delegation
- Memory system governance

## Memory Integration

CREATE (a:Agent {
  id: 'agent.memory-orchestrator',
  name: 'MemoryOrchestrator',
  group_id: 'allura-default',
  model: 'glm-5-cloud',
  confidence: 0.0
})
```

---

## MCP Configuration

### mcp.json

```json
{
  "providers": [
    {
      "name": "memory",
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-memory"]
    },
    {
      "name": "neo4j-cypher",
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-neo4j-cypher"],
      "env": {
        "NEO4J_URL": "${NEO4J_URI}",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}"
      }
    },
    {
      "name": "database-server",
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  ]
}
```

> **Note:** Use `bunx` instead of `npx` for better security and performance.

---

## OpenClaw API

### Available Methods

```typescript
interface OpenClawAPI {
  // Agent registration
  registerAgent(agent: AgentDefinition): void;
  unregisterAgent(id: string): void;

  // Skill registration
  registerSkill(skill: SkillDefinition): void;
  unregisterSkill(id: string): void;

  // MCP providers
  registerMCPProvider(provider: MCPProvider): void;
  unregisterMCPProvider(name: string): void;

  // Memory operations
  memory: {
    query(params: MemoryQuery): Promise<MemoryResult>;
    create(params: MemoryCreate): Promise<Entity>;
    update(params: MemoryUpdate): Promise<Entity>;
    delete(params: MemoryDelete): Promise<void>;
  };

  // Database operations
  database: {
    query(sql: string): Promise<QueryResult>;
    execute(sql: string): Promise<ExecuteResult>;
  };
}
```

---

## Installation

### Native Format

```bash
# Install from npm with Bun
bun add openclaw-plugin-allura

# Add to OpenClaw config
openclaw config add-plugin openclaw-plugin-allura
```

### Bundle Mode

```bash
# Install from npm with Bun
bun add allura-agent-os

# Load bundle
openclaw --bundle node_modules/allura-agent-os
```

## Usage

### Load Plugin

```bash
# Start OpenClaw with plugin
openclaw --plugin openclaw-plugin-allura

# Or with bundle
openclaw --bundle claude-plugin-allura
```

### Bundle Mode

```bash
# Install from npm
npm install allura-agent-os

# Load bundle
openclaw --bundle node_modules/allura-agent-os
```

---

## Usage

### Load Plugin

```bash
# Start OpenClaw with plugin
openclaw --plugin openclaw-plugin-allura

# Or with bundle
openclaw --bundle claude-plugin-allura
```

### Activate Agent

```typescript
// Select agent
api.selectAgent('allura.orchestrator');

// Run skill
api.runSkill('allura.roninmemory-context');
```

### Memory Operations

```typescript
// Query memory
const context = await api.memory.query({
  query: 'allura architecture',
  group_id: 'allura-default'
});

// Create entity
const entity = await api.memory.create({
  type: 'Agent',
  name: 'MemoryOrchestrator',
  group_id: 'allura-default'
});
```

---

## Comparison: Native vs Bundle

| Feature | Native | Bundle |
|---------|--------|--------|
| Language | TypeScript | Markdown |
| Performance | Faster (compiled) | Slower (parsed) |
| Flexibility | Full TypeScript API | Limited to bundle format |
| Development | Requires TypeScript setup | Edit Markdown files |
| Reusability | OpenClaw-specific | Compatible with Claude Code |
| Hot Reload | ✅ Yes | ✅ Yes |

**Recommendation:** Use **bundle mode** for easier maintenance and compatibility with Claude Code.

---

## Current Status

### Pending

- ⏳ Choose format (native vs bundle)
- ⏳ Create plugin manifest
- ⏳ Define agent implementations
- ⏳ Port skills from OpenCode
- ⏳ Configure MCP providers
- ⏳ Test with OpenClaw runtime
- ⏳ npm package publishing

---

## See Also

- [OpenCode Plugin Spec](./opencode-plugin-spec.md)
- [Claude Code Plugin Spec](./claude-code-plugin-spec.md)
- [Agent Memory Architecture](./architectural-brief.md)
- [MCP Docker Integration](./mcp-docker-integration.md)