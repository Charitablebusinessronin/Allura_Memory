---
stepsCompleted: ["epic-draft"]
inputDocuments:
  - docs/superpowers/specs/2026-04-03-openagents-control-registry-design.md
  - docs/superpowers/plans/2026-04-03-openagents-control-registry.md
---

# OpenAgents Control Registry - Epic Breakdown

## Overview

This document breaks the OpenAgents Control Registry initiative into 4 implementation epics, covering canonical Notion registry setup, local-source extraction, normalization + drift detection, and operational CLI/runtime governance.

## Requirements Inventory

### Functional Requirements

- FR1: Create canonical Notion registries under OpenAgents Control (`Agents`, `Skills`, `Commands`, `Workflows`, `Sync Registry`)
- FR2: Define source-of-truth config mapping local sync runtime to Notion registry IDs
- FR3: Extract local entities from `.opencode/` and `_bmad/` sources
- FR4: Normalize extracted entities into a canonical relation graph
- FR5: Detect drift between local entities and Notion state
- FR6: Run sync in dry-run and live modes
- FR7: Log sync runs and implementation milestones in PostgreSQL append-only trace system
- FR8: Expose operator CLI commands for routine sync usage

### Non-Functional Requirements

- NFR1: Append-only audit trail behavior for event logging
- NFR2: `group_id` enforcement for all PostgreSQL trace writes
- NFR3: Non-destructive Notion operations by default (upsert-oriented, no deletes without explicit approval)
- NFR4: Type-safe TypeScript interfaces for registry entities and drift reporting
- NFR5: Test coverage for extract/normalize/verify/sync modules

### FR Coverage Map

- Epic 1: FR1, FR2
- Epic 2: FR3
- Epic 3: FR4, FR5
- Epic 4: FR6, FR7, FR8 (+ NFR validation)

## Epic List

1. Epic 1: Canonical Registry Foundation (Notion + Config)
2. Epic 2: Local Source Extraction Layer
3. Epic 3: Normalization and Drift Intelligence
4. Epic 4: Sync Operations, CLI, and Runtime Governance

---

## Epic 1: Canonical Registry Foundation (Notion + Config)

Establish the canonical OpenAgents control-plane registries and persistent ID mapping needed for sync orchestration.

### Story 1.1: Create canonical Notion registries
As a platform operator,  
I want all required control registries created with stable schemas and views,  
So that sync operations target a governed, predictable Notion structure.

**Acceptance Criteria:**
- Given the OpenAgents Control page ID, when setup runs, then 5 registries exist: Agents, Skills, Commands, Workflows, Sync Registry.
- Given each registry, when inspected, then required properties and select options match the design spec.
- Given each registry, when inspected, then required default views exist (All/Active/By Type/By Category or equivalent per schema).
- Given Notion default behavior, when DB is created, then extra default view may exist and is preserved non-destructively.

### Story 1.2: Persist registry IDs for runtime
As a sync runtime,  
I want stable Notion database/data source IDs in local config,  
So that future sync operations can resolve targets deterministically.

**Acceptance Criteria:**
- Given completed registry creation, when IDs are persisted, then `.opencode/config/registry-databases.json` includes hub + all DB/data source IDs.
- Given sync runtime startup, when config is loaded, then all required IDs resolve without missing fields.

---

## Epic 2: Local Source Extraction Layer

Parse local OpenCode and BMad sources into canonical typed entities.

### Story 2.1: Extract agents from OpenCode + BMad manifests
As a sync engine,  
I want canonical agent entities from all local agent sources,  
So that Notion can mirror runtime and persona inventories.

**Acceptance Criteria:**
- Given `.opencode/config/agent-metadata.json`, when extractor runs, then OpenCode agents are emitted with mapped type/category.
- Given `_bmad/_config/agent-manifest.csv`, when extractor runs, then BMad/WDS personas are emitted with canonical typing.
- Given output entities, when validated, then required canonical fields are present.
- Given type constraints, when category values include `project`, then union typing supports it explicitly.

