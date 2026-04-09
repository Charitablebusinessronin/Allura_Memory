# Allura Memory Plugin for OpenCode

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against architectural principles and should be kept in sync with source-of-truth docs.
> When in doubt, defer to code, schemas, and team consensus.

## Overview
Registers Allura Memory as an oh-my-openagent plugin, enabling memory operations through the agent harness.

## Installation
Place this file in `.opencode/plugin/allura-memory.md`

## Configuration
```json
{
  "plugin": ["allura-memory"],
  "mcp": {
    "ALLURA_MEMORY": {
      "type": "local",
      "command": ["bun", "run", "src/mcp/memory-server.ts"],
      "enabled": true
    }
  }
}
```

## Memory Operations

### @brooks (Orchestrator)
- **Query:** `memory_retrieve(query, limit=10)`
- **Log:** `memory_write(event, metadata)`
- **Propose:** `memory_propose_insight(title, statement)`

### @knuth (Deep Worker)
- **Deep Query:** `memory_retrieve(query, type='semantic', min_confidence=0.8)`
- **Log Analysis:** `memory_write(event_type='deep_analysis', ...)`

### @turing (Architecture)
- **ADR Query:** `search_decisions(domain='architecture')`
- **Log Decision:** `memory_write(event_type='adr', ...)`

### @berners-lee (Curator)
- **Curate:** `curator:approve(proposal_id)`
- **Query Queue:** `curator:queue(status='pending')`

## HITL Governance
All memory mutations route through `curator:approve` before promotion to Neo4j.

## Auto-Logging
All agent decisions automatically logged to PostgreSQL with:
- `agent_id`: Current agent name
- `group_id`: allura-roninmemory
- `event_type`: Task type
- `confidence`: Agent confidence score
