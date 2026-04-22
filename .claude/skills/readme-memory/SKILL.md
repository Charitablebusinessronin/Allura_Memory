---
name: readme-memory
description: Create comprehensive README.md files for AI memory systems and agent persistence projects. Use this skill when you need to generate professional documentation for memory systems, knowledge graphs, agent memory persistence, or any AI system that stores and retrieves information across sessions. This skill provides templates, structure guidance, and best practices specific to memory system documentation.
---

# README Memory

## Overview

This skill helps create professional README.md files for AI memory systems, agent persistence platforms, and knowledge management projects. It provides templates, structure guidance, and best practices specifically tailored for memory system documentation.

## When to Use This Skill

- **New memory system**: Starting a new AI agent memory project and need README documentation?
- **Existing project**: Updating documentation for a memory persistence system?
- **Open sourcing**: Preparing to publish a memory/knowledge graph project?
- **Team onboarding**: Creating documentation for developers joining a memory system project?
- **MCP server**: Documenting a Model Context Protocol memory server?

## Core Workflow

### Step 1: Gather Project Information

Before writing, collect key details:
- **Project name** and tagline
- **Problem it solves** - Why does AI need this memory system?
- **Key features** - What makes it unique?
- **Architecture** - How does it work?
- **Tech stack** - Languages, databases, protocols
- **Installation** - Setup requirements
- **Usage examples** - How to use it
- **API/Tools** - What interfaces does it expose?

### Step 2: Choose README Structure

Select the appropriate template based on project type:

#### Template A: Full Memory System (Default)
Best for: Complete memory platforms with persistence, governance, and APIs

Sections:
1. Header with badges
2. Problem/Solution statement
3. Table of Contents
4. Quick Start
5. Features
6. Architecture
7. Installation
8. Usage (Library + MCP)
9. API Reference
10. Testing
11. Documentation
12. Tech Stack
13. Project Structure
14. Contributing
15. License

#### Template B: MCP Server
Best for: MCP servers that provide memory tools

Sections:
1. Header
2. Description
3. Installation
4. MCP Configuration
5. Available Tools
6. Usage Examples
7. Configuration
8. Development

#### Template C: Simple Memory Library
Best for: Lightweight memory utilities or SDKs

Sections:
1. Header
2. Description
3. Installation
4. Quick Start
5. API Reference
6. Examples
7. Contributing

### Step 3: Write Content

Follow these guidelines for each section:

#### Header Section
```markdown
# {Project Name}

![Tests](https://img.shields.io/badge/tests-{count}%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

**{One-line description}** — {Brief elaboration}

**The Problem:** {What pain point does this solve?}

**The Solution:** {How does this memory system help?}
```

#### Features Section
Organize by category:
- Core Capabilities
- Governance Features
- Persistence Features
- Integration Features

Use tables for readability:
```markdown
| Feature | Description |
|---------|-------------|
| Feature Name | Brief description |
```

#### Architecture Section
Use ASCII diagrams for clarity:
```markdown
    Agent Layer
         |
         v
    Governance Layer
         |
         v
    Persistence Layer (Database)
```

Explain each layer briefly.

#### Installation Section
Include:
- Prerequisites
- Setup commands
- Environment variables
- Verification steps

#### Usage Section
Provide examples for:
- Library/SDK usage
- MCP server configuration
- CLI usage (if applicable)

#### API Reference Section
Create tables for tools/methods:
```markdown
| Tool/Method | Purpose |
|-------------|---------|
| `store_memory` | Description |
```

#### Project Structure Section
Use tree-like format:
```markdown
```
project/
  src/
    lib/         # Core libraries
    mcp/         # MCP tools
  docs/          # Documentation
```
```

## Complete Examples

### Example 1: Full Memory System README

```markdown
# {ProjectName}

![Tests](https://img.shields.io/badge/tests-1000%2B%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

**A persistent memory system for AI agents** — separates raw traces from curated knowledge with governance.

**The Problem:** AI agents lose all context between sessions.

**The Solution:** Multi-layer memory with audit trails and human oversight.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [License](#license)

## Quick Start

```bash
git clone https://github.com/user/repo.git
cd repo
npm install
docker compose up -d
npm test
```

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| Dual-Layer Storage | Raw traces (PostgreSQL) + Knowledge (Neo4j) |
| Versioned Insights | Immutable with SUPERSEDES relationships |
| HITL Governance | Human approval for critical changes |

## Architecture

```
Agent Layer
     |
     v
Governance (Policy, Circuit Breakers)
     |
     v
