# Brooksian Architectural Plan
## Memory System Integration with Surgical Team

**Version**: 1.0.0  
**Date**: 2026-04-03  
**Architect**: MemoryOrchestrator (Brooks-bound)  
**Status**: Proposed

---

## Executive Summary

Following **Frederick P. Brooks Jr.**'s principles of conceptual integrity and the surgical team model, this plan defines how the **roninmemory** system (Postgres + Neo4j) integrates with all 25+ custom subagents. The architecture preserves:

1. **Conceptual Integrity** — Clear contracts between memory system and agents
2. **Surgical Team Specialization** — Each subagent has specific memory responsibilities
3. **Separation of Concerns** — Postgres for events, Neo4j for promoted insights
4. **Communication Structures** — Standardized protocols that shape the system

---

## 1. System Architecture Overview

### 1.1 The Dual-Memory Model (Allura System)

```
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐          ┌──────────────────┐             │
│  │   PostgreSQL     │          │     Neo4j        │             │
│  │   (The Chronicle)│          │   (The Wisdom)   │             │
│  ├──────────────────┤          ├──────────────────┤             │
│  │ • Event logs     │          │ • ADRs          │             │
│  │ • Session tracks │◄────────►│ • Patterns      │             │
│  │ • All actions    │  Promote │ • Decisions     │             │
│  │ • Audit trail    │  (HITL)  │ • Validated     │             │
│  │ • Chronological  │          │   fixes         │             │
│  └──────────────────┘          └──────────────────┘             │
│          │                              │                       │
│          └──────────────┬───────────────┘                       │
│                         │                                       │
│              ┌──────────▼──────────┐                          │
│              │  MemoryOrchestrator │                          │
│              │  (The Architect)     │                          │
│              └──────────┬──────────┘                          │
│                         │                                       │
│     ┌───────────────────┼───────────────────┐                   │
│     │                   │                   │                   │
│     ▼                   ▼                   ▼                   │
│ ┌────────┐        ┌────────┐        ┌────────┐                  │
│ │Scout   │        │Builder │        │Tester  │                  │
│ │Surveyer│        │Mason   │        │Inspector│                 │
│ └────────┘        └────────┘        └────────┘                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Memory Data Flow

```
Session Start
    ↓
Connect Postgres ──┐
Connect Neo4j ────┼── Bootstrap (blocking)
Log session_start ─┘
    ↓
Retrieve Context ────────┐
Search memories          ├── Hydration
Load standards ──────────┘
    ↓
Execute Task
    ↓
Log events ───────┐
    │             ├── All writes → Postgres (always)
Create entities ──┤
    │             └── Promoted → Neo4j (selective)
Link relations ───┘
    ↓
Session Complete
    ↓
Log reflection ───────┐
Verify ADR created ───┼── Exit validation
    └───────────────────┘
```

---

## 2. The Surgical Team: Memory Responsibilities

Following Brooks's **Surgical Team** model, each subagent has specialized memory responsibilities:

### 2.1 Primary Agents (Chief Surgeons)

#### **MemoryOrchestrator** (openagent.md)
**Role**: Primary architect and coordinator
**Memory Responsibilities**:
- **Bootstrap**: Connect to both Postgres and Neo4j at session start
- **Orchestrate**: Route memory operations to appropriate subagents
- **Promote**: Decide which events warrant Neo4j promotion (HITL gate)
- **Log**: Always log to Postgres; selective promotion to Neo4j

**Hydration Protocol**:
```javascript
// Step 0: Bootstrap
MCP_DOCKER_mcp-add({ name: "neo4j-memory", activate: true });
MCP_DOCKER_mcp-add({ name: "database-server", activate: true });

// Step 1: Retrieve
MCP_DOCKER_search_memories({ query: "roninmemory orchestration {topic}" });
MCP_DOCKER_find_memories_by_name({ 
  names: ["Previous Session", "Workflow Pattern", "Architectural Decision"] 
});

