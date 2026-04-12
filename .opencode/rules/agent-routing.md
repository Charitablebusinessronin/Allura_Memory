---
description: Agent routing and orchestration rules (Brooksian Surgical Team)
globs: [".opencode/agent/**", "src/app/agents/**"]
---

# Agent Routing — Brooksian Surgical Team

> "The purpose of organization is to reduce the amount of communication and coordination necessary; hence organization is a radical attack on the communication problems treated above." — Frederick Brooks, *The Mythical Man-Month*

## The Surgical Team

We don't hire 10 surgeons. We hire one surgeon and a team of specialists who own their domains completely.

| Agent | Persona | Role | Model | Use When |
|-------|---------|------|-------|----------|
| **Sisyphus** | Rich Hickey | Orchestrator | Claude Opus 4.6 / Kimi K2.5 / GLM-5 | Task planning, delegation, never stops |
| **Atlas** | Gergely Orosz | Conductor | Claude Sonnet 4.6 | Todo orchestration, coordinates specialists |
| **Hephaestus** | Fabrice Bellard | Deep Worker | GPT-5.4 | Autonomous implementation, explores thoroughly |
| **Oracle** | Rob Pike | Consultant | GPT-5.4 (high) | Read-only architecture consultation |
| **Librarian** | Julia Evans | Docs Search | Minimax M2.7 | External documentation, debugging guides |
| **Explore** | Peter Bourgon | Codebase Grep | Claude Haiku 4.5 | Fast codebase search, pattern discovery |
| **Prometheus** | Martin Fowler | Planner | Claude Opus 4.6 | Interview-mode strategic planning |
| **UX** | Sara Soueidan | Designer | Gemini 3.1 Pro | Accessibility-first design, user flows |

## Category Routing

Intent-based routing, not model-based. The agent says what kind of work; the harness picks the right model.

| Category | Routes To | Use Case |
|----------|-----------|----------|
| `visual-engineering` | Gemini 3.1 Pro | Frontend, UI/UX, design |
| `deep` | GPT-5.4 | Autonomous research + execution |
| `quick` | GPT-5.4 Mini | Single-file changes, typos |
| `ultrabrain` | GPT-5.4 xhigh | Hard logic, architecture decisions |
| `ux-design` | Gemini 3.1 Pro | Accessibility review, design patterns |

## Routing Rules

### Essential Routing (Surgical Team)

| Event | Route To | Why |
|-------|----------|-----|
| Task planning | Sisyphus | Owns the incision, delegates strategically |
| Todo execution | Atlas | Coordinates, doesn't implement |
| Deep implementation | Hephaestus | Give goal, not recipe |
| Architecture question | Oracle | Read-only consultation |
| External docs | Librarian | Searches like a librarian |
| Codebase search | Explore | Fast pattern discovery |
| Strategic planning | Prometheus | Interview-mode before code |
| UX review | UX | Accessibility-first design |

### GitHub Integration

| Event | Route To | Why |
|-------|----------|-----|
| PR review | Oracle | Read-only consultation on architecture |
| Code push | Hephaestus | Deep analysis, not surface review |
| Issue triage | Sisyphus | Orchestrator decides priority |
| Feature request | Prometheus | Plan before implementing |
| UX concern | UX | Accessibility review |

## Communication Overhead

With 8 agents, we have $\frac{8 \times 7}{2} = 28$ communication paths.

The category system reduces this further:
- Intent-based routing (visual-engineering, deep, quick, ultrabrain, ux-design)
- Background agents run in parallel
- Tool restrictions prevent overreach (Oracle can't write, only consult)

## Tool Restrictions

| Agent | Denied Tools | Why |
|-------|--------------|-----|
| Oracle | write, edit, task, call_omo_agent | Read-only consultation |
| Librarian | write, edit, task, call_omo_agent | Research only |
| Explore | write, edit, task, call_omo_agent | Search only |
| Atlas | task, call_omo_agent | Coordinates, doesn't implement |
| UX | write, edit | Review only, implementation via visual-engineering |

## Model Fallback Chains

| Agent | Primary | Fallback 1 | Fallback 2 | Fallback 3 |
|-------|---------|------------|------------|------------|
| Sisyphus | Claude Opus 4.6 (max) | Kimi K2.5 | GPT-5.4 (medium) | GLM-5 |
| Atlas | Claude Sonnet 4.6 | Kimi K2.5 | GPT-5.4 (medium) | Minimax M2.7 |
| Hephaestus | GPT-5.4 (medium) | — | — | — |
| Oracle | GPT-5.4 (high) | Gemini 3.1 Pro (high) | Claude Opus 4.6 (max) | — |
| Librarian | Minimax M2.7 | Minimax M2.7 (highspeed) | Claude Haiku 4.5 | GPT-5 Nano |
| Explore | Claude Haiku 4.5 | GPT-5 Nano | Minimax M2.7 (highspeed) | — |
| Prometheus | Claude Opus 4.6 (max) | GPT-5.4 (high) | GLM-5 | Gemini 3.1 Pro |
| UX | Gemini 3.1 Pro | Claude Sonnet 4.6 | GPT-5.4 (medium) | — |

## The Brooksian Principles

### 1. Conceptual Integrity
One architect (Sisyphus) owns the vision. If Atlas, Prometheus, and UX all have different ideas about "how to design," we've lost integrity.

### 2. No Silver Bullet
Essential complexity (understanding user intent, designing architecture) cannot be removed. Accidental complexity (model selection, context management) is what the harness solves.

### 3. Second-System Effect
Resist adding every feature that was "cut from the first version." 8 agents is enough. Don't add more.

### 4. Communication Overhead
n(n-1)/2 paths. With 8 agents, 28 paths. Category routing reduces this. Keep it lean.

### 5. The Surgical Team
- One surgeon (Sisyphus)
- One conductor (Atlas)
- One implementer (Hephaestus)
- One consultant (Oracle)
- Two researchers (Librarian + Explore)
- One planner (Prometheus)
- One designer (UX)

**Total: 8 people.** Not a committee. A surgical team.

## GitHub Integration

Events route via `.github/workflows/agent-hooks.yml`:
- All events logged to PostgreSQL (append-only)
- Agent decisions tracked in Neo4j (SUPERSEDES versioning)
- Human approval required for behavior-changing promotions (HITL)

## Session Persistence

Sessions survive crashes:
```
Session Start → Load state from .opencode/state/session-{id}.json
     ↓
Each Event → Persist state update (async, non-blocking)
     ↓
Crash → Resume from last checkpoint
     ↓
Session End → Archive state, clear temp files
```

## Governance

> **Allura governs. Runtimes execute. Curators promote.**

- Agents execute within constraints
- Curators propose promotions
- Humans approve behavior changes
- Audit trails preserve everything
