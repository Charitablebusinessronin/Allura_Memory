# Allura Agent-OS - Claude Code Plugin

A governed memory system for AI agents with dual persistence (PostgreSQL + Neo4j), Human-in-the-Loop (HITL) governance, and Steel Frame versioning.

## Overview

Allura Agent-OS provides persistent memory for Claude Code agents, enabling them to:
- Recall past contributions and decisions across sessions
- Store knowledge in a structured graph (Neo4j)
- Log execution traces (PostgreSQL)
- Follow governance workflows with human approval

## Architecture

```
┌─────────────────────────────────────────────┐
│ Layer 5: Paperclip + OpenClaw (Human UI)   │
│ Layer 4: Workflow / DAGs / A2A Bus        │
│ Layer 3: Agent Runtime (Claude Code)      │
│ Layer 2: PostgreSQL + Neo4j (Dual Store)  │
│ Layer 1: RuVix Kernel (Proof-gated)       │
└─────────────────────────────────────────────┘
```

## Installation

```bash
# Install from local directory
claude --plugin-dir ./claude-plugin-allura

# Or install from marketplace (when published)
/plugin install allura-agent-os
```

## Agents

| Agent | Role | Model |
|-------|------|-------|
| `memory-orchestrator` | BMad workflow coordination | glm-5-cloud |
| `memory-architect` | System design lead | glm-5-cloud |
| `memory-builder` | Infrastructure implementation | kimi-k2.5:cloud |
| `memory-guardian` | Quality gates and validation | glm-5-cloud |
| `memory-scout` | Context discovery | ministral-3:8b-cloud |
| `memory-analyst` | Memory system metrics | glm-5-cloud |
| `memory-chronicler` | Documentation/specs | glm-5-cloud |

## Skills

- `/allura-agent-os:roninmemory-context` - Session initialization with context loading

## Usage

Activate the orchestrator agent:
```
/agents memory-orchestrator
```

Run the context skill:
```
/allura-agent-os:roninmemory-context
```

## Environment Variables

```bash
# Required
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
DATABASE_URL=postgresql://user:pass@localhost:5432/memory

# Optional
OLLAMA_API_KEY=your-key
```

## Documentation

- [Documentation Hierarchy](docs/source-of-truth.md)
- [Architecture Brief](docs/architectural-brief.md)
- [Tenant Memory Boundary Spec](docs/tenant-memory-boundary-spec.md)

## License

MIT