// Step 2: Load Context
// - memory-bank/activeContext.md
// - memory-bank/progress.md
// - memory-bank/systemPatterns.md
// - .opencode/context/project/bmad-integration.md

// Step 3: Log Session Start to Postgres
INSERT INTO events (group_id, agent_id, event_type, timestamp, payload)
VALUES ('roninmemory', 'openagent', 'SESSION_START', NOW(), '{...}');
```

---

#### **MemoryArchitect** (opencoder.md)
**Role**: Designer of castles in the air
**Memory Responsibilities**:
- **Design**: Create ADRs (Architectural Decision Records) in Neo4j
- **Pattern**: Store architectural patterns for reuse
- **Retrieve**: Query prior architectural decisions before designing
- **Log**: Design sessions to Postgres; ADRs to Neo4j

**Hydration Protocol**:
```javascript
// Step 1: Search for prior architecture
MCP_DOCKER_search_memories({ 
  query: "roninmemory architecture ADR {domain}" 
});
MCP_DOCKER_find_memories_by_name({ 
  names: ["ADR-001", "Pattern-{name}", "Previous Design"] 
});

// Step 2: Load standards
// - code-quality.md (if coding)
// - architecture.md (if designing)
// - security-patterns.md

// Step 3: Log design session
// Postgres: Always
// Neo4j: Only if creating ADR

// Step 4: Create ADR (if significant decision)
MCP_DOCKER_create_entities({
  entities: [{
    name: "ADR-{NNN}: {Decision}",
    type: "ADR",
    observations: [/* 5-layer framework */]
  }]
});
```

---

### 2.2 Core Subagents (Surgical Team Members)

#### **MemoryScout** (contextscout.md) ⭐
**Role**: Surveyor — finds context before building
**Exemption**: Approval gate exempt (like a surveyor doesn't need architect approval)
**Memory Responsibilities**:
- **Read-Only**: Never writes to memory (read-only agent)
- **Discover**: Query memory for prior context discoveries
- **Cache**: No memory writes — pure discovery

**Hydration Protocol**:
```javascript
// Step 1: Resolve context location
// - Check local: .opencode/context/
// - Fallback to global if needed (per paths.json)

// Step 2: Read navigation files (no memory queries)
// - navigation.md
// - {domain}/navigation.md

// Step 3: Search context files
// - Use glob, grep, read
// - NEVER write, edit, or use task/bash

// No memory writes — MemoryScout is read-only
```

---

#### **MemoryArchivist** (externalscout.md)
**Role**: Librarian — fetches current knowledge
**Memory Responsibilities**:
- **Cache**: Store fetched docs in `.tmp/external-context/`
- **Log**: Log fetch events to Postgres
- **Track**: Track which libraries have been fetched

**Hydration Protocol**:
```javascript
// Step 0: Check cache (files, not memory)
// - Check .tmp/external-context/{package}/
// - Check .tmp/external-context/.manifest.json

// Step 1: If not cached, fetch via Context7 or webfetch
// Step 2: Persist to .tmp/external-context/ (files)

// Step 3: Log to Postgres (event)
INSERT INTO events (group_id, agent_id, event_type, payload)
VALUES ('roninmemory', 'externalscout', 'DOCS_FETCHED', 
        '{"library": "{name}", "topic": "{topic}"}');

// No Neo4j writes — external docs are ephemeral
```

---

#### **MemoryCurator** (task-manager.md)
**Role**: Planner — breaks complexity into manageable pieces
**Memory Responsibilities**:
- **Log**: Task creation events to Postgres
- **Track**: Task status in `.tmp/tasks/` (files)
- **Retrieve**: Query prior task patterns from Neo4j

**Hydration Protocol**:
```javascript
// Step 1: Load task management context
// - task-management/navigation.md
// - task-management/standards/task-schema.md

// Step 2: Check current task state (CLI, not memory)
// - task-cli.ts status

// Step 3: Search for prior task patterns
MCP_DOCKER_search_memories({ 
  query: "roninmemory task breakdown {feature-type}" 
});

