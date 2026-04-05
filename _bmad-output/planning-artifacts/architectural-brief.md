# 🏗️ Architectural Brief

> "We stand before the blueprints of a digital cathedral — a structure of pure 'thought-stuff' that must be anchored in the iron discipline of **conceptual integrity** if it is to survive the **tar pit** of modern systems programming."

**Rule: Allura governs. Runtimes execute. Curators promote.**

---

## I. Five-Layer Architecture

Allura parallels a classical operating system, providing the resource isolation and coordination missing from ad-hoc agent pipelines. All execution runs in Docker — never local.

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **L1** | **Kernel (RuVix)** | 6 primitives, 12 syscalls, zero-trust, proof-gated mutation |
| **L2** | **Services** | Dual-persistence: PostgreSQL (raw events) + Neo4j (curated knowledge) |
| **L3** | **Agent Runtime** | Agent Contracts (ABI), deterministic lifecycle: spawn / pause / resume / checkpoint |
| **L4** | **Workflow & Orchestration** | DAGs, A2A bus, HITL gates at risky transitions |
| **L5** | **User & Application** | Paperclip (multi-tenant dashboard) + OpenClaw (Ubuntu gateway) |

---

## II. RuVix Cognition Kernel (L1)

The minimalist trusted control plane. Understands vectors, graphs, and proofs natively.

| Constraint | Implementation |
|------------|----------------|
| **Six Primitives** | Task, Capability, Region, Queue, Timer, Proof |
| **Twelve Syscalls** | Strictly limited interface — no undeclared operations |
| **Proof-Gated Mutation** | No state change without cryptographic proof-of-intent |
| **Three-Tier Engine** | Reflex (<10μs) → Standard (~100μs) → Deep (~1ms) |
| **Deterministic Replay** | Tamper-evident witness log for faithful fault restoration |

---

## III. Memory Hub — roninmemory (L2)

The dual-persistence split separates **mechanical noise** from **institutional knowledge**.

| Store | Technology | System of Record For |
|-------|------------|---------------------|
| **PostgreSQL 16** | Raw events, outcomes, telemetry | The Present |
| **Neo4j 5.26 + APOC** | Promoted insights, semantic relationships | Decisions |
| **Versioning Model** | Steel Frame (bitemporal) | History — SUPERSEDES, never UPDATE |

### Steel Frame Versioning

Insights are never mutated in place. Old truth is marked `SUPERSEDED`, creating an immutable lineage chain. Agents can always reason about "what was true then" vs "what is true now."

### Reasoning Provenance — AER Triple

Every agent turn records the **why**, not just the **what**:
- **Intent** — why the agent chose this action
- **Observation** — what was concluded from the tool result
- **Inference** — how this conclusion updates the overall strategy

---

## IV. Agent Runtime (L3)

Agents are materialized from **Agent Contracts** — the system's ABI.

### Agent Contract Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the agent role |
| `latency_class` | enum | `HRT` (Hard Real-Time) / `SRT` (Soft) / `DT` (Delay-Tolerant) |
| `capabilities` | array | Allowlist of tool access (e.g. `fs.read`, `web.fetch`) |
| `budgets` | json | Token and currency limits |
| `security` | json | Actions requiring explicit human consent |

### The Surgical Team

| Role | Agent | Responsibility |
|------|-------|----------------|
| **Surgeon** (Lead Architect) | You | Dictates conceptual integrity and safety invariants |
| **Clerk** | Curator Agent | Sifts PostgreSQL traces → proposes Neo4j insights |
| **Toolsmith** | Meta-Agent (ADAS) | Iteratively improves building blocks |
| **Gatekeeper** | Auditor (HITL) | Aegis quality gate — human sign-off before production |

---

## V. Governance & Safety

| Mechanism | Implementation |
|-----------|----------------|
| **Agent Contracts** | Declarative specs: capabilities, budgets, latency class |
| **Aegis Quality Gates** | Schema validation on all writes; human sign-off required |
| **Proof-Gated Mutation** | Cryptographic proof-of-intent at the RuVix kernel |
| **Monthly Budgets** | Token cost limits prevent runaway "werewolf" spending |
| **Weekly Audits** | Drift detection and schema consistency checks |

---

## VI. Interface Layer (L5)

| Component | Runs On | Function |
|-----------|---------|----------|
| **Paperclip** | Docker | Multi-tenant org dashboard — agent roles, budgets, approvals |
| **OpenClaw** | Ubuntu (local) | Self-hosted gateway — bridges WhatsApp, Telegram, Discord to Agent Runtime |

> OpenClaw is the **only** component that runs outside Docker. It is the entry point for all human communication channels and routes through kernel-level policy checks on every intent.

---

## VII. Tech Stack

| Component | Technology | Where |
|-----------|------------|-------|
| Language | TypeScript 5.7 (strict, ES2022) | Docker |
| Runtime | Bun | Docker |
| Raw Events | PostgreSQL 16 | Docker |
| Knowledge Graph | Neo4j 5.26 + APOC | Docker |
| CMS | Payload CMS | Docker |
| Frontend | Next.js | Docker |
| Tool Protocol | MCP | Docker |
| Agent Protocol | A2A | Docker |
| Observability | OpenTelemetry | Docker |
| Intelligence | ADAS Meta-Agent Search | Docker |
| Alignment | GRPO+ | Docker |
| Human Gateway | OpenClaw | Ubuntu (local only) |

---

## VIII. File Structure

| Directory | Mission |
|-----------|---------|
| `ruvix/` | Kernel workspace: nucleus, capability manager, proof engine |
| `memory-bank/` | Hub heart: `index.json` snapshots, `ingestion.meta.json` history |
| `agent-executions/incidents/[ID]/` | Reasoning provenance: `envelope.json`, `steps.jsonl`, `verdict.json` |
| `config/policies/` | Agent Contracts and MCP configurations |
| `postgres-init/` | `group_id` enforcement for multi-tenant isolation |

---

## The Brooksian Principle

> "The bearing of a child takes nine months, no matter how many women are assigned. Do not rush this system by adding more developers — focus on the **conceptual integrity** of the design. By separating cognition from execution and ensuring every decision has structured provenance, we create a **castle in the air** that is not only flexible but fundamentally auditable and secure."

**Rule: Allura governs. Runtimes execute. Curators promote.**