### Story 2.2: Extract skills from SKILL.md corpus
As a sync engine,  
I want canonical skills from local skill directories,  
So that registry reflects actual installed skill capabilities.

**Acceptance Criteria:**
- Given `.opencode/skills/*/SKILL.md`, when extractor runs, then skills are discovered via glob and emitted.
- Given frontmatter fields, when parsed, then name/description are captured and YAML quotes normalized.
- Given category heuristics, when skill IDs include `bmad-testarch` or `bmad-tea`, then category maps to `tea`.
- Given content scan, when tools are referenced, then `requiredTools` contains valid tool enums.
- Given tests, when executed, then extraction/count/category/tool assertions pass.

### Story 2.3: Extract commands and workflows
As a sync engine,  
I want canonical command/workflow entities from local definitions,  
So that sync covers execution surfaces and process catalog.

**Acceptance Criteria:**
- Given `.opencode/command/**/*.md`, when extractor runs, then commands include intent/category/HITL markers.
- Given `_bmad/*/module-help.csv`, when extractor runs, then workflows include module/phase/required status.
- Given extractor tests, when executed, then known command and workflow fixtures validate successfully.

---

## Epic 3: Normalization and Drift Intelligence

Build relation graph + drift analysis for actionable sync decisions.

### Story 3.1: Normalize canonical entities into relation graph
As a sync engine,  
I want relation maps across entities,  
So that linkage quality and dependency integrity are computable before write operations.

**Acceptance Criteria:**
- Given extracted entities, when normalized, then graph includes:
  - agentToSkills
  - agentToCommands
  - agentToWorkflows
  - commandToSkills
  - workflowToAgent
- Given reverse-link backfill, when normalize runs, then skills/commands include linked agents where applicable.
- Given empty inputs, when normalize runs, then output is valid and non-throwing.

### Story 3.2: Compute drift report against Notion state
As an operator,  
I want missing/orphaned entities and broken links identified,  
So that sync actions are explicit and auditable.

**Acceptance Criteria:**
- Given local and Notion agent inventories, when verify runs, then `missingInNotion` and `missingInLocal` are computed.
- Given relation graph, when verify runs, then unresolved links appear in `brokenLinks`.
- Given current scope, when verify runs, then field mismatch detection may return empty until enhanced in future iteration.

---

## Epic 4: Sync Operations, CLI, and Runtime Governance

Operationalize dry-run/live sync and ensure governance-grade observability.

### Story 4.1: Implement sync orchestrator pipeline
As an operator,  
I want one command to execute extract->normalize->verify->upsert flow,  
So that registry hydration is repeatable and low-risk.

**Acceptance Criteria:**
- Given registry config, when sync starts, then all extractors run and normalize output is built.
- Given dry-run mode, when invoked, then no Notion writes occur and counts are printed.
- Given live mode, when invoked, then missing agent records are created and sync summary is produced.

### Story 4.2: Log sync runs to Notion Sync Registry
As a governance stakeholder,  
I want each sync run persisted as an audit row,  
So that drift and reconciliation history are traceable.

**Acceptance Criteria:**
- Given a completed sync attempt, when logger runs, then a Sync Registry record is created with run metadata and drift summary.
- Given partial/broken-link outcome, when status is set, then run status reflects `partial` or `success` correctly.

### Story 4.3: Provide operational CLI commands
As a developer/operator,  
I want simple package scripts for dry-run and sync,  
So that ongoing hydration is easy and consistent.

**Acceptance Criteria:**
- Given `package.json`, when inspected, then `registry:dry-run` and `registry:sync` scripts exist.
- Given `bun run registry:dry-run`, when executed, then extraction and drift counts are printed.

### Story 4.4: Enforce runtime audit logging to PostgreSQL
As a platform governance system,  
I want implementation and milestone events recorded append-only in PostgreSQL,  
So that execution history is reconstructable.

**Acceptance Criteria:**
- Given completed phases, when logging scripts run, then `insertEvent` writes append-only events with `group_id`.
- Given logged milestones, when queried, then events show phase completion and summary metadata.
- Given logging failures, when encountered, then errors are surfaced without silent drops.