// Step 4: Create task JSONs (files, not memory)
// - .tmp/tasks/{feature}/task.json
// - .tmp/tasks/{feature}/subtask_01.json

// Step 5: Log to Postgres
INSERT INTO events (group_id, agent_id, event_type, payload)
VALUES ('roninmemory', 'taskmanager', 'TASKS_CREATED', 
        '{"feature": "{name}", "subtask_count": N}');
```

---

#### **MemoryChronicler** (documentation.md)
**Role**: Scribe — documents the system
**Memory Responsibilities**:
- **Chronicle**: Create ADRs for documentation decisions
- **Log**: Doc updates to Postgres
- **Retrieve**: Query prior documentation patterns

**Hydration Protocol**:
```javascript
// Step 1: Load documentation standards
// - standards/documentation.md
// - memory-bank/*.md

// Step 2: Search for prior docs
MCP_DOCKER_search_memories({ 
  query: "roninmemory documentation {component}" 
});

// Step 3: Write docs (files)
// - markdown files
// - plan/**/*.md

// Step 4: Log to Postgres
INSERT INTO events (group_id, agent_id, event_type, payload)
VALUES ('roninmemory', 'chronicler', 'DOCS_UPDATED', 
        '{"files": [...], "component": "{name}"}');

// Step 5: Create ADR if documenting architectural decision
```

---

### 2.3 Code Subagents (Builders and Inspectors)

#### **MemoryBuilder** (coder-agent.md)
**Role**: Mason — implements according to plan
**Memory Responsibilities**:
- **Log Start**: Log task start to Postgres
- **Log Complete**: Log completion to Postgres
- **Create Entities**: Create Implementation entities in Neo4j
- **Discover Patterns**: Query for implementation patterns

**Hydration Protocol**:
```javascript
// Step 1: Read subtask JSON (file)
// Step 2: ContextScout (delegate to MemoryScout)
// Step 3: ExternalScout if external libs (delegate to MemoryArchivist)

// Step 4: Search for implementation patterns
MCP_DOCKER_search_memories({ 
  query: "roninmemory implementation {pattern}" 
});

// Step 5: Log task start to Postgres
INSERT INTO events (group_id, agent_id, event_type, payload)
VALUES ('roninmemory', 'coderagent', 'TASK_STARTED', 
        '{"feature": "{name}", "subtask": "{seq}"}');

// Step 6: Implement code

// Step 7: Log completion to Postgres
INSERT INTO events (group_id, agent_id, event_type, payload)
VALUES ('roninmemory', 'coderagent', 'TASK_COMPLETED', 
        '{"feature": "{name}", "subtask": "{seq}"}');

// Step 8: Create Implementation entity in Neo4j
MCP_DOCKER_create_entities({
  entities: [{
    name: "Implementation {timestamp}",
    type: "Implementation",
    observations: ["group_id: roninmemory", "agent_id: coderagent", ...]
  }]
});
```

---

#### **MemoryTester** (test-engineer.md)
**Role**: Inspector — validates against contracts
**Memory Responsibilities**:
- **Log**: Test runs to Postgres
- **Create Patterns**: Create test pattern entities in Neo4j
- **Discover**: Query for test patterns and failures

**Hydration Protocol**:
```javascript
// Step 1: ContextScout for test standards

// Step 2: Search for test patterns
MCP_DOCKER_search_memories({ 
  query: "roninmemory test pattern {type}" 
});
MCP_DOCKER_find_memories_by_name({ 
  names: ["Test Pattern", "Recurring Failure"] 
});

// Step 3: Log test run to Postgres
INSERT INTO events (group_id, agent_id, event_type, payload)
VALUES ('roninmemory', 'testengineer', 'TEST_RUN', 
        '{"file": "{test-file}", "result": "{pass|fail}"}');

