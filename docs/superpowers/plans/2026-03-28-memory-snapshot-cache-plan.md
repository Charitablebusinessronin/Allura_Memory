# Memory Snapshot Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bun-based snapshot + hydration workflow so session startup loads curated doc context in <30s and syncs changes into the existing memory system.

**Architecture:** A Bun CLI scans `docs/roninmemory/` and `docs/Carlos_plan_framework/`, emits `memory-bank/index.json` + metadata, and a startup script reads that snapshot to log session briefings and create Neo4j/Postgres insights with enforced `group_id`.

**Tech Stack:** Bun (TypeScript), fast-glob, Node crypto, MCP memory client, Vitest.

---

## File Map

| File | Purpose |
| --- | --- |
| `scripts/build-memory-snapshot.ts` | CLI to scan doc dirs, compute hashes, and emit JSON snapshot + metadata. |
| `scripts/helpers/snapshot-types.ts` | Shared TypeScript types/interfaces for snapshot entries and metadata. |
| `memory-bank/index.json` | Generated artifact (committed? no) – ensure `.gitignore` entry. |
| `memory-bank/index.meta.json` | Generated metadata file. |
| `scripts/hydrate-session-from-snapshot.ts` | Startup helper to read snapshot, log session events, and push insights via MCP. |
| `tests/scripts/build-memory-snapshot.test.ts` | Vitest unit tests for snapshot builder. |
| `tests/scripts/hydrate-session-from-snapshot.test.ts` | Vitest tests using mocks for MCP calls. |
| `package.json` | Add Bun scripts (`bun run snapshot:build`, `bun run session:hydrate`). |
| `README.md` | Document workflow + commands. |
| `.gitignore` | Ignore generated `memory-bank/*.json`. |

---

## Task 1: Implement Snapshot Builder CLI (TDD cadence)

**Files:**
- Create `scripts/helpers/snapshot-types.ts`
- Create `scripts/build-memory-snapshot.ts`
- Modify `.gitignore`
- Create `tests/scripts/build-memory-snapshot.test.ts`

- [ ] **Step 1:** Define shared types/helpers in `scripts/helpers/snapshot-types.ts` (interfaces + `hashContent`).
- [ ] **Step 2:** **Write failing test** (Vitest) that expects the CLI to parse args, process fixtures, and emit snapshot/metadata files.
- [ ] **Step 3:** **Implement minimal CLI** in `scripts/build-memory-snapshot.ts` to satisfy parsing + file write expectations (hardcode single file) and rerun the test (expect PASS for covered behavior).
- [ ] **Step 4:** **Add failing tests** for incremental skip + summary extraction logic.
- [ ] **Step 5:** Extend CLI implementation incrementally (fast-glob scanning, hash comparison, summary extraction) until new tests pass.
- [ ] **Step 6:** Update `.gitignore` to exclude `memory-bank/index.json`, `memory-bank/index.meta.json`, and `memory-bank/ingestion.meta.json`.
- [ ] **Step 7:** Add remaining Vitest cases for CLI stats output & error handling.
- [ ] **Step 8:** Run `bun vitest run tests/scripts/build-memory-snapshot.test.ts` and ensure PASS.

## Task 2: Implement Startup Hydration Script (TDD cadence)

**Files:**
- Create `scripts/hydrate-session-from-snapshot.ts`
- Create `tests/scripts/hydrate-session-from-snapshot.test.ts`
- Update `scripts/helpers/snapshot-types.ts` if shared logic needed

- [ ] **Step 1:** **Write failing test** that instantiates the hydration script with missing snapshot to ensure it throws an actionable error.
- [ ] **Step 2:** Implement minimal loader that reads the snapshot path argument, throws the expected error, rerun the test (PASS).
- [ ] **Step 3:** **Add failing tests** for group_id validation and event logging (expect MCP calls with tenant info).
- [ ] **Step 4:** Implement validation helpers + stubs for MCP client; rerun targeted tests until PASS.
- [ ] **Step 5:** **Add failing test** covering changed-entry detection + insight creation (mock MCP to capture payloads).
- [ ] **Step 6:** Implement diff logic, append-only `session_briefing` / `session_briefing_completed` inserts, and `SUPERSEDES` relationships; rerun tests (PASS).
- [ ] **Step 7:** Finalize ingestion metadata writer and ensure `memory-bank/ingestion.meta.json` updates only via append-only semantics; extend tests accordingly.
- [ ] **Step 8:** Run `bun vitest run tests/scripts/hydrate-session-from-snapshot.test.ts` and ensure PASS.

## Task 3: Wire Scripts into Tooling & Docs

**Files:**
- Modify `package.json`
- Modify `README.md`
- Modify `docs/superpowers/specs/2026-03-28-memory-snapshot-cache-design.md` (link to plan/usage if needed)

- [ ] **Step 1:** Add Bun scripts to `package.json`:
  - `"snapshot:build": "bun run scripts/build-memory-snapshot.ts"`
  - `"session:hydrate": "bun run scripts/hydrate-session-from-snapshot.ts"`
- [ ] **Step 2:** Document workflow in `README.md` (new “Memory snapshot workflow” subsection with commands, expected artifacts, troubleshooting).
- [ ] **Step 3:** Optionally link README section from the spec for discoverability.
- [ ] **Step 4:** Run the required quality-gate commands per `AGENTS.md`: `npm run typecheck`, `npm run lint`, and `npm test`.
- [ ] **Step 5:** Run `bun vitest run tests/scripts/**/*.test.ts` if extra assurance desired (optional after npm test).

## Task 4: Final Verification & Commit

- [ ] **Step 1:** Verify snapshot builder works end-to-end on real docs (`bun run snapshot:build`). Confirm runtime and output.
- [ ] **Step 2:** Run hydration script with dry-run/mocked MCP and capture execution time (e.g., `/usr/bin/time bun run session:hydrate --dry-run`) to confirm <30s performance requirement; record measurement in PR notes.
- [ ] **Step 3:** Capture logs and add to PR description.
- [ ] **Step 4:** `git status` to confirm expected files tracked (scripts, tests, docs, gitignore, package.json). Ensure generated artifacts remain ignored.
- [ ] **Step 5:** Commit with message `feat: add memory snapshot cache workflow` (subject to team conventions).

---

## Test Commands Summary

- `bun vitest run tests/scripts/build-memory-snapshot.test.ts`
- `bun vitest run tests/scripts/hydrate-session-from-snapshot.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `bun run snapshot:build`
- `/usr/bin/time bun run session:hydrate --dry-run`

---

## Notes for Implementers

- Reuse existing MCP client utilities if available; otherwise implement small wrapper modules to keep scripts testable.
- Ensure `memory-bank/` directory exists or create it within scripts when needed.
- Keep snapshot JSON deterministic (sort keys) to minimize diff noise.
- Avoid writing generated artifacts to git by confirming `.gitignore` updates.
- When handling errors, log actionable guidance (e.g., “Run `bun run snapshot:build` first”).
