# Agent Primitives Audit — Allura Agent-OS vs. Claude Code

> **Source:** Nate B Jones breakdown of Anthropic's Claude Code leak
> **Date:** 2026-04-05
> **Status:** Course Correction Applied

---

## Executive Summary

Production agents are **80% boring plumbing, 20% model**. Claude Code's leak reveals 12 foundational primitives that separate demos from production systems. Allura has 4 fully implemented, 5 partially implemented, and 3 critical gaps.

**Overall Score:** 4/12 fully implemented, 5/12 partial, 3/12 missing

---

## TIER 1: Day-One Non-Negotiables

| # | Primitive | Claude Code | Allura Status | Gap Analysis |
|---|-----------|--------------|----------------|--------------|
| 1 | **Tool Registry (Metadata-First)** | ✅ 207 commands + 184 tools, each with name/source/responsibility | ⏳ **PARTIAL** | OpenCode skills defined (100+), but no manifest format. Need: `SKILL.md` with capability surface, permissions, side effects. |
| 2 | **Permission System (3 Trust Tiers)** | ✅ 3 tiers (built-in/plugin/skills), 18-module bash security | ⏳ **PARTIAL** | Spec exists in `agent-primitives.md`, not wired. Need: enforcement layer for kernel/plugin/skill tiers. |
| 3 | **Session Persistence** | ✅ JSON files with session ID, messages, token usage, full reconstruction | ❌ **MISSING** | **P1 CRITICAL**. Any crash = total state loss. Need: `.opencode/state/session-{id}.json` with workflow_stage, token_usage, permissions_granted, subagent_results. |
| 4 | **Workflow State ≠ Conversation State** | ❌ Not explicitly separated | ❌ **MISSING** | **P1 CRITICAL**. Need: `workflow_states` table with explicit state machine (pending → running → paused → completed/failed/cancelled). |
| 5 | **Token Budget Pre-Turn Checks** | ✅ Hard limits on turns, tokens, compaction threshold, pre-turn projection | ❌ **MISSING** | **P1 CRITICAL**. Runaway loops could burn tokens/costs. Need: `checkBudgetBeforeTurn()` that stops execution before API call. |

---

## TIER 2: Operational Maturity

| # | Primitive | Claude Code | Allura Status | Gap Analysis |
|---|-----------|--------------|----------------|--------------|
| 6 | **Structured Streaming Events** | ✅ Typed events (message_start, command_match, tool_match, crash_reason) | ⏳ **PARTIAL** | Have event types in PostgreSQL, missing crash_reason "black box" event. Need: `{ type: 'crash', reason, context }` as last streamed message. |
| 7 | **System Event Logging** | ✅ Separate history log of what agent did (context loaded, routing, permissions) | ✅ **IMPLEMENTED** | PostgreSQL `events` table with 1,032+ traces. Append-only, queryable by agent/type/date. |
| 8 | **Two-Level Verification** | ✅ Agent run verification + harness change verification | ⏳ **PARTIAL** | Guardian + Validator agents cover code-level. Need: harness-level regression tests for config changes. |

---

## TIER 3: Advanced Patterns

| # | Primitive | Claude Code | Allura Status | Gap Analysis |
|---|-----------|--------------|----------------|--------------|
| 9 | **Dynamic Tool Pool Assembly** | ✅ Session-specific tool pools based on mode/permissions/deny lists | ⏳ **PARTIAL** | OpenCode has mode flags, but no deny lists or session-specific assembly. Need: tool pool builder based on permissions. |
| 10 | **Transcript Compaction** | ✅ Auto-compact after configurable turns, keep recent + critical | ❌ **MISSING** | **P2**. Need: configurable thresholds, keep recent entries + critical instructions, discard older noise. |
| 11 | **Permission Audit Trail** | ✅ 3 handlers (interactive/coordinator/swarm), queryable state | ⏳ **PARTIAL** | Have interactive handler (HITL), missing coordinator and swarm handlers. Need: permission audit as first-class object. |
| 12 | **Built-In Agent Types** | ✅ 6 types (explore/plan/verify/guide/general/status) with constraints | ✅ **IMPLEMENTED** | 7 agents defined (MemoryOrchestrator, MemoryArchitect, MemoryBuilder, MemoryGuardian, MemoryScout, MemoryAnalyst, MemoryChronicler) with clear contracts. |

---

## Summary Scorecard