// Step 4: If new pattern discovered, create in Neo4j
MCP_DOCKER_create_entities({
  entities: [{
    name: "Test Pattern: {pattern}",
    type: "TestPattern",
    observations: [...]
  }]
});
```

---

#### **MemoryGuardian** (reviewer.md)
**Role**: Security auditor
**Memory Responsibilities**:
- **Log**: Reviews to Postgres
- **Create**: Security pattern entities in Neo4j

#### **MemoryValidator** (build-agent.md)
**Role**: Build checker
**Memory Responsibilities**:
- **Log**: Build results to Postgres
- **Track**: Build failures for pattern analysis

---

### 2.4 System Builder Subagents

#### **MemoryOrganizer** (context-organizer.md)
**Role**: Knowledge curator
**Memory Responsibilities**:
- **Log**: Organization activities to Postgres
- **Create**: Knowledge structure entities in Neo4j

#### **MemoryGenerator** (agent-generator.md)
**Role**: Agent factory
**Memory Responsibilities**:
- **Log**: Agent creation to Postgres
- **Create**: Agent template entities in Neo4j

#### **MemoryWorkflow** (workflow-designer.md)
**Role**: Process architect
**Memory Responsibilities**:
- **Log**: Workflow designs to Postgres
- **Create**: Workflow pattern entities in Neo4j

#### **MemoryDomain** (domain-analyzer.md)
**Role**: Domain expert
**Memory Responsibilities**:
- **Log**: Analysis to Postgres
- **Create**: Domain model entities in Neo4j

---

### 2.5 Development Subagents

#### **MemoryInterface** (frontend-specialist.md)
**Role**: UI designer
**Memory Responsibilities**:
- **Log**: Design sessions to Postgres
- **Create**: UI pattern entities in Neo4j

#### **MemoryInfrastructure** (devops-specialist.md)
**Role**: Infrastructure engineer
**Memory Responsibilities**:
- **Log**: Infrastructure changes to Postgres
- **Create**: Infrastructure pattern entities in Neo4j

---

## 3. Memory Integration Patterns

### 3.1 The Bootstrap Protocol (Every Session)

**Step 0**: Connect to Memory Systems (BLOCKING)
```javascript
// All agents must execute this at session start:

// 1. Add MCP servers
MCP_DOCKER_mcp-add({ name: "neo4j-memory", activate: true });
MCP_DOCKER_mcp-add({ name: "database-server", activate: true });

// 2. Verify connections
// (Display: Neo4j status, Postgres status)

// 3. Log session start to Postgres
INSERT INTO events (
  group_id, 
  agent_id, 
  event_type, 
  timestamp, 
  payload
) VALUES (
  'roninmemory',
  '{agent-name}',
  'SESSION_START',
  NOW(),
  '{
    "session_id": "{uuid}",
    "task": "{description}",
    "timestamp": "{ISO}"
  }'
);

// Display to user:
// ┌─────────────────────────────────────┐
// │  MEMORY BOOTSTRAP COMPLETE          │
// ├─────────────────────────────────────┤
// │  Neo4j:    ✓ Connected              │
// │  Postgres: ✓ Connected              │
// │  Session:  {session_id}             │
// └─────────────────────────────────────┘
```

---

**Step 1**: Retrieve Relevant Context
```javascript
// Search for prior work
MCP_DOCKER_search_memories({
  query: "roninmemory {topic} {component}"
});

// Find specific entities if known
MCP_DOCKER_find_memories_by_name({
  names: [
    "Previous Session",
    "Established Pattern", 
    "ADR-{NNN}",
    "Recurring Failure"
  ]
});

// Read full graph if needed
MCP_DOCKER_read_graph({});
```

---

**Step 2**: Load Required Context Files
```javascript
// Per agent role:
// - Orchestrator: bmad-integration.md, navigation.md
// - Architect: code-quality.md, architecture.md
// - Builder: code-quality.md, security-patterns.md
// - Tester: test-coverage.md, TDD-patterns.md
// - Chronicler: documentation.md
```

---

**Step 3**: Execute Task

---

**Step 4**: Reflection Logging
```javascript
// ALWAYS log to Postgres:
INSERT INTO events (
  group_id,
  agent_id,
  event_type,
  timestamp,
  payload
) VALUES (
  'roninmemory',
  '{agent-name}',
  '{EVENT_TYPE}',
  NOW(),
  '{...}'
);

