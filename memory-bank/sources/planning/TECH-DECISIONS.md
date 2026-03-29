# Technical Decisions Record

> **Status:** Living document — updated as decisions are ratified.
> **Date:** 2026-03-29

---

## TD-01: pnpm Monorepo

**Decision:** Use `pnpm` as the package manager with a workspace-based monorepo.

**Rationale:**
- Single source of truth for shared schemas and contracts in `packages/contracts/`
- Each layer (Management, Execution, Memory, Meta-Agent) is an independent deployable
- `pnpm` strict dependency resolution prevents phantom deps across workspaces
- `pnpm-workspace.yaml` defines `apps/*` and `packages/*` as workspace roots

**Alternatives considered:** npm workspaces (no strict isolation), Turborepo (adds build orchestration overhead not needed yet), Nx (too heavy for current stage)

---

## TD-02: TypeScript + Next.js for UI Layers

**Decision:** Use TypeScript with Next.js for `apps/execution` (port 7777) and `apps/management` (port 8888).

**Rationale:**
- Full-stack SSR for dashboard pages with API routes for gateway endpoints
- React 19 RC for the UI layer with `lucide-react` for iconography
- TypeScript strict mode for contracts alignment with JSON schemas

**Versions:** Next.js 15.0.0, React 19.0.0-rc, TypeScript ^5

---

## TD-03: Python for Meta-Agent (ADAS)

**Decision:** Use Python for `apps/meta-agent/` — the AgentBreeder and ADAS evaluation scripts.

**Rationale:**
- Primary ecosystem for ML/AI evaluation frameworks
- SciPy, NumPy, and transformer libraries are Python-native
- Blue Mode sandbox evaluation naturally fits Python scripting
- Isolated from the TypeScript apps — communicates via Redis events

---

## TD-04: Dual Persistence (PostgreSQL + Neo4j)

**Decision:** Implement `packages/memory/` with two persistence targets:

| Store | Purpose | Data Type |
|---|---|---|
| PostgreSQL 16 | Raw trace store | `raw-memory-event` records (immutable, append-only) |
| Neo4j 5 | Semantic insight graph | `semantic-insight` nodes (versioned, curator-reviewed) |

**Rationale:**
- Raw events require ACID guarantees and time-series querying → PostgreSQL
- Semantic insights require graph traversal and relationship querying → Neo4j
- `group_id` scoping enforced at both layers for multi-tenant isolation
- Knowledge promotion workflow bridges the two: raw events → proposed insight → HITL review → published node

---

## TD-05: Redis Event Bus

**Decision:** Use Redis pub/sub for the internal event bus with `domain.action` named channels.

**Events defined:**

| Channel | Producer | Consumers |
|---|---|---|
| `goal.approved` | Paperclip | OpenClaw, dashboards |
| `execution.state_changed` | OpenClaw | Postgres, dashboards, alerts |
| `budget.threshold_hit` | Budget controller | Alerts, operator console |
| `knowledge.promotion.proposed` | Knowledge curator | Paperclip approval queue |
| `knowledge.promotion.approved` | Paperclip | Neo4j publisher, audit |
| `candidate.scored` | AgentBreeder | Paperclip governance |
| `candidate.promoted` | Paperclip | OpenClaw profile registry |

**Rationale:**
- Lightweight, sufficient for local/single-node deployment
- Natural fit for pub/sub event patterns
- Upgradeable to NATS or Kafka when scaling beyond single host

---

## TD-06: kebab-case File Naming

**Decision:** All entity names, schema files, and module identifiers use kebab-case.

**Examples:**
- `agent-profile.schema.json` (not `agentProfile.schema.json`)
- `raw-memory-event` (not `rawMemoryEvent`)
- `task-execution.schema.json`

**Rationale:**
- Consistent across TypeScript and Python environments
- Matches filesystem conventions (no case-sensitive issues on macOS/Windows)
- Aligns with npm/pnpm package naming conventions

---

## TD-07: Docker Compose for Local Infrastructure

**Decision:** Use Docker Compose to manage PostgreSQL, Neo4j, and Redis locally.

**Services:**

| Service | Image | Port |
|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 |
| `neo4j` | `neo4j:5-community` | 7474 (UI), 7687 (Bolt) |
| `redis` | `redis:7-alpine` | 6379 |

**App services (`management`, `execution`) run locally** via `pnpm dev:*` during development. Containerized app deployment is a future concern once the core services are validated.

---

## TD-08: Per-Project OpenAgentsControl Framework

**Decision:** Use the OpenAgentsControl framework per project (installed locally in `.opencode/`) as the standard execute engine, instead of a global "Beast Mode" engine.

**Key mappings:**
- OAC `@approval_gate` → Paperclip HITL governance decisions
- OAC `TaskManager` subtask chains → Goal ancestry (F2)
- OAC `ContextScout` → Lesson synthesis feedback loop (F16)
- OAC `TestEngineer` + `CodeReviewer` → Automated validation gates

**Profile installed:** Developer (95 components)

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | OpenClaw gateway: REST API or WebSocket for messaging app integration? | TBD | Open |
| OQ-2 | Authentication for management dashboard: NextAuth vs. Clerk vs. custom? | TBD | Open |
| OQ-3 | Meta-agent Python framework: LangChain vs. custom eval harness? | TBD | Open |
| OQ-4 | Escalation policy for RK-03 (Approval deadlocks): timeout auto-escalation? | TBD | Open |
