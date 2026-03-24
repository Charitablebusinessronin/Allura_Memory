---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - PRD (chat-provided): Agent Persistence and Lifecycle Management
  - Current State: 40 agents in Ronin Agents Command Center
  - Docker AI Analysis: Infrastructure vs Intelligence separation
---

# Epic 6: Agent Persistence, Lifecycle Management, and Creation Framework

Enable systematic creation, persistence, versioning, and lifecycle management of AI agents across the Ronin ecosystem with clear ownership, confidence scoring, and human approval gates.

## Overview

This epic addresses the gap between ad-hoc agent creation and systematic agent management. Currently agents are created manually via BMAD templates. Epic 6 establishes a framework for:

1. **Agent Creation** - Systematic generation from templates
2. **Agent Persistence** - Versioned storage in 4-layer system
3. **Agent Lifecycle** - Testing → Active → Deprecated → Archived
4. **Agent Discovery** - Find and reuse existing agents
5. **Agent Lineage** - Track evolution and improvements

## Requirements Inventory

### Functional Requirements

FR1: The system must provide a BMAD template for rapid agent creation (10-minute target).

FR2: The system must persist agent definitions in PostgreSQL with full versioning.

FR3: The system must promote agent metadata to Neo4j for semantic discovery.

FR4: The system must mirror approved agents to Notion AI Agents Registry.

FR5: The system must enforce agent lifecycle states: Draft → Testing → Active → Deprecated → Archived.

FR6: The system must track agent confidence scores and usage metrics.

FR7: The system must support agent lineage (v1 → v2 → v3 with SUPERSEDES relationships).

FR8: The system must provide agent search/discovery across all 40+ agents.

FR9: The system must require human approval for agent promotion to Active state.

FR10: The system must support agent retirement/archival with preservation of historical usage.

### Non-Functional Requirements

NFR1: Agent creation must be possible without Docker (file-first approach).

NFR2: Agent definitions must be human-readable (markdown/yaml).

NFR3: Agent persistence must support audit reconstruction for 12 months.

NFR4: Agent updates must maintain backward compatibility or explicit breaking change markers.

NFR5: Agent discovery must return results in <500ms.

NFR6: Agent lineage must preserve immutable history (Steel Frame pattern).

## Epic 6: Agent Persistence and Lifecycle Management

Enable systematic creation, versioning, and lifecycle management of AI agents with clear ownership, confidence scoring, and human approval gates.

### Story 6.1: Create Agent Generation Template

As an AI engineer,
I want a BMAD template that generates new agent files in 10 minutes,
So that I can rapidly create agents without boilerplate.

**Acceptance Criteria:**

**Given** I need a new agent
**When** I run the agent generation command
**Then** it creates:
- `agents/{agent-name}.md` (persona definition)
- `skills/{agent-name}/SKILL.md` (trigger conditions)
- `skills/{agent-name}/workflow.md` (execution steps)
- `references/` folder (knowledge base)
**And** all files follow BMAD naming conventions
**And** the agent is registered in the local agent-manifest.csv

### Story 6.2: Persist Agent Definitions to PostgreSQL

As a system architect,
I want agent definitions stored as versioned records in PostgreSQL,
So that we have durable storage and audit history.

**Acceptance Criteria:**

**Given** a new agent is created
**When** the persistence pipeline runs
**Then** it stores in PostgreSQL:
- agent_id (canonical)
- name, description, persona
- created_by, created_at
- version (semantic: 1.0.0)
- status (Draft/Testing/Active/Deprecated/Archived)
- confidence_score (0.0-1.0)
- source_files (JSON array of file paths)
- group_id (tenant isolation)

### Story 6.3: Promote Agent Metadata to Neo4j

As an agent operator,
I want agent metadata searchable in Neo4j,
So that I can discover agents by capability, module, or platform.

**Acceptance Criteria:**

**Given** an agent exists in PostgreSQL
**When** the promotion pipeline runs
**Then** it creates in Neo4j:
- `AIAgent` node with properties
- `HAS_CAPABILITY` relationships to tools
- `BELONGS_TO_MODULE` relationship
- `SUPPORTS_PLATFORM` relationships
- `SUPERSEDES` edges for version lineage

### Story 6.4: Mirror Approved Agents to Notion Registry

As a project manager,
I want approved agents visible in Notion AI Agents Registry,
So that the team has a human-readable agent catalog.

**Acceptance Criteria:**

**Given** an agent reaches confidence ≥ 0.7 and is approved
**When** the mirroring process runs
**Then** it creates/updates Notion row:
- Name (with emoji)
- Type (Persona/Role/System/Technical)
- Module (Core/BMM/CIS/GDS/WDS/External)
- Platform (OpenClaw/OpenCode/GPT-4/Fal.ai)
- Status (Active/Testing/Archived)
- Confidence score
- Function description
- Source Path (link to GitHub/file)

