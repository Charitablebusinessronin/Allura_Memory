# Solution Architecture: Docker Cleanup for Single-Memory Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed. This is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document covers the topology of the Docker cleanup operation: how the operator interfaces with the system, how waves of tasks execute, and how architectural decisions shape the interaction patterns for safe infrastructure removal.

---

## Table of Contents

- [1. Architectural Positioning](#1-architectural-positioning)
- [2. System Boundary and External Actors](#2-system-boundary-and-external-actors)
- [3. Logical Topologies](#3-logical-topologies)
  - [3.1 Discovery and Baseline Capture](#31-discovery-and-baseline-capture)
  - [3.2 Guardrail Classification](#32-guardrail-classification)
  - [3.3 Scoped Removal Execution](#33-scoped-removal-execution)
  - [3.4 Documentation Reconciliation](#34-documentation-reconciliation)
- [4. Interface Catalogue](#4-interface-catalogue)
- [5. Risk-Architecture Traceability](#5-risk-architecture-traceability)
- [6. Key Architectural Constraints](#6-key-architectural-constraints)
- [7. References](#7-references)

---

## 1. Architectural Positioning

The Docker cleanup is an **operational maintenance task** that modifies the runtime infrastructure state. It is not a control plane or data plane service, but rather a controlled procedure executed by an operator (or automation acting on behalf of an operator).

**Role:** Infrastructure hygiene and consolidation  
**Authority:** Modifies Docker runtime state (containers, networks, volumes)  
**Consumer:** System operator / automation scripts  
**Interaction Frequency:** One-time cleanup with potential for repeat runs

| Consumer Class | Interaction Mode | Notes |
|---|---|---|
| System Operator | CLI / Script-driven | Executes cleanup waves via Docker CLI commands |
| Automation Agent | Script-driven | Can execute verification commands autonomously |
| Runtime Services | Passive | Services being kept or removed do not actively participate |

---

## 2. System Boundary and External Actors

```mermaid
graph TD
    subgraph "External Actors"
        OP[Operator / Automation]
        DOCKER[Docker Daemon]
    end

    subgraph "Cleanup Procedure"
        W1[Wave 1: Discovery]
        W2[Wave 2: Removal]
        W3[Wave 3: Documentation]
        FV[Final Verification]
    end

    subgraph "Evidence Store"
        EVID[docs/evidence/]
    end

    subgraph "Docker Runtime"
        subgraph "Kept Services"
            PG[knowledge-postgres]
            NEO[knowledge-neo4j]
            DOZ[knowledge-dozzle]
            MC[mission-control]
            STIR[stirling-pdf]
        end

        subgraph "Removed Services"
            SUP[supabase-*]
        end

        subgraph "Untouched Services"
            GATE[gateway]
            RES[researcher]
            DASH[dashboard]
            MCP[mcp]
        end
    end

    OP -->|triggers| W1
    OP -->|triggers| W2
    OP -->|triggers| W3

    W1 -->|queries| DOCKER
    W2 -->|modifies| DOCKER
    W3 -->|updates| EVID

    DOCKER -->|manages| PG
    DOCKER -->|manages| NEO
    DOCKER -->|manages| DOZ
    DOCKER -->|manages| MC
    DOCKER -->|manages| STIR
    DOCKER -->|manages| SUP
    DOCKER -->|manages| GATE
    DOCKER -->|manages| RES
    DOCKER -->|manages| DASH
    DOCKER -->|manages| MCP

    W1 -->|writes| EVID
    W2 -->|writes| EVID
    FV -->|reads| EVID
```

---

## 3. Logical Topologies

Each topology represents a distinct interaction pattern for the cleanup operation.

### 3.1 Discovery and Baseline Capture

**Purpose:** Capture complete pre-cleanup state for rollback reference and verification baseline.

```mermaid
sequenceDiagram
    actor Operator
    participant INV as BaselineInventory
    participant DOCKER as Docker Daemon
    participant EVID as Evidence File

    Operator->>INV: Execute discovery
    INV->>DOCKER: docker ps (running containers)
    DOCKER-->>INV: Container list
    INV->>DOCKER: docker ps -a (all containers)
    DOCKER-->>INV: All containers list
    INV->>DOCKER: docker volume ls
    DOCKER-->>INV: Volume list
    INV->>DOCKER: docker network ls
    DOCKER-->>INV: Network list
    INV->>DOCKER: docker ps --format (with ports)
    DOCKER-->>INV: Port mappings
    INV->>EVID: Write task-1-baseline.txt
    EVID-->>Operator: Evidence captured
```

**Key constraints:**
- Read-only queries; no modification of runtime state
- All output saved to evidence files before proceeding
- Must capture both running and stopped containers

---

### 3.2 Guardrail Classification

**Purpose:** Explicitly classify every discovered resource to prevent accidental removal.

```mermaid
sequenceDiagram
    actor Operator
    participant DISC as ArtifactDiscovery
    participant MATRIX as GuardrailMatrix
    participant EVID as Evidence File

    Operator->>DISC: Discover all resources
    DISC->>DISC: Filter by supabase prefix
    DISC-->>MATRIX: Supabase artifacts list
    MATRIX->>MATRIX: Classify resources
    Note over MATRIX: KEEP: knowledge-*, mission-control, stirling-pdf
    Note over MATRIX: REMOVE: supabase-*
    Note over MATRIX: DO-NOT-TOUCH: gateway, researcher, dashboard, mcp
    MATRIX->>EVID: Write task-3-guardrail-matrix.md
    EVID-->>Operator: Classification documented
```

**Key constraints:**
- Every resource must have explicit classification
- Rationale must be documented for each decision
- Ambiguous resources default to DO-NOT-TOUCH pending approval

---

### 3.3 Scoped Removal Execution

**Purpose:** Remove Supabase artifacts while protecting kept services.

```mermaid
sequenceDiagram
    actor Operator
    participant STOP as StopSupabase
    participant REM as ScopedRemover
    participant DOCKER as Docker Daemon
    participant VAL as Validation
    participant EVID as Evidence File

    Operator->>STOP: Stop Supabase services
    STOP->>DOCKER: docker stop (supabase containers)
    DOCKER-->>STOP: Containers stopped
    STOP->>EVID: Write task-6-stop-supabase.txt

    Operator->>REM: Remove artifacts
    REM->>DOCKER: docker rm (supabase containers)
    DOCKER-->>REM: Containers removed
    REM->>DOCKER: docker network rm (supabase networks)
    DOCKER-->>REM: Networks removed
    REM->>DOCKER: docker volume rm (supabase volumes)
    DOCKER-->>REM: Volumes removed
    REM->>EVID: Write task-7-removal-results.txt

    Operator->>VAL: Validate removal
    VAL->>DOCKER: docker ps | grep supabase
    DOCKER-->>VAL: No results
    VAL->>EVID: Write task-7-removal-results.txt
```

**Key constraints:**
- Stop before remove (clean shutdown)
- Verify keep-services still running after each phase
- Never use wildcard or bulk delete commands
- Halt immediately on unexpected state change

---

### 3.4 Documentation Reconciliation

**Purpose:** Align deployment documentation with actual post-cleanup runtime state.

```mermaid
sequenceDiagram
    actor Operator
    participant PORT as PortReconciler
    participant DOCKER as Docker Daemon
    participant DOCS as Deployment Docs
    participant EVID as Evidence File

    Operator->>PORT: Detect live ports
    PORT->>DOCKER: docker ps (port mappings)
    DOCKER-->>PORT: Current bindings
    PORT->>PORT: Compare with compose file
    PORT->>EVID: Write task-9-port-reconcile.txt

    Operator->>DOCS: Update service tables
    DOCS->>DOCS: Replace Supabase entries with removal note
    DOCS->>DOCS: Update port references
    DOCS->>DOCS: Add cleanup runbook section

    Operator->>EVID: Write task-11-doc-consistency.txt
```

**Key constraints:**
- Document actual detected ports, not assumed values
- Note any compose-vs-runtime discrepancies explicitly
- Include handoff note for operators

---

## 4. Interface Catalogue

| Interface | Direction | Channel | Payload / Contract | Risk / Decision |
|---|---|---|---|---|
| Docker Daemon | Bidirectional | Docker API / CLI | Container/network/volume operations | RK-01 (Accidental removal) |
| Evidence Files | Outbound | Filesystem | Command output, health status | RK-03 (Missing audit trail) |
| Deployment Docs | Outbound | Markdown files | Updated service tables, runbook | RK-02 (Doc drift) |
| Health Endpoints | Inbound | HTTP / TCP | Status codes, ready checks | RK-04 (Health regression) |

---

## 5. Risk-Architecture Traceability

| Section | Risks and Decisions Addressed |
|---|---|
| §3.1 Discovery and Baseline Capture | RK-03 (Missing evidence), AD-01 (Evidence-first approach) |
| §3.2 Guardrail Classification | RK-01 (Accidental removal), AD-02 (Explicit classification) |
| §3.3 Scoped Removal Execution | RK-01 (Accidental removal), RK-04 (Health regression) |
| §3.4 Documentation Reconciliation | RK-02 (Doc drift), AD-03 (Runtime-verified documentation) |

---

## 6. Key Architectural Constraints

| Constraint | Rationale |
|---|---|
| **MUST** capture evidence before any modification | Provides rollback reference and audit trail (AD-01) |
| **MUST** classify every resource before removal | Prevents accidental deletion of services (AD-02, RK-01) |
| **MUST NOT** use broad destructive commands (`docker system prune -a`) | Avoids collateral damage to untargeted services (RK-01) |
| **MUST** verify keep-services health after each removal phase | Detects unintended side effects immediately (RK-04) |
| **MUST** document actual runtime ports, not assumed values | Prevents documentation drift from reality (AD-03, RK-02) |
| **MUST** halt on any health regression | Protects operational continuity (RK-04) |

---

## 7. References

- [BLUEPRINT.md](./BLUEPRINT.md) — Core design, requirements, data model, execution rules
- [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) — Architectural decisions and risk mitigations
- [REQUIREMENTS-MATRIX.md](./REQUIREMENTS-MATRIX.md) — Requirement traceability
- [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) — Canonical field definitions
- [TASKS.md](./TASKS.md) — Implementation task plan with waves and dependencies
