# Agent Graph Structure - roninmemory Project

**Created**: 2026-04-04
**Status**: ✅ COMPLETE
**Anchor Node**: `roninmemory` Project

---

## Graph Overview

```
Project: roninmemory (Anchor)
    │
    └── BELONGS_TO ──────┐
                          │
    ┌─────────────────────┴─────────────────────────┐
    │                                               │
memory-orchestrator 🧠                      memory-architect 🏗️
(Primary Orchestrator +                       (Senior Engineer +
 Brooksian Planner)                            Implementation Lead)
    │                                               │
    ├── SUPERVISES ────────────────────────────────┘
    │
    ├── ORCHESTRATES ──────────┬───────────────────┬────────────────
    │                          │                   │                 │
    │                      Core Subagents     Code Subagents    Development Subagents
    │                          │                   │                 │
    │                    ┌─────┴─────┐       ┌─────┴─────┐      ┌────┴────┐
    │                    │           │       │           │      │         │
    │                memory-scout  memory-  memory-     memory  memory-  memory-
    │                  🔍        archivist builder     tester  interface infrastructure
    │                            📚        💻         🧪       🎨        🔧
    │                              │        │          │        │         │
    │                          memory-curator memory-  memory-  memory-   memory-
    │                              📋      guardian   validator organizer chronicler
    │                                       🛡️         ✅        🗂️       📝
    │
    └── All agents COLLABORATES with same-module peers

```

---

## Agent Registry

### Primary Agents (2)

| Agent | Display Name | Icon | Module | Role |
|-------|--------------|------|--------|------|
| memory-orchestrator | Memory Orchestrator | 🧠 | core | Primary Orchestrator + Brooksian Planner |
| memory-architect | Memory Architect | 🏗️ | core | Senior Software Engineer + Implementation Specialist |

### Subagents by Module

#### Core Subagents (4)

| Agent | Display Name | Icon | Role |
|-------|--------------|------|------|
| memory-scout | Memory Scout | 🔍 | Context Discovery Specialist |
| memory-archivist | Memory Archivist | 📚 | External Documentation Specialist |
| memory-curator | Memory Curator | 📋 | Task Breakdown Specialist |
| memory-chronicler | Memory Chronicler | 📝 | Documentation Specialist |

#### Code Subagents (4)

| Agent | Display Name | Icon | Role |
|-------|--------------|------|------|
| memory-builder | Memory Builder | 💻 | Senior Implementation Engineer |
| memory-tester | Memory Tester | 🧪 | Memory Testing Specialist |
| memory-guardian | Memory Guardian | 🛡️ | Quality Guardian + Security Reviewer |
| memory-validator | Memory Validator | ✅ | Build Validation Specialist |

#### Development Subagents (2)

| Agent | Display Name | Icon | Role |
|-------|--------------|------|------|
| memory-interface | Memory Interface | 🎨 | Interface Design Specialist |
| memory-infrastructure | Memory Infrastructure | 🔧 | Infrastructure Specialist |

#### System-Builder Subagents (1)

| Agent | Display Name | Icon | Role |
|-------|--------------|------|------|
| memory-organizer | Memory Organizer | 🗂️ | Context Organization Specialist |

---

## Graph Relationships

### Relationship Types

| Relationship | Count | Description |
|--------------|-------|-------------|
| `BELONGS_TO` | 13 | Agent → Project anchor |
| `ORCHESTRATES` | 12 | Orchestrator → Subagents |
| `SUPERVISES` | 1 | Orchestrator → Architect |
| `COORDINATES` | 4 | Architect → Code subagents |
| `COLLABORATES` | 22 | Peer subagents ↔ same module |

### Dependency Graph

```
Project: roninmemory
    │
    └── memory-orchestrator (Primary)
            │
            ├── SUPERVISES → memory-architect (Implementation Lead)
            │                       │
            │                       ├── COORDINATES → memory-builder
            │                       ├── COORDINATES → memory-tester
            │                       ├── COORDINATES → memory-guardian
            │                       └── COORDINATES → memory-validator
            │
            └── ORCHESTRATES → [All 11 subagents]
                    │
                    └── Each subagent BELONGS_TO → Project: roninmemory
```

---

## Verification Results

### All Agents Connected ✅

```cypher
// Verify: All 13 agents connected to project anchor
MATCH (p:Project {name: 'roninmemory'})
MATCH (a:Agent)-[r:BELONGS_TO]->(p)
RETURN count(a) as agents_connected
// Result: 13

// Verify: All agents have group_id = 'roninmemory'
MATCH (a:Agent)
WHERE a.group_id = 'roninmemory' AND a.status = 'active'
RETURN count(a) as active_agents
// Result: 13
```

