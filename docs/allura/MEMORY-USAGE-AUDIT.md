# Memory Usage Audit — Team RAM vs Allura Brain

> **AI-Assisted Documentation**
> Portions of this document were drafted with AI assistance and reviewed against Brooksian principles.

**Date:** 2026-04-13
**Auditor:** Brooks (Architect)
**Status:** Active

---

## Summary

**Team RAM is barely using Allura Brain.** Out of ~25,000 events in PostgreSQL, only 47 come from named Team RAM agents. The rest come from system/API/test accounts.

## Event Distribution by Agent

| Agent | Events | % of Total | Connected? |
|-------|--------|-----------|------------|
| `api` | 22,146 | 88.6% | System (not an agent) |
| `system` | 1,967 | 7.9% | System (not an agent) |
| `agent-001` | 804 | 3.2% | Generic (not Team RAM) |
| `agent-test-001` | 481 | 1.9% | Test (not Team RAM) |
| `agent-002` | 312 | 1.2% | Generic (not Team RAM) |
| `batch-approve-script` | 288 | 1.2% | Script (not an agent) |
| `test-user-1` | 192 | 0.8% | Test (not Team RAM) |
| `circuit-breaker` | 40 | 0.2% | System (not an agent) |
| **`brooks`** | **39** | **0.16%** | ✅ Only named agent writing |
| `agent-003` | 30 | 0.1% | Generic (not Team RAM) |
| `brooks-architect` | 6 | 0.02% | Duplicate identity |
| `brooks-first-light-test` | 2 | 0.008% | Test (not an agent) |
| `claude-sonnet-4-6` | 1 | 0.004% | Model name (not an agent) |
| `curator-approve` | 1 | 0.004% | Script (not an agent) |
| `allura-memory` | 1 | 0.004% | System (not an agent) |

## Team RAM Agents with ZERO Events

| Agent | Events | Status |
|-------|--------|--------|
| **Jobs** | 0 | ❌ Not connected |
| **Woz** | 0 | ❌ Not connected |
| **Bellard** | 0 | ❌ Not connected |
| **Pike** | 0 | ❌ Not connected |
| **Fowler** | 0 | ❌ Not connected |
| **Scout** | 0 | ❌ Not connected (by design — read-only) |
| **Carmack** | 0 | ❌ Not connected |
| **Knuth** | 0 | ❌ Not connected |
| **Hightower** | 0 | ❌ Not connected |

## Brooks Event Type Breakdown

| Event Type | Count | Category |
|-----------|-------|----------|
| `ARCHITECTURE_DECISION` | 6 | ✅ Core architecture |
| `TASK_COMPLETE` | 4 | ✅ Task tracking |
| `debug:session_complete` | 3 | 🔧 Debugging |
| `ADR_CREATED` | 2 | ✅ Core architecture |
| `architecture_decision` | 2 | ⚠️ Duplicate type (case inconsistency) |
| `VALIDATION_COMPLETE` | 2 | ✅ Validation |
| `session_complete` | 2 | ✅ Session tracking |
| `debug:fix_implemented` | 2 | 🔧 Debugging |
| `INTERFACE_DEFINED` | 1 | ✅ Core architecture |
| Other (11 types) | 11 | Mixed |

## Issues Found

### 1. Agent Identity Drift
Brooks writes as both `brooks` (39 events) and `brooks-architect` (6 events). These should be unified to one `agent_id`.

### 2. Event Type Inconsistency
`ARCHITECTURE_DECISION` (uppercase) and `architecture_decision` (lowercase) are the same event type with different casing. This breaks aggregation queries.

### 3. Zero Agent Coverage
9 out of 10 Team RAM agents have never written to PostgreSQL. Only Brooks has.

### 4. No Neo4j Knowledge Graph Usage
No Team RAM agent has written to Neo4j for semantic knowledge. All knowledge is episodic (PostgreSQL only).

### 5. No Notion Write-Back
Agents read from Notion but never write back. The planning surface is one-directional.

## Recommendations

1. **Unify `agent_id`** — Every agent uses their canonical name: `brooks`, `jobs`, `woz`, `bellard`, `pike`, `fowler`, `scout`, `carmack`, `knuth`, `hightower`
2. **Standardize event types** — UPPERCASE only: `ADR_CREATED`, `INTERFACE_DEFINED`, `TASK_COMPLETE`, `SESSION_START`, `SESSION_END`
3. **Wire all agents** — Every agent must log at minimum `SESSION_START` and `SESSION_END` events
4. **Enable Neo4j promotion** — Brooks should promote validated decisions to Neo4j (score ≥ 0.85)
5. **Enable Notion write-back** — Agents should update Notion pages when decisions are made
6. **Follow Connected Workflow Protocol** — See `docs/allura/CONNECTED-WORKFLOW-PROTOCOL.md`

## Canonical Agent IDs

| Agent | `agent_id` | `group_id` |
|-------|-----------|------------|
| Brooks | `brooks` | `allura-roninmemory` |
| Jobs | `jobs` | `allura-roninmemory` |
| Woz | `woz` | `allura-roninmemory` |
| Bellard | `bellard` | `allura-roninmemory` |
| Pike | `pike` | `allura-roninmemory` |
| Fowler | `fowler` | `allura-roninmemory` |
| Scout | `scout` | `allura-roninmemory` |
| Carmack | `carmack` | `allura-roninmemory` |
| Knuth | `knuth` | `allura-roninmemory` |
| Hightower | `hightower` | `allura-roninmemory` |