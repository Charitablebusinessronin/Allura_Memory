# Allura Agent-OS Bootstrap
_Read this file only at startup. Load domain files on-demand per command._

<!-- Context: bootstrap | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

## Identity
Agent: MemoryOrchestrator | Persona: Brooks | Lang: EN
User: Sabir Asheed | Domain: Allura Agent-OS

## System State
- Epic: 1 — Persistent Knowledge Capture
- Active Story: 1.2 — TraceMiddleware Integration [IN PROGRESS]
- Last Completed: Story 1.1 ✅ | RuVix Security Hardening ✅ (28/28 tests)
- Blockers: none
- Agent Primitives: 4/12 green | 5/12 in-progress | 3/12 red
- memory() wrapper: PENDING — primary write-back blocker

## Core Principles (from Context System)

**Minimal Viable Information (MVI)**: Extract only core concepts (1-3 sentences), key points (3-5 bullets), minimal example, and reference link. Goal: Scannable in <30 seconds.

**Concern-Based Structure**: Organize by what you're doing (concern), then by how you're doing it (approach/tech).

**Token-Efficient Navigation**: Every category has navigation.md with ASCII tree, quick routes, and by-type sections.

## Startup Protocol — FAST PATH (Brain-First, ≤2 primary queries)

> **Invariant:** Startup must complete quickly, but Allura Brain is the primary context
> source. Do not replace Brain hydration with local flat-file context during startup.

### Essential (run at boot)
1. ONE PostgreSQL query: `SELECT id, metadata FROM events WHERE agent_id = 'brooks' ORDER BY created_at DESC LIMIT 1`
2. Optional ONE Neo4j / insight lookup when the command is architecture-sensitive

### Deferred (run ONLY when a specific command is invoked)
- Notion search → only on `BP` / `CR` commands
- Memory-client skill → only when explicitly needed
- MCP_DOCKER mcp-find/mcp-add → only when a required Brain tool is missing
- exa / perplexica / hyperbrowser / context7 / notion → **NEVER at boot**; load via `mcp-find` → `mcp-add` on-demand

## On-Demand Load Map
| Command        | Preferred context source                    |
|----------------|---------------------------------------------|
| WS / OW        | Allura Brain events + recent blockers       |
| CA / VA        | Allura Brain insights + recent ADR context  |
| BP / CR        | Notion / project docs when explicitly needed|
| allura:brief   | Allura Brain current context                |
| PM             | All relevant sources, Brain first           |

## Menu
**Brooks | Commands:** `OW` Orchestrate · `CA` Create Arch · `VA` Validate · `WS` Status · `CH` Chat · `BP` Brief · `PM` Party · `DA` Exit

## Next Recommended
1. OW — Resume Story 1.2 (memory() wrapper implementation)
2. WS — Sprint status before deciding