// CONDITIONALLY promote to Neo4j:
if (isSignificantDecision || isPattern || isADR) {
  MCP_DOCKER_create_entities({
    entities: [{
      name: "{Entity Name}",
      type: "{EntityType}",
      observations: [...]
    }]
  });
  
  // Link to Memory Master
  MCP_DOCKER_create_relations({
    relations: [{
      source: "{Entity}",
      target: "Memory Master",
      relationType: "PERFORMED_BY"
    }]
  });
}
```

---

**Step 5**: Exit Validation
```javascript
// Before session end:

// 1. Verify at least one event logged today
SELECT COUNT(*) FROM events 
WHERE group_id = 'roninmemory' 
  AND agent_id = '{agent-name}'
  AND timestamp > NOW() - INTERVAL '24 hours';

// 2. Verify Neo4j promotion (if applicable)
// Check if significant entities created

// 3. User confirmation
// "Session complete & satisfactory?"
```

---

### 3.2 Event Types by Agent

| Agent | Postgres Events | Neo4j Entities |
|-------|----------------|------------------|
| **Orchestrator** | SESSION_START, WORKFLOW_INITIATED, DELEGATION_MADE | Session, Workflow |
| **Architect** | DESIGN_SESSION_STARTED, DESIGN_COMPLETED | ADR, DesignDecision |
| **Scout** | CONTEXT_DISCOVERY | (none — read-only) |
| **Archivist** | DOCS_FETCHED | (none — ephemeral) |
| **Curator** | TASKS_CREATED, TASKS_UPDATED | TaskPattern |
| **Chronicler** | DOCS_UPDATED | DocumentationDecision |
| **Builder** | TASK_STARTED, TASK_COMPLETED | Implementation |
| **Tester** | TEST_RUN, TEST_COMPLETED | TestPattern |
| **Guardian** | REVIEW_COMPLETED | SecurityPattern |
| **Validator** | BUILD_COMPLETED | BuildPattern |

---

## 4. Interface Contracts

### 4.1 Subagent Invocation with Memory Context

```javascript
// Standard pattern with memory context:
task(
  subagent_type="{AgentName}",
  description="{Clear objective}",
  prompt="Context to load:
          - {relevant context files}
          
          Memory Context:
          - Prior work: {summary from memory search}
          - Patterns found: {list}
          
          Task: {specific objective}
          
          Memory Logging:
          - Log SESSION_START to Postgres
          - Search memory for '{topic}' before execution
          - Log completion to Postgres
          - Create entities in Neo4j if significant"
)
```

---

### 4.2 Context Bundle Contract

When delegating, the context bundle includes:

```markdown
# Task Context Bundle

## Memory Context (from Neo4j)
- Prior ADRs: {list}
- Established Patterns: {list}
- Recurring Failures: {list}

## Event Context (from Postgres)
- Recent Sessions: {list}
- Related Events: {list}

## Context Files (Standards)
- {file paths}

## Reference Files (Source)
- {file paths}

## Memory Requirements
- [ ] Bootstrap memory at session start
- [ ] Search for '{query}' before execution
- [ ] Log to Postgres (always)
- [ ] Create Neo4j entities (if applicable)
```

---

## 5. ADR Framework (Architectural Decision Records)

### 5.1 5-Layer ADR Framework

Every significant architectural decision must be captured:

```markdown
# ADR-{NNN}: {Decision Title}

## 1. Action Logging (What)
{What was decided and implemented}

## 2. Decision Context (Why)
{What force required this decision}
- Problem: {...}
- Constraints: {...}
- Timeline: {...}

## 3. Reasoning Chain (How)
{How we arrived at this decision}
- Analysis: {...}
- Tradeoffs: {...}
- Risks: {...}

## 4. Alternatives Considered (What Else)
1. {Alternative A}: {why rejected}
2. {Alternative B}: {why rejected}
3. {Alternative C}: {why rejected}

