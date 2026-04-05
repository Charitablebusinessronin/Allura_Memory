# ADAS Implementation Tasks

> Status: Working in progress — generated from gap analysis 2026-03-25

---

## Task & Plan Location

This repository uses a docs-based planning system. All active plans and drafts live under:

- **`docs/plans/`** — active implementation plans
- **`docs/drafts/`** — work-in-progress drafts and exploratory documents

### Related ADAS Plans

- [ADAS / OpenClaw Integration](../plans/adas-openclaw-integration.md)
- [Mission Control / OpenClaw Integration](../plans/mission-control-openclaw-integration.md)

---

## Overview

This tracks remaining implementation tasks for ADAS (Automated Agent Design & Assistant System). See [BLUEPRINT.md](BLUEPRINT.md) for full system design.

---

## Done ✅

| Task | Completed | Notes |
|------|-----------|-------|
| Ollama client (local + cloud routing) | ✅ | Bearer auth for cloud, no auth for local |
| Two-tier model system (stable/experimental) | ✅ | 2 stable, 4 experimental models |
| EvaluationHarness + PostgreSQL logging | ✅ | Real LLM calls, full audit trail |
| Ranking by composite score | ✅ | accuracy/cost/latency weighted |
| ADAS CLI (evolutionary search) | ✅ | `bun tsx src/lib/adas/cli.ts` |
| HITL promotion workflow | ✅ | Proposal → human review → approve/reject |
| Safety monitor | ✅ | Design validation before execution |
| Mutation operators | ✅ | Prompt, model, strategy mutation |
| Crossover/recombination | ✅ | Single-point crossover on designs |
| All 215 ADAS tests passing | ✅ | `bun test src/lib/adas/` |
| Formal documentation suite | ✅ | BLUEPRINT, SOLUTION-ARCHITECTURE, RISKS-AND-DECISIONS, REQUIREMENTS-MATRIX, DATA-DICTIONARY |

---

## Must Have (MVP)

### [ ] MCP Server Integration
**Priority:** P0 — Blocking  
**Description:** Expose ADAS as an MCP tool so agents can invoke it via MCP protocol  
**Files affected:**
- `src/mcp/memory-server.ts` — add ADAS tool handlers
- `src/lib/adas/index.ts` — ensure clean public API for MCP

**Acceptance criteria:**
- [ ] `mcp__adas__run_search` tool — accepts domain, iterations, population, returns best design
- [ ] `mcp__adas__get_proposals` tool — list pending promotion proposals
- [ ] `mcp__adas__approve_proposal` tool — approve/reject a proposal
- [ ] MCP server registers ADAS tools on startup
- [ ] Tools tested end-to-end via MCP client

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §8 API Surface, [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) AD-03

---

### [ ] Tool Implementations (Replace "not implemented" Stubs)
**Priority:** P1  
**Description:** When ADAS generates agent code with tool calls, those tools return `{ result: "not implemented" }`. Need real implementations.  
**File:** `src/lib/adas/agent-design.ts` — `implementTools()` function  
**Current state:** Tools are scaffolded but return stub values

**Tool targets (priority order):**
1. [ ] `web_search(query)` — search the web for information
2. [ ] `file_read(path)` — read a file from the filesystem
3. [ ] `file_write(path, content)` — write content to a file
4. [ ] `code_execute(code, language)` — execute code in sandbox
5. [ ] `memory_search(query)` — search indexed memory
6. [ ] `http_get(url)` — make HTTP GET request (sandboxed)

**Acceptance criteria:**
- [ ] All tool functions return real data (not "not implemented")
- [ ] Tools are sandboxed (no network in docker mode, resource limits in process mode)
- [ ] Tool errors return structured error JSON (not exceptions)

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §1 `AgentDesign.config.tools`, [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) RK-02

---

## Should Have

### [ ] Sandbox Docker Execution
**Priority:** P2  
**Description:** Docker mode for sandboxed code execution is defined but not tested/configured  
**File:** `src/lib/adas/sandbox.ts` — `executeInDocker()` method  
**Prerequisites:** Docker socket configuration

**Acceptance criteria:**
- [ ] Docker socket mounted into sandbox container (or `docker:2375` var)
- [ ] Read-only filesystem enforced (`--read-only` flag)
- [ ] No network (`--network none`)
- [ ] CPU/memory limits enforced
- [ ] Integration test passes: code that tries network access is blocked

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §1 `Sandbox`, [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) RK-02

---

### [ ] Web Dashboard — Search Progress & Proposals
**Priority:** P2  
**Description:** No UI for viewing search progress, leaderboard, or promotion proposals  
**Stack:** (TBD — could be simple HTML + SSE, or React)

**Acceptance criteria:**
- [ ] Real-time search progress (current iteration, evaluated count)
- [ ] Leaderboard: top designs by composite score
- [ ] Proposal list with approve/reject buttons
- [ ] Historical search runs queryable by date/domain

---

### [ ] Search Persistence — Resume Interrupted Searches
**Priority:** P2  
**Description:** Search state lives in memory; interruption loses all progress  
**Current:** `SearchLoop.runSearch()` is a single long-running call

**Acceptance criteria:**
- [ ] Search state checkpointed to PostgreSQL after each iteration
- [ ] `cli.ts --resume <searchId>` restores and continues
- [ ] Interrupted search auto-detected on startup

---

### [ ] Multi-Model Comparison Benchmark
**Priority:** P3  
**Description:** Run same domain across all models to compare quality/cost/latency  
**CLI addition:** `bun tsx src/lib/adas/cli.ts --domain math --benchmark`

**Acceptance criteria:**
- [ ] Each model in tier runs same N iterations
- [ ] Summary table: model → accuracy → cost → latency → composite
- [ ] Results saved to `adas_runs` with `group_id = "benchmark"`

---

## Nice to Have

### [ ] Prompt Templates Library
**Priority:** P3  
**Description:** Pre-built prompt templates per domain/strategy  
**Location:** `src/lib/adas/prompts/`

### [ ] Evolutionary Diversity Metrics
**Priority:** P3  
**Description:** Measure population diversity to avoid premature convergence  
**Metrics:** Hamming distance between designs, entropy of model/strategy distribution

### [ ] A/B Agent Deployment
**Priority:** P4  
**Description:** Deploy two approved agents to same domain, compare real-world performance  
**Requires:** MCP integration first

### [ ] Agent Self-Improvement Loop
**Priority:** P4  
**Description:** Approved agent runs in production, receives feedback signals, proposes self-modification  
**Requires:** A/B deployment + proposal workflow

---

## Definition of Done

For each task to be marked ✅:
1. All acceptance criteria met
2. Code reviewed
3. Tests added/updated
4. Docs updated (BLUEPRINT, DATA-DICTIONARY if schema changed)
5. No new TypeScript errors (`bun run typecheck` passes)

---

## Dependencies

```
MCP Integration
├── Requires: Clean public API in src/lib/adas/index.ts
└── Blocks: A/B Agent Deployment, Agent Self-Improvement

Tool Implementations
├── Requires: Sandbox Docker Execution (for safe network tools)
└── Blocks: Real tool-calling agents

Sandbox Docker Execution
└── Requires: Docker socket access configured

Search Persistence
├── Requires: MCP Integration (for resume command)
└── Blocks: (nothing — standalone feature)
```

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — full system design
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — known risks
- [src/lib/adas/](src/lib/adas/) — source code