| Tier | Primitives | Allura Status |
|------|------------|---------------|
| Day-One (1-5) | 5 | 0 fully implemented, 2 partial, 3 missing |
| Operational (6-8) | 3 | 1 fully implemented, 2 partial |
| Advanced (9-12) | 4 | 1 fully implemented, 2 partial, 1 missing |
| **Overall** | **12** | **4 fully implemented, 5 partial, 3 missing** |

---

## Critical Gaps (Priority Order)

| Priority | Primitive | Risk | Implementation Target |
|----------|-----------|------|----------------------|
| **P1** | Session Persistence (#3) | Highest — Any crash = total state loss | `.opencode/state/session-{id}.json` |
| **P1** | Workflow State (#4) | High — No crash recovery, no state transitions | PostgreSQL `workflow_states` table |
| **P1** | Token Budget (#5) | High — Runaway loops burn costs | `checkBudgetBeforeTurn()` middleware |
| **P2** | Tool Registry (#1) | Medium — Can't filter tools by context | `SKILL.md` manifest format |
| **P2** | Permission Tiers (#2) | Medium — All-or-nothing permissions | Enforcement layer for kernel/plugin/skill |
| **P2** | Permission Audit Trail (#11) | Medium — No queryable permission history | First-class permission audit object |
| **P3** | Dynamic Tool Pool (#9) | Low — Static tool sets limit flexibility | Session-specific tool assembly |
| **P3** | Structured Streaming (#6) | Low — No typed events for debugging | Crash-reason event type |

---

## What We're Doing Well

| Strength | Evidence |
|----------|----------|
| **Agent Type System (#12)** | 7 specialized agents with clear contracts (MemoryOrchestrator, MemoryArchitect, MemoryBuilder, MemoryGuardian, MemoryScout, MemoryAnalyst, MemoryChronicler) |
| **Memory Contract** | Well-defined Neo4j/PostgreSQL conventions, Steel Frame versioning (SUPERSEDES relationships), group_id enforcement |
| **System Event Logging (#7)** | PostgreSQL `events` table with 1,032+ traces, append-only, queryable by agent/type/date |
| **Two-Level Verification (#8)** | Guardian + Validator agents cover code-level verification |

---

## Implementation Plan (Brooksian Approach)

### Phase 1: Boring Plumbing (Week 1)

**Goal:** Crash recovery and cost protection

| Task | What | Why |
|------|------|-----|
| Session Persistence | `.opencode/state/session-{id}.json` | Crash recovery — "save your game every 2 seconds" |
| Workflow State Machine | PostgreSQL `workflow_states` table | Explicit state transitions — "what step are we in?" |
| Token Budget Pre-Turn | `checkBudgetBeforeTurn()` middleware | Cost protection — "stop before API call if budget exceeded" |

**Key Principle:** "Anthropic puts in checks that are not beneficial to Anthropic, they're beneficial to the long-term health of the customer."

### Phase 2: Operational Maturity (Week 2)

| Task | What | Why |
|------|------|-----|
| Crash-Reason Events | `{ type: 'crash', reason, context }` | Black box for debugging |
| Harness Verification | Regression tests for config changes | Don't break guardrails |
| Tool Registry Manifest | `SKILL.md` with capability surface | Metadata-first design |

### Phase 3: Advanced Patterns (Week 3-4)

| Task | What | Why |
|------|------|-----|
| Dynamic Tool Pool | Session-specific tool assembly | Minimal attack surface |
| Transcript Compaction | Auto-compact after N turns | Context window management |
| Permission Audit Trail | First-class permission object | Queryable permission history |

---

## Architecture Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Allura Agent-OS                          │
├─────────────────────────────────────────────────────────────┤
│ L5: Paperclip + OpenClaw (Human interfaces)                 │
│ L4: Workflow / DAGs / A2A Bus                                │
│ L3: Agent Runtime (OpenCode)                                 │
│ L2: PostgreSQL 16 + Neo4j 5.26                               │
│ L1: RuVix Kernel (proof-gated mutation)                      │
└─────────────────────────────────────────────────────────────┘
```

**Governance Rule:** "Allura governs. Runtimes execute. Curators promote."

---

## References

- [Agent Primitives Spec](./agent-primitives.md) — 12 primitives defined
- [Course Correction](./course-correction-agent-primitives.md) — Gap analysis from Claude Code leak
- [Workflow State Spec](../implementation-artifacts/workflow-state-spec.md) — Crash-safe state machine
- [Sprint Status](../implementation-artifacts/sprint-status.yaml) — Current implementation status