---
source: notion
url: https://www.notion.so/3321d9be65b3818dbd7fe1c902d00785
date: 2026-04-04
---

# PRD — Roninclaw Custom Agent System (Updated)

## Overview

You're building a **custom multi-agent system** where each project gets its own agent, all sharing the same brain and skill library. The system uses **OpenAgentsControl** for agent identity, **Superpowers** for workflow methodology, and **roninmemory** for persistent context. The goal is to run agents like a small company: consistent naming, shared standards, reusable skills, and project-specific specialization.

---

## 1. Actual Architecture

### Core Framework

**OpenAgentsControl** ([github.com/darrenhinde/OpenAgentsControl](http://github.com/darrenhinde/OpenAgentsControl))
- Core framework for agent orchestration
- Provides agent identity and lifecycle management
- Agent types: **ClawCoder**, **ClawAgent**
- Both configured with memory integration

### Memory System

**roninmemory** (Allura/roninmemory)
- **PostgreSQL**: Raw event traces (immutable, append-only)
- **Neo4j**: Curated insights (knowledge graph)
- Tenant isolation via `group_id: roninclaw`
- MCP_DOCKER tools for integration

### Workflow Methodology

**Superpowers** (obra/superpowers)
- Pattern: **Brainstorm → Plan → Execute → Verify**
- 13 core skills imported and customized
- Memory logging added to all skills

---

## 2. Notion Workspace Structure

### Databases (6 Total)

**1. Claude Projects Dashboard**
- Tracks all roninclaw projects
- Properties: Project, Area, Priority, Status, Timeline, Completion %
- Relations: Agents, Skills, Tasks, Performance Logs, Frameworks, Plugins
- **Current:** 4 projects (Context + Memory, Superpowers Import, Notion Skills, Database Hydration)

**2. EDOS: Tasks Database ⚠️**
- Task management with relations
- Properties: Tasks, Type, Status, Priority, Deadline, Project, Parent item, Sub-item
- Features: Formula-based labels ("Due Today", "Overdue"), Status buttons
- **Current:** 10 tasks linked to projects

**3. Plugins Library**
- Skills catalog
- Properties: Name, Type (Claude Skill), Link, Notes
- **Current:** 22 skills (13 Superpowers + 9 roninclaw custom)

**4. YouTube Videos**
- Tutorial references
- **Current:** 6 videos (Nick Saraev, That Vibe Coder)

**5. Github Repos**
- Repository tracking
- **Current:** 6 repos (OpenAgentsControl, superpowers, typescript-sdk, roninmemory, mcp-playwright, claude-code)

**6. AI Guidelines**
- Documentation standards
- Complete [AI-Guidelines.md](http://AI-Guidelines.md) content

### Supporting Pages

- **Tasks List** — Active task dashboard
- **Projects** — Project overview and navigation
- **Recent** — Quick access to recent work
- **Templates** — Reusable page templates

**Total: 77+ pages created**

---

## 3. Project-Specific Customization

### Supported Projects

- **roninclaw** (core/meta)
- **Faith Meats** (business)
- **Difference Driven** (business)
- **Sabir resume app** (personal)

### Agent Inheritance Model

```javascript
Base Agents (in .opencode/agent/core/)
  ├── ClawCoder
  │     └── faithmeats-coder
  │     └── differencedriven-coder
  │     └── resumeapp-coder
  └── ClawAgent
        └── faithmeats-agent
        └── differencedriven-agent
        └── resumeapp-agent
```

### Project Setup Process

For each new project (e.g., Faith Meats):

1. **Create Notion Teamspace**
	- Duplicate roninclaw structure
	- Or create minimal: Projects DB + Tasks DB

2. **Create Context Files**
	```javascript
.opencode/context/
├── faithmeats/
│   ├── business-domain.md
│   ├── technical-domain.md
│   └── naming-conventions.md
└── differencedriven/
    ├── business-domain.md
    ├── technical-domain.md
    └── naming-conventions.md
	```

3. **Create Project Agents**
	- Copy from ClawCoder/ClawAgent
	- Update skill loading priorities
	- Set `group_id: roninclaw-faithmeats`

4. **Update Memory Client**
	```typescript
export const faithmeatsMemory = new MemoryClient("roninclaw-faithmeats");
export const differencedrivenMemory = new MemoryClient("roninclaw-differencedriven");
	```

5. **Populate Notion**
	- Create project entry in Claude Projects Dashboard
	- Link to appropriate Area (Dev/Content/Personal)
	- Set Status: Not started → In Progress

---

## 4. Integration Points

### OpenAgentsControl

- **Repository:** [github.com/darrenhinde/OpenAgentsControl](http://github.com/darrenhinde/OpenAgentsControl)
- **Usage:** Core framework for agent orchestration
- **Agents:** ClawCoder, ClawAgent already configured
- **Skills:** Loaded from `.opencode/skills/`

### roninmemory

- **Components:** PostgreSQL (raw events) + Neo4j (insights)
- **Tenant Isolation:** `group_id: roninclaw`
- **Connection:** Via MCP_DOCKER tools
- **Logging:** All skills log session_start, session_end, decisions

### Superpowers

- **Repository:** [github.com/obra/superpowers](http://github.com/obra/superpowers)
- **Skills Imported:**
	- Quality & Debugging: requesting-code-review, receiving-code-review, systematic-debugging, verification-before-completion
	- Meta: using-superpowers, dispatching-parallel-agents
	- Workflow: writing-plans, executing-plans, subagent-driven-development, test-driven-development, using-git-worktrees, finishing-a-development-branch, brainstorming
- **Customization:** Memory logging added to all skills

### MCP Docker

- **Purpose:** Discover and manage MCP servers
- **Servers:** memory (roninmemory), youtube_transcript, notion

### Notion API

- **Purpose:** Sync project data
- **Total Pages:** 77+ pages created across 6 databases

---

## 5. Naming Conventions

### Group ID Pattern

```javascript
roninclaw                    → Core project
roninclaw-faithmeats         → Faith Meats
roninclaw-differencedriven   → Difference Driven
roninclaw-[project]          → Pattern for new projects
```

### Agent Naming

```javascript
[project]-coder        → Code implementation agent
[project]-agent        → General purpose agent
[project]-reviewer     → Code review agent (optional)
[project]-debugger     → Debugging specialist (optional)
```

Examples:
- `faithmeats-coder`, `faithmeats-agent`
- `differencedriven-coder`, `differencedriven-agent`

---

## 6. MVP Status

### ✅ COMPLETED

**Infrastructure:**
- ✅ OpenAgentsControl framework configured
- ✅ roninmemory connected (PostgreSQL + Neo4j)
- ✅ MCP_DOCKER tools configured
- ✅ Notion workspace with 6 databases
- ✅ 77+ pages created

**Agents:**
- ✅ ClawCoder agent configured
- ✅ ClawAgent agent configured
- ✅ Memory integration in both agents

**Skills (25 Total):**
- ✅ 13 Superpowers skills imported
- ✅ 3 Notion skills created (dashboard, databases, automation)
- ✅ 8 Infrastructure skills (memory-client, mcp-docker, etc.)
- ✅ All skills customized with roninmemory logging

**Notion Databases:**
- ✅ Claude Projects Dashboard (4 projects)
- ✅ EDOS: Tasks Database (10 tasks)
- ✅ Plugins Library (22 skills)
- ✅ YouTube Videos (6 videos)
- ✅ Github Repos (6 repos)
- ✅ AI Guidelines (complete standards)

**Documentation:**
- ✅ [BLUEPRINT.md](http://BLUEPRINT.md), [SOLUTION-ARCHITECTURE.md](http://SOLUTION-ARCHITECTURE.md), DESIGN-\*.md (4)
- ✅ [REQUIREMENTS-MATRIX.md](http://REQUIREMENTS-MATRIX.md), [RISKS-AND-DECISIONS.md](http://RISKS-AND-DECISIONS.md), [DATA-DICTIONARY.md](http://DATA-DICTIONARY.md)
- ✅ [AI-Guidelines.md](http://AI-Guidelines.md)
- ✅ All with AI-Assisted disclosure notices

**Project Tracking:**
- ✅ Roninclaw Context + Memory Integration (Done)
- ✅ Superpowers Skills Import (Done)
- ✅ Notion Skills Creation (Done)
- ✅ Database Hydration (Done)

### 🔄 IN PROGRESS

- Faith Meats agent customization
- Difference Driven agent setup
- Automated agent creation workflow

### 📋 NEXT PHASE

- Project onboarding template
- Faith Meats full integration
- Difference Driven full integration
- Automated project setup script
- Cross-project memory sharing

---

## 7. Documentation Standards

### AI-Guidelines Compliance

**Required Documents (All Present):**
- ✅ [BLUEPRINT.md](http://BLUEPRINT.md) — Single source of design intent
- ✅ [SOLUTION-ARCHITECTURE.md](http://SOLUTION-ARCHITECTURE.md) — Topological system view
- ✅ DESIGN-\*.md — Deep dives per functional area
- ✅ [REQUIREMENTS-MATRIX.md](http://REQUIREMENTS-MATRIX.md) — B→F tracing
- ✅ [RISKS-AND-DECISIONS.md](http://RISKS-AND-DECISIONS.md) — AD/RK entries
- ✅ [DATA-DICTIONARY.md](http://DATA-DICTIONARY.md) — Canonical field reference

**AI Disclosure:**
- ✅ All documents include AI-Assisted notice
- ✅ Located in `docs/planning/`
- ✅ Cross-referenced between documents

**Quality Checklist:**
- ✅ All B# IDs in Blueprint appear in Requirements Matrix
- ✅ All F# IDs appear in Requirements Matrix and Design docs
- ✅ Entities in Data Dictionary have JSON schemas
- ✅ Mermaid diagrams validated
- ✅ No secrets/credentials in documentation

---

## 8. Success Metrics

### Current Performance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Skills in shared library | 20+ | 25 | ✅ Exceeds |
| Notion pages created | 50+ | 77+ | ✅ Exceeds |
| Documentation compliance | 100% | 100% | ✅ Met |
| Projects tracked | 3+ | 4 | ✅ Met |
| Tasks linked to projects | 8+ | 10 | ✅ Exceeds |

### Updated Metrics

- Time to hydrate new project in Notion: \< 10 minutes
- Agent creation with templates: \< 5 minutes
- Cross-project skill reuse: 100% (shared library)
- Documentation compliance: 100% (AI-Guidelines)
- Memory logging coverage: 100% (all skills)

---

## 9. Security & Governance

### Tenant Isolation

- **Primary:** `group_id: roninclaw` (core)
- **Project-scoped:** `roninclaw-[project]` (Faith Meats, etc.)
- **Risk:** Cross-tenant leakage (mitigated via strict group_id enforcement)

### Memory Retention

- **PostgreSQL:** Immutable raw events (append-only)
- **Neo4j:** Curated insights with relations
- **Policy:** No PII in memory logs
- **Audit:** All events timestamped with agent_id

### Access Control

- **Notion:** Teamspace-based access
- **Skills:** Read-only shared library
- **Agents:** Context-specific configuration

---

## 10. Technical Specifications

### Memory Schema (Raw Events)

```sql
CREATE TABLE events (
  event_id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,          -- 'roninclaw' or 'roninclaw-[project]'
  event_type TEXT NOT NULL,        -- 'session_start', 'skill:end', etc.
  agent_id TEXT NOT NULL,          -- 'clawcoder', 'faithmeats-coder'
  workflow_id TEXT,                -- Optional workflow tracking
  status TEXT NOT NULL,            -- 'pending', 'completed', 'failed'
  metadata JSONB,                -- Flexible metadata
  occurred_at TIMESTAMP NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

### Neo4j Knowledge Graph

**Entity Types:**
- `Project` — roninclaw projects
- `Skill` — Available skills
- `Task` — Tracked tasks
- `BugInsight` — Debugging knowledge
- `ReviewInsight` — Code review patterns

**Relations:**
- `(Project)-[:HAS_TASK]->(Task)`
- `(Project)-[:USES_SKILL]->(Skill)`
- `(Task)-[:LOGS_TO]->(Event)`

---

## Summary

The roninclaw agent system is a **production-ready multi-agent framework** with:

- ✅ OpenAgentsControl foundation
- ✅ roninmemory persistence layer
- ✅ Superpowers workflow methodology
- ✅ Notion workspace integration (77+ pages)
- ✅ 25 skills in shared library
- ✅ AI-Guidelines compliance
- ✅ Project-specific customization capability

**Status: MVP Complete, Ready for Project Expansion**
