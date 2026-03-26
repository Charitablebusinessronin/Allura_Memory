# Risks & Decisions Matrix: Docker Cleanup for Single-Memory Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document captures key architectural and operational decisions made for the Docker cleanup operation, the rationale behind each, the alternatives considered, and the risks they introduce. It exists to help operators understand why the cleanup is structured as it is, and to evaluate the impact of changing the approach.

---

## Table of Contents

- [1. Architectural Decisions](#1-architectural-decisions)
  - [AD-01: Evidence-First Baseline Capture](#ad-01-evidence-first-baseline-capture)
  - [AD-02: Explicit Guardrail Classification](#ad-02-explicit-guardrail-classification)
  - [AD-03: Runtime-Verified Documentation](#ad-03-runtime-verified-documentation)
- [2. Risks](#2-risks)
  - [RK-01: Accidental Removal of Critical Services](#rk-01-accidental-removal-of-critical-services)
  - [RK-02: Documentation Drift from Runtime](#rk-02-documentation-drift-from-runtime)
  - [RK-03: Missing Evidence for Rollback](#rk-03-missing-evidence-for-rollback)
  - [RK-04: Health Regression in Kept Services](#rk-04-health-regression-in-kept-services)

---

## 1. Architectural Decisions

### AD-01: Evidence-First Baseline Capture

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Every cleanup phase must produce command output saved to `docs/evidence/` files before any state modification. No phase completes without documented evidence. |
| **Rationale** | Provides rollback reference points, audit trail for compliance, and debugging context if issues arise. Evidence files serve as the source of truth for what existed before changes. |
| **Alternatives considered** | In-memory tracking only — rejected because session loss would destroy audit trail. Post-cleanup documentation only — rejected because baseline would be lost. |
| **Consequences** | Adds overhead to each task (file I/O), requires `docs/evidence/` directory existence, but provides complete traceability. |
| **References** | [BLUEPRINT.md](./BLUEPRINT.md) §9 Logging & Audit, [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) Evidence File |

---

### AD-02: Explicit Guardrail Classification

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Every discovered Docker resource must be explicitly classified as KEEP, REMOVE, or DO-NOT-TOUCH before any removal action. Ambiguous resources default to DO-NOT-TOUCH. |
| **Rationale** | Prevents accidental removal through explicit decision-making. Forces operator to consider each resource intentionally. Creates defensible record of why each action was taken. |
| **Alternatives considered** | Pattern-based auto-removal (e.g., "remove everything with supabase prefix") — rejected because false positives could destroy critical services. Interactive prompts — rejected because automation must be possible. |
| **Consequences** | Requires manual review step, but significantly reduces risk of accidental deletion. Adds time to Wave 1 but protects against costly mistakes. |
| **References** | [BLUEPRINT.md](./BLUEPRINT.md) §1 Core Concepts (Service Classification Matrix), [TASKS.md](./TASKS.md) T3 |

---

### AD-03: Runtime-Verified Documentation

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Documentation must reflect actual live runtime state (detected ports, container status) rather than declared configuration or assumptions. Any discrepancies between compose file and runtime must be explicitly noted. |
| **Rationale** | Prevents silent documentation drift. Ensures operators have accurate information for troubleshooting. Avoids assumptions that may be outdated or incorrect. |
| **Alternatives considered** | Trust docker-compose.yml as source of truth — rejected because manual runtime modifications may not be reflected in compose file. Use prior notes — rejected because port mappings noted elsewhere (5420/5002 vs 3001/8001) showed discrepancies. |
| **Consequences** | Requires active detection step (T9), but produces authoritative documentation. May reveal configuration drift that needs separate attention. |
| **References** | [BLUEPRINT.md](./BLUEPRINT.md) §7 Global Constraints (Port ambiguity resolved by verification), [TASKS.md](./TASKS.md) T9 |

---

## 2. Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| [RK-01](#rk-01-accidental-removal-of-critical-services) | Accidental Removal of Critical Services | High | ✅ Mitigated |
| [RK-02](#rk-02-documentation-drift-from-runtime) | Documentation Drift from Runtime | Medium | ✅ Mitigated |
| [RK-03](#rk-03-missing-evidence-for-rollback) | Missing Evidence for Rollback | Medium | ✅ Mitigated |
| [RK-04](#rk-04-health-regression-in-kept-services) | Health Regression in Kept Services | Medium | ✅ Mitigated |

---

### RK-01: Accidental Removal of Critical Services

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Likelihood** | Low–Medium (without guardrails) |
| **Status** | ✅ Mitigated |
| **Description** | During Supabase removal, critical services (knowledge-postgres, knowledge-neo4j, mission-control, stirling-pdf) could be accidentally deleted due to misidentification, wildcard commands, or script errors. This would cause data loss and service outage. |
| **Mitigation** | 1. Explicit guardrail matrix (AD-02) classifies every resource before action. 2. Scoped removal commands use explicit identifiers from artifact list, never wildcards. 3. Verification checks ensure keep-services remain after each phase. 4. Rollback checkpoints prepared in advance. |
| **Related decision** | [AD-02: Explicit Guardrail Classification](#ad-02-explicit-guardrail-classification) |

---

### RK-02: Documentation Drift from Runtime

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | High (without verification) |
| **Status** | ✅ Mitigated |
| **Description** | Deployment documentation may describe ports, service names, or architectures that do not match the actual runtime. This leads to operator confusion, failed troubleshooting, and incorrect assumptions. Port mapping mismatch exists between prior notes (5420/5002) and compose file (3001/8001). |
| **Mitigation** | 1. Task T9 explicitly detects actual live port bindings. 2. Documentation reconciliation task (T11) updates docs with verified values. 3. Discrepancies noted explicitly for follow-up attention. |
| **Related decision** | [AD-03: Runtime-Verified Documentation](#ad-03-runtime-verified-documentation) |

---

### RK-03: Missing Evidence for Rollback

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Medium (without evidence requirement) |
| **Status** | ✅ Mitigated |
| **Description** | If cleanup causes issues, lack of pre-cleanup state information makes rollback difficult. Without evidence of what existed, restoring previous state becomes guesswork. |
| **Mitigation** | 1. Evidence-first approach (AD-01) requires all commands produce saved output. 2. Baseline inventory (T1) captures complete pre-cleanup state. 3. Rollback checklist (T4) provides service-specific recovery commands. 4. Evidence index (T13) ensures all artifacts are discoverable. |
| **Related decision** | [AD-01: Evidence-First Baseline Capture](#ad-01-evidence-first-baseline-capture) |

---

### RK-04: Health Regression in Kept Services

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Low–Medium |
| **Status** | ✅ Mitigated |
| **Description** | Supabase removal or related network/volume cleanup could inadvertently affect kept services through shared resources, dependencies, or unintended side effects. Services might become unhealthy without immediate detection. |
| **Mitigation** | 1. Pre-cleanup health verification (T5) establishes baseline. 2. Post-removal health verification (T10) compares against baseline. 3. Health check on keep-services after each removal phase. 4. Immediate halt on any regression with rollback option. |
| **Related decision** | [BLUEPRINT.md](./BLUEPRINT.md) §6 Execution Rules (Health Check Rules) |

---

**See also:**
- [BLUEPRINT.md](./BLUEPRINT.md) — system design this document is based on
- [REQUIREMENTS-MATRIX.md](./REQUIREMENTS-MATRIX.md) — requirement traceability
- [SOLUTION-ARCHITECTURE.md](./SOLUTION-ARCHITECTURE.md) — topology and interaction patterns

---

## 3. Decisions from 2026-03-25 Docker Cleanup Session

### AD-04: External Mission Control Deployment

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Mission Control services are maintained by an external project (`/home/ronin704/dev/projects/openclaw-mission-control/compose.yml`) and NOT included in this repository's docker-compose.yml. The external deployment runs on ports 5420 (frontend), 5002 (backend), 5433 (db), 6379 (redis). |
| **Rationale** | Mission Control was discovered running from an external project with port mismatch to this compose (5420/5002 vs 3001/8001). Duplicating it in both would cause conflicts. External deployment is stable and functional. |
| **Alternatives considered** | Merge into this compose — rejected because external project is primary source of truth and running. Remove Mission Control entirely — rejected because it's needed for operation. |
| **Consequences** | This compose only manages core memory services (postgres, neo4j, dozzle, mcp). Mission Control must be started/stopped from its external project. |
| **References** | Session 2026-03-25, container inspection |

---

### AD-05: Simplified Core docker-compose.yml

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | This repository's `docker-compose.yml` is simplified to core memory services only: `postgres` (knowledge-postgres:5432), `neo4j` (knowledge-neo4j:7474/7687), `dozzle` (knowledge-dozzle:8088), and `mcp` (allura-memory-mcp). Services removed: `mission-control`, `mission-control-db`, `dashboard`, `openclaw-gateway`, `ronin-researcher`. |
| **Rationale** | 1) Mission Control handled externally (AD-04). 2) Dashboard container was never running. 3) OpenClaw gateway and researcher are not actively used. 4) Simplifying reduces maintenance burden and removes broken containers. |
| **Alternatives considered** | Keep all services with comments — rejected because creates confusion about what's supported. Create separate compose files for each — rejected as over-engineering for current needs. |
| **Consequences** | Single memory stack: PostgreSQL + Neo4j + Dozzle + MCP. Developers needing other services must use external projects. |
| **References** | Session 2026-03-25, docker-compose.yml cleanup |

---

### AD-06: Supabase Artifact Removal

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Supabase-related Docker artifacts (networks, volumes) were removed: `supabase_network_workspace`, `supabase_db_workspace`, `supabase_storage_workspace`. |
| **Rationale** | Supabase was confirmed empty (0 tables/0 rows) and not in use. Leftover network and volumes from prior experimentation were orphaned. |
| **Alternatives considered** | Keep for potential future use — rejected to reduce clutter and avoid confusion. |
| **Consequences** | Clean removal with no impact on running services. Volumes cannot be recovered without re-creating Supabase stack. |
| **References** | Session 2026-03-25, cleanup history |

---

### AD-07: Broken Container Removal

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Removed broken container `mission-control-db` that was in "Created" state but never started. |
| **Rationale** | Container was created from this compose's mission-control-db service but failed health checks and never reached running state. External Mission Control has its own db running successfully. |
| **Alternatives considered** | Debug and fix — rejected because external Mission Control already provides this functionality. |
| **Consequences** | No operational impact; container was non-functional. |
| **References** | Session 2026-03-25, `docker ps -a` inspection |

---

**See also:**
- [AD-04 External Mission Control Deployment](#ad-04-external-mission-control-deployment)
- [AD-05 Simplified Core docker-compose.yml](#ad-05-simplified-core-docker-composeyml)
- docker-compose.yml (current version)