## 5. Human Oversight Trail (Who)
- Proposed by: {agent}
- Reviewed by: {user/orchestrator}
- Approved on: {timestamp}
- HITL Gate: {approval reference}
```

---

### 5.2 Neo4j ADR Entity

```javascript
MCP_DOCKER_create_entities({
  entities: [{
    name: "ADR-{NNN}: {Decision Title}",
    type: "ADR",
    observations: [
      "group_id: roninmemory",
      "adr_id: ADR-{NNN}",
      "status: accepted",
      "timestamp: {ISO}",
      "component: {name}",
      "decision: {summary}",
      "context: {why}",
      "reasoning: {how}",
      "alternatives: {what else}",
      "oversight: {who approved}"
    ]
  }]
});

// Link to Memory Master
MCP_DOCKER_create_relations({
  relations: [{
    source: "ADR-{NNN}: {Decision Title}",
    target: "Memory Master",
    relationType: "PERFORMED_BY"
  }]
});

// Link to related ADRs (if superseding)
MCP_DOCKER_create_relations({
  relations: [{
    source: "ADR-{NNN}: {Decision Title}",
    target: "ADR-{NNN-1}: {Previous}",
    relationType: "SUPERSEDES"
  }]
});
```

---

## 6. BMad Integration Strategy

### 6.1 Current State

**BMad Installed Modules**:
- `core` (6.2.2) — Core utilities
- `bmm` (6.2.2) — Business Analysis & Planning
- `bmb` (1.1.0) — Builder (workflows & agents)
- `tea` (1.7.2) — Test Architecture Enterprise
- `wds` (0.3.1) — Workflow Design System

**Gap**: Custom agents in `.opencode/agent/` are not visible to BMad.

---

### 6.2 Solution: Custom Agent Manifests

**Location**: `_bmad/_config/custom/`

**Files to Create**:
```
_bmad/_config/custom/
├── agents/
│   ├── memory-orchestrator/
│   │   └── bmad-skill-manifest.yaml
│   ├── memory-architect/
│   │   └── bmad-skill-manifest.yaml
│   ├── memory-scout/
│   │   └── bmad-skill-manifest.yaml
│   └── ... (all 25+ agents)
└── custom-agents-manifest.csv
```

---

### 6.3 Manifest Template

```yaml
# _bmad/_config/custom/agents/{agent-name}/bmad-skill-manifest.yaml

type: agent
name: {agent-id}
displayName: {Display Name}
title: {Role Title}
icon: "{emoji}"
capabilities: "{capability list}"
role: {Brooksian Role}
identity: "{identity description}"
communicationStyle: "{voice description}"
principles: "{Brooksian principles}"
module: custom
memory:
  requires_bootstrap: true
  postgres_logging: required
  neo4j_entities: conditional
  adr_creation: {agent-specific}
hydration:
  - step: 1
    action: "Bootstrap memory"
    required: true
  - step: 2
    action: "Search prior work"
    query_template: "roninmemory {agent-type} {topic}"
  - step: 3
    action: "Load context files"
    files: ["{standards}"]
  - step: 4
    action: "Log session start"
    target: postgres
    required: true
exit:
  validation:
    - "At least one event logged to Postgres"
    - "Neo4j entities created if applicable"
    - "User confirmation"