Semantic Memory (Neo4j) + Raw Memory (PostgreSQL)
```

## Installation

### Prerequisites

- Node.js 18+
- Docker

### Setup

```bash
npm install
docker compose up -d
```

### Environment

```bash
DATABASE_URL=postgresql://...
NEO4J_URI=bolt://...
```

## Usage

### MCP Server

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"]
    }
  }
}
```

### Library

```typescript
import { storeMemory } from '@/lib/memory';

await storeMemory({
  type: "Insight",
  content: "...",
  group_id: "project"
});
```

## API Reference

| Tool | Purpose |
|------|---------|
| store_memory | Create knowledge node |
| search_memories | Semantic search |
| promote_memory | HITL approval |

## License

MIT
```

### Example 2: MCP Server README

```markdown
# {ServerName} MCP

**MCP server for {service}** — enables AI agents to {do what}.

## Installation

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "{name}": {
      "command": "npx",
      "args": ["-y", "@{scope}/{package}"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `{tool_name}` | What it does |

## Usage

Example: {specific use case}

```json
{
  "tool": "{tool_name}",
  "arguments": {
    "param": "value"
  }
}
```

## Configuration

Environment variables:
- `{API_KEY}` - Required for authentication

## Development

```bash
npm install
npm run build
npm test
```
```

### Example 3: Memory SDK README

```markdown
# {LibraryName}

**{Language} SDK for {MemorySystem}** — {brief description}.

## Installation

```bash
npm install {package-name}
```

## Quick Start

```typescript
import { MemoryClient } from '{package-name}';

const client = new MemoryClient({
  apiKey: process.env.API_KEY
});

await client.store({
  key: "user.preference.theme",
  value: "dark"
});
```

## API Reference

### `store(key, value, options?)`

Store a memory value.

**Parameters:**
- `key` (string): Unique identifier
- `value` (any): Data to store
- `options` (object): Optional settings

**Returns:** Promise<MemoryRef>

### `retrieve(key)`

Retrieve a stored memory.

**Parameters:**
- `key` (string): Memory identifier

**Returns:** Promise<any>

## Examples

### Basic Usage

```typescript
// Store
await client.store("session.123", { tasks: [...] });

// Retrieve
const session = await client.retrieve("session.123");
```

### With Metadata

```typescript
await client.store("insight.auth", data, {
  confidence: 0.95,
  tags: ["auth", "security"]
});
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT © [Author Name](https://github.com/username)
```

## Best Practices

### Badge Selection

Choose relevant badges:
- **Tests**: `![Tests](https://img.shields.io/badge/tests-{count}%20passing-brightgreen)`
- **Coverage**: `![Coverage](https://img.shields.io/badge/coverage-{percent}%25-brightgreen)`
- **License**: `![License](https://img.shields.io/badge/license-MIT-blue)`
- **TypeScript**: `![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)`
- **Node**: `![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)`

### Writing Style

1. **Start with the problem** - Why does this exist?
2. **Lead with benefits** - What will users gain?
3. **Show, don't tell** - Use code examples
4. **Keep it scannable** - Use tables, lists, headers
5. **Include verification** - How do they know it works?

### Memory-Specific Content

Always include for memory systems:
- **Persistence model** - How is data stored?
- **Query capabilities** - How can users search?
- **Governance** - Who controls what?
- **Multi-tenancy** - How is data isolated?
- **Versioning** - How does the system handle changes?
- **Audit trails** - Can users track decisions?

### Common Pitfalls

❌ **Don't**:
- Skip the "Why?" section
- Use only text walls (no tables/lists)
- Forget environment variables
- Omit error handling examples
- Leave out testing instructions

✅ **Do**:
- Include a compelling problem statement
- Show multiple usage patterns
- Document all environment variables
- Provide troubleshooting tips
- Link to additional documentation

## Memory System Checklist

Before finalizing README, verify:

- [ ] Project name and clear tagline
- [ ] Problem statement (why this exists)
- [ ] Solution overview (what it does)
- [ ] Key features in table format
- [ ] Architecture diagram
- [ ] Quick start commands
- [ ] Installation prerequisites
- [ ] Environment variables documented
- [ ] Library usage examples
- [ ] MCP configuration (if applicable)
- [ ] API reference or tool list
- [ ] Testing instructions
- [ ] Project structure overview
- [ ] Contributing guidelines
- [ ] License
- [ ] Author/team attribution

## See Also

- [GitHub README Guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [Awesome README Examples](https://github.com/matiassingers/awesome-readme)
- [Make a README](https://www.makeareadme.com/)