### Relationship Counts ✅

- **BELONGS_TO**: 13 relationships (all agents → project)
- **ORCHESTRATES**: 12 relationships (orchestrator → all subagents)
- **SUPERVISES**: 1 relationship (orchestrator → architect)
- **COORDINATES**: 4 relationships (architect → code subagents)
- **COLLABORATES**: 22 relationships (peer subagents)

---

## Node Properties

### Project Anchor Node

```json
{
  "name": "roninmemory",
  "group_id": "roninmemory",
  "description": "Unified AI Engineering Brain - Goal-directed, closed-loop control system",
  "status": "active",
  "repository": "https://github.com/ronin704/roninmemory",
  "type": "anchor",
  "created_at": "2026-04-04T..."
}
```

### Agent Node Template

```json
{
  "name": "memory-orchestrator",
  "displayName": "Memory Orchestrator",
  "icon": "🧠",
  "title": "Primary Orchestrator + Brooksian Planner",
  "group_id": "roninmemory",
  "status": "active",
  "canonicalId": "memory-orchestrator",
  "module": "core",
  "role": "...",
  "capabilities": ["orchestration", "planning", "..."],
  "communicationStyle": "...",
  "created_at": "2026-04-04T..."
}
```

---

## Query Examples

### Get All Active Agents

```cypher
MATCH (a:Agent)-[:BELONGS_TO]->(p:Project {name: 'roninmemory'})
WHERE a.status = 'active'
RETURN a.name, a.displayName, a.icon, a.module
ORDER BY a.module, a.name
```

### Get Agent Hierarchy

```cypher
MATCH (p:Project {name: 'roninmemory'})
MATCH (orchestrator:Agent {name: 'memory-orchestrator'})
MATCH (architect:Agent {name: 'memory-architect'})
MATCH (subagent:Agent)
WHERE (orchestrator)-[:ORCHESTRATES]->(subagent)
RETURN orchestrator, architect, collect(subagent)
```

### Get Peer Collaborators

```cypher
MATCH (a:Agent {name: 'memory-builder'})-[r:COLLABORATES]-(peer:Agent)
WHERE r.module = 'code'
RETURN peer.name, peer.displayName
```

---

## Invariants Enforced

1. **Every agent has `group_id`** ✅
   - All 13 agents have `group_id = 'roninmemory'`

2. **Every agent is connected to project anchor** ✅
   - All 13 agents have `BELONGS_TO` relationship to `Project: roninmemory`

3. **Every agent has `created_at` timestamp** ✅
   - All nodes have `created_at` property set on creation

4. **Every agent has `status` property** ✅
   - All 13 agents have `status = 'active'`

5. **Hierarchical structure preserved** ✅
   - Orchestrator SUPERVISES Architect
   - Orchestrator ORCHESTRATES all subagents
   - Architect COORDINATES code subagents
   - Peers COLLABORATE within modules

6. **Module organization maintained** ✅
   - core: 6 agents (orchestrator, architect, scout, archivist, curator, chronicler)
   - code: 4 agents (builder, tester, guardian, validator)
   - development: 2 agents (interface, infrastructure)
   - system-builder: 1 agent (organizer)

---

## Next Steps

1. **Use the agent graph for context retrieval:**
   ```typescript
   // Query for agent capabilities
   const agent = await session.run(`
     MATCH (a:Agent {name: 'memory-scout'})
     RETURN a.capabilities, a.role
   `);
   ```

2. **Extend the graph with additional nodes:**
   - Add `Skill` nodes for each memory-* skill
   - Add `USES_SKILL` relationships from agents to skills
   - Add `Memory` nodes for insights, patterns, decisions
   - Add `PRODUCED_BY` relationships to track agent contributions

3. **Track agent activity:**
   - Add `last_activity` property to update on agent actions
   - Add `PRODUCED` relationships for insights, code, tests
   - Add `VALIDATED` relationships for reviews

---

## Files Updated

- `/src/lib/memory/invariant-validation.ts` — Application-layer enforcement
- `/docs/audit/memory-audit-2026-04-04-final.md` — Complete audit report
- **Neo4j Graph** — Agent nodes created and connected

---

**Created by**: Memory Architect + Memory Infrastructure
**Verified by**: Memory Validator + Memory Guardian
**Approved by**: Memory Orchestrator