### Story 6.5: Implement Agent Lifecycle State Machine

As a system owner,
I want agents to progress through defined lifecycle states,
So that only tested, approved agents are used in production.

**Acceptance Criteria:**

**Given** an agent in Draft state
**When** it passes initial tests
**Then** it transitions to Testing state
**And** when confidence ≥ 0.7 and human approves
**Then** it transitions to Active state
**And** when superseded by v2
**Then** v1 transitions to Deprecated
**And** after 90 days in Deprecated
**Then** it transitions to Archived

### Story 6.6: Track Agent Confidence and Usage

As an AI engineer,
I want agents to accumulate confidence scores based on usage,
So that high-performing agents are prioritized.

**Acceptance Criteria:**

**Given** an agent executes tasks
**When** tasks complete successfully
**Then** confidence_score increases based on:
- Success rate (0-1)
- Usage frequency (log scale)
- Human feedback (thumbs up/down)
- Time since last failure (decay factor)
**And** confidence is recalculated weekly

### Story 6.7: Support Agent Lineage and Versioning

As a system architect,
I want agent versions linked in Neo4j,
So that I can trace evolution and roll back if needed.

**Acceptance Criteria:**

**Given** Agent v1.0.0 exists
**When** Agent v2.0.0 is created
**Then** Neo4j stores:
- v2.0.0 node with `SUPERSEDES` → v1.0.0
- v1.0.0 status changes to Deprecated
- Both versions remain queryable
- Rollback path preserved

### Story 6.8: Implement Agent Discovery Search

As an agent operator,
I want to search agents by capability, module, or platform,
So that I can find the right agent for my task.

**Acceptance Criteria:**

**Given** 40+ agents exist
**When** I search "grant research"
**Then** it returns agents matching:
- Name/description similarity
- Function text similarity
- Associated tags
- Module/platform filters
**And** results ranked by confidence score

### Story 6.9: Require Human Approval for Agent Promotion

As a compliance officer,
I want human approval required before agents go Active,
So that we maintain quality control.

**Acceptance Criteria:**

**Given** an agent in Testing state with confidence ≥ 0.7
**When** the promotion pipeline runs
**Then** it creates approval request in Mission Control
**And** notifies designated approvers
**And** agent remains Testing until approved
**And** rejection returns agent to Draft with feedback

### Story 6.10: Support Agent Retirement and Archival

As a system owner,
I want deprecated agents archived with usage history preserved,
So that we maintain audit trail without cluttering active registry.

**Acceptance Criteria:**

**Given** an agent in Deprecated state for 90 days
**When** archival process runs
**Then** it:
- Transitions to Archived state
- Moves Notion entry to Archive database
- Preserves Neo4j node (read-only)
- Preserves PostgreSQL records
- Logs final usage statistics
- Removes from active discovery

## Sprint Status

| Story | Status | Owner |
|-------|--------|-------|
| 6.1 | ready-for-dev | TBD |
| 6.2 | ready-for-dev | TBD |
| 6.3 | ready-for-dev | TBD |
| 6.4 | ready-for-dev | TBD |
| 6.5 | ready-for-dev | TBD |
| 6.6 | ready-for-dev | TBD |
| 6.7 | ready-for-dev | TBD |
| 6.8 | ready-for-dev | TBD |
| 6.9 | ready-for-dev | TBD |
| 6.10 | ready-for-dev | TBD |

## Dependencies

- Epic 1 (PostgreSQL/Neo4j infrastructure) - COMPLETE
- Epic 4 (Knowledge curation pipeline) - COMPLETE
- Epic 5 (Notion integration) - COMPLETE
- BMAD core framework - EXISTING

## Outputs

| Artifact | Location |
|----------|----------|
| Agent template generator | `src/lib/agents/generator.ts` |
| Agent persistence service | `src/lib/agents/persistence.ts` |
| Agent lifecycle state machine | `src/lib/agents/lifecycle.ts` |
| Agent discovery API | `src/lib/agents/discovery.ts` |
| Agent approval workflow | `src/lib/agents/approval.ts` |
| Agent lineage tracker | `src/lib/agents/lineage.ts` |

## Definition of Done

- [ ] Agent creation template reduces time to 10 minutes
- [ ] All 40 existing agents migrated to new persistence layer
- [ ] Agent lifecycle states enforced in code
- [ ] Confidence scoring algorithm documented and tested
- [ ] Agent discovery returns results <500ms
- [ ] Human approval workflow tested end-to-end
- [ ] Agent archival preserves full audit trail
- [ ] Documentation updated in Notion

---

*Epic 6: Agent Persistence and Lifecycle Management*
*Created: 2026-03-17*
*Status: Ready for Sprint Planning*