```

---

## 7. Implementation Plan

### Phase 1: Foundation (Week 1)

**Task 1.1**: Create memory integration architecture document
- **Deliverable**: This document (in progress)
- **Agent**: MemoryOrchestrator + MemoryChronicler
- **Output**: `docs/architecture/memory-system-integration.md`

**Task 1.2**: Create custom agent manifests for BMad
- **Deliverable**: `_bmad/_config/custom/agents/*/bmad-skill-manifest.yaml`
- **Agent**: MemoryGenerator
- **Output**: 25+ agent manifests

**Task 1.3**: Define reflection logging protocol
- **Deliverable**: Event types, Neo4j entity types, logging templates
- **Agent**: MemoryArchitect
- **Output**: `docs/standards/memory-logging.md`

---

### Phase 2: Core Subagents (Week 2)

**Task 2.1**: Update MemoryScout with memory bootstrap
- **Deliverable**: Updated `contextscout.md`
- **Note**: Read-only — no writes, just retrieval

**Task 2.2**: Update MemoryArchivist with memory integration
- **Deliverable**: Updated `externalscout.md`
- **Focus**: Log fetch events to Postgres

**Task 2.3**: Update MemoryCurator with memory integration
- **Deliverable**: Updated `task-manager.md`
- **Focus**: Log task creation, search for task patterns

**Task 2.4**: Update MemoryChronicler with ADR creation
- **Deliverable**: Updated `documentation.md`
- **Focus**: ADR creation for doc decisions

---

### Phase 3: Code Subagents (Week 3)

**Task 3.1**: Update MemoryBuilder with implementation logging
- **Deliverable**: Updated `coder-agent.md`
- **Focus**: Log task start/complete, create Implementation entities

**Task 3.2**: Update MemoryTester with test pattern creation
- **Deliverable**: Updated `test-engineer.md`
- **Focus**: Create TestPattern entities for reusable patterns

**Task 3.3**: Update MemoryGuardian with security pattern creation
- **Deliverable**: Updated `reviewer.md`
- **Focus**: Create SecurityPattern entities

---

### Phase 4: Primary Agents (Week 4)

**Task 4.1**: Finalize MemoryOrchestrator with full bootstrap
- **Deliverable**: Updated `openagent.md`
- **Focus**: Orchestration of all memory operations

**Task 4.2**: Finalize MemoryArchitect with ADR framework
- **Deliverable**: Updated `opencoder.md`
- **Focus**: ADR creation, architectural decision logging

---

### Phase 5: Validation (Week 5)

**Task 5.1**: Create memory system validation tests
- **Deliverable**: Test suite
- **Agent**: MemoryTester
- **Output**: Tests for all memory operations

**Task 5.2**: Document complete system
- **Deliverable**: Comprehensive documentation
- **Agent**: MemoryChronicler
- **Output**: `docs/roninmemory-agent-architecture.md`

---

## 8. Success Criteria

### 8.1 Functional Requirements

- [ ] All 25+ agents have memory bootstrap in their activation protocol
- [ ] Every session logs SESSION_START to Postgres
- [ ] Every session ends with reflection logging
- [ ] ADRs are created for significant architectural decisions
- [ ] Patterns are promoted to Neo4j for reuse
- [ ] Custom agents are discoverable via BMad

### 8.2 Non-Functional Requirements

- [ ] Memory bootstrap completes in < 5 seconds
- [ ] Neo4j queries return in < 2 seconds
- [ ] Postgres event logging is non-blocking
- [ ] At most one Neo4j write per task/decision
- [ ] All agents follow Brooksian principles

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Neo4j unavailable | Low | High | Log to Postgres only, warn user |
| Postgres unavailable | Low | Critical | Agent cannot start, must fail |
| Memory queries slow | Medium | Medium | Cache frequent queries, pagination |
| Agent confusion | Medium | Medium | Clear templates, documentation |
| BMad conflicts | Low | Medium | Custom namespace, clear separation |

---

## 10. Conclusion

This architectural plan integrates the **Allura memory system** (Postgres + Neo4j) with all 25+ custom subagents following **Frederick P. Brooks Jr.**'s principles:

- **Conceptual Integrity**: Clear contracts between memory and agents
- **Surgical Team**: Each agent has specialized memory responsibilities
- **Separation of Concerns**: Postgres for events, Neo4j for promoted insights
- **Fewer Interfaces, Stronger Contracts**: Standardized protocols throughout

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Validate each phase before proceeding

---

*"The bearing of a child takes nine months, no matter how many women are assigned."* — Frederick P. Brooks Jr.

*"Conceptual integrity is the most important consideration in system design."* — Frederick P. Brooks Jr.

**Architect with wisdom. Build with integrity.